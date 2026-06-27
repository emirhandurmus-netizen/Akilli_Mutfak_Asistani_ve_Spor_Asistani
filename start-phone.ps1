param(
  [ValidateSet('tunnel', 'lan')]
  [string]$Mode = 'lan',
  [int]$ApiPort = 3001,
  [switch]$ClearCache,
  [switch]$AllowLanFallback,
  [switch]$SkipAdbInTunnel = $true
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'scripts\app-server-tools.ps1')

function Unblock-NgrokBinaries {
  param([string]$RootPath)

  try {
    $nodeModulesPath = Join-Path $RootPath 'node_modules'
    if (-not (Test-Path $nodeModulesPath)) {
      return
    }

    $ngrokBinaries = Get-ChildItem -Path $nodeModulesPath -Recurse -Filter 'ngrok.exe' -ErrorAction SilentlyContinue
    foreach ($binary in $ngrokBinaries) {
      try {
        Unblock-File -LiteralPath $binary.FullName -ErrorAction SilentlyContinue
      } catch {}
    }
  } catch {}
}

function Ensure-ExpoNgrok {
  param([string]$RootPath)

  $ngrokPackageJson = Join-Path $RootPath 'node_modules\@expo\ngrok\package.json'
  if (Test-Path $ngrokPackageJson) {
    Unblock-NgrokBinaries -RootPath $RootPath
    return $true
  }

  Write-Host "@expo/ngrok not found. Installing local tunnel dependency..." -ForegroundColor Yellow
  & npm.cmd install --save-dev @expo/ngrok@^4.1.0
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install @expo/ngrok automatically." -ForegroundColor Red
    Write-Host "Run this once as Administrator: npm install --save-dev @expo/ngrok@^4.1.0" -ForegroundColor DarkYellow
    return $false
  }

  if (-not (Test-Path $ngrokPackageJson)) {
    Write-Host "@expo/ngrok install completed but package is still missing." -ForegroundColor Red
    return $false
  }

  Unblock-NgrokBinaries -RootPath $RootPath
  Write-Host "@expo/ngrok is ready." -ForegroundColor DarkGreen
  return $true
}

function Apply-ExpoNgrokPatch {
  param([string]$RootPath)

  $patchScriptPath = Join-Path $RootPath 'scripts\patch-expo-ngrok.js'
  if (-not (Test-Path $patchScriptPath)) {
    return
  }

  try {
    & node $patchScriptPath
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Could not apply @expo/ngrok compatibility patch automatically." -ForegroundColor DarkYellow
    }
  } catch {
    Write-Host "Could not apply @expo/ngrok compatibility patch: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

function Get-NodeMajorVersion {
  try {
    $nodeMajor = & node -p "process.versions.node.split('.')[0]"
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return [int]$nodeMajor
  } catch {
    return $null
  }
}

function Try-UseNode22WithNvm {
  $nvmCommand = Get-Command nvm.exe -ErrorAction SilentlyContinue
  if (-not $nvmCommand) {
    $nvmCommand = Get-Command nvm -ErrorAction SilentlyContinue
  }

  if (-not $nvmCommand) {
    return $false
  }

  try {
    $listOutput = & $nvmCommand.Source list 2>&1
    if ($LASTEXITCODE -ne 0) {
      return $false
    }

    $hasNode22 = $false
    foreach ($line in $listOutput) {
      if ("$line" -match '(^|\s)22(\.|$)') {
        $hasNode22 = $true
        break
      }
    }
    if (-not $hasNode22) {
      return $false
    }

    Write-Host "Node 24+ detected. Trying automatic switch to Node 22 via nvm..." -ForegroundColor Yellow
    & $nvmCommand.Source use 22 | Out-Host
    if ($LASTEXITCODE -ne 0) {
      return $false
    }

    $nodeMajor = Get-NodeMajorVersion
    return ($null -ne $nodeMajor -and $nodeMajor -eq 22)
  } catch {
    return $false
  }
}

function Test-PortInUse {
  param([int]$Port)

  try {
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listeners | Where-Object { $_.Port -eq $Port }) {
      return $true
    }
  } catch {}

  $listenerV4 = $null
  $listenerV6 = $null
  try {
    $listenerV4 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
    $listenerV4.Start()

    $listenerV6 = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::IPv6Any, $Port)
    $listenerV6.Server.DualMode = $false
    $listenerV6.Start()

    return $false
  } catch {
    return $true
  } finally {
    if ($null -ne $listenerV6) {
      try { $listenerV6.Stop() } catch {}
    }
    if ($null -ne $listenerV4) {
      try { $listenerV4.Stop() } catch {}
    }
  }
}

function Resolve-ExpoPort {
  param(
    [int]$PreferredPort = 8081,
    [int]$MaxPortChecks = 25
  )

  for ($offset = 0; $offset -lt $MaxPortChecks; $offset++) {
    $candidatePort = $PreferredPort + $offset
    if (-not (Test-PortInUse -Port $candidatePort)) {
      return $candidatePort
    }
  }

  throw "No available Expo port found in range $PreferredPort-$($PreferredPort + $MaxPortChecks - 1)."
}

function Stop-ExpoSession {
  param([string]$RootPath)

  $rootEscaped = [regex]::Escape($RootPath)
  $candidateProcesses = @()

  try {
    $candidateProcesses = Get-CimInstance Win32_Process |
      Where-Object {
        ($_.Name -eq 'ngrok.exe') -or
        ($_.CommandLine -match $rootEscaped -and $_.CommandLine -match 'expo\\bin\\cli' -and $_.CommandLine -match '\sstart(\s|$)')
      }
  } catch {
    Write-Host "Could not scan running processes: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }

  $candidateProcesses | ForEach-Object {
    try {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
      Write-Host "Stopped PID $($_.ProcessId) $($_.Name)" -ForegroundColor DarkGray
    } catch {
      Write-Host "Could not stop PID $($_.ProcessId): $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
  }

  Start-Sleep -Milliseconds 300
}

function Start-Expo {
  param(
    [ValidateSet('tunnel', 'lan')]
    [string]$HostMode,
    [switch]$Clear,
    [switch]$SkipAdbForTunnel
  )

  $expoPort = Resolve-ExpoPort -PreferredPort 8081
  $expoArgs = @('start', '--port', "$expoPort")
  if ($Clear) {
    $expoArgs += '-c'
  }

  if ($HostMode -eq 'tunnel') {
    $expoArgs += '--tunnel'
  } else {
    $expoArgs += '--lan'
  }

  Write-Host "Starting Expo ($HostMode)..." -ForegroundColor Cyan
  if ($expoPort -ne 8081) {
    Write-Host "Port 8081 is busy, using port $expoPort." -ForegroundColor Yellow
  }
  if ($HostMode -eq 'lan') {
    $localIp = Get-LanIp
    if ($localIp) {
      Write-Host "Expo Go manual URL: exp://$localIp`:$expoPort" -ForegroundColor Green
    }
    Write-Host "LAN mode only works when phone and computer are on the same network." -ForegroundColor DarkYellow
    Write-Host "Note: This command stays open while Metro runs. Wait about 5-20 seconds." -ForegroundColor DarkCyan
  } else {
    Write-Host "Tunnel mode works even if your phone uses a different network." -ForegroundColor Green
    Write-Host "Tunnel setup can take 15-60 seconds. Keep this window open." -ForegroundColor DarkCyan
  }

  $localExpoCli = Join-Path $projectRoot 'node_modules\.bin\expo.cmd'
  $previousAndroidHome = $env:ANDROID_HOME
  $previousAndroidSdkRoot = $env:ANDROID_SDK_ROOT
  $previousCi = $env:CI
  $previousExpoOffline = $env:EXPO_OFFLINE
  $adbOverrideApplied = $false
  $ciOverrideApplied = $false
  $expoOfflineOverrideApplied = $false

  try {
    if ($HostMode -eq 'tunnel') {
      $nodeMajor = Get-NodeMajorVersion
      if ($null -ne $nodeMajor -and $nodeMajor -ge 24) {
        if (Try-UseNode22WithNvm) {
          $nodeMajor = Get-NodeMajorVersion
          if ($null -ne $nodeMajor) {
            Write-Host "Node runtime switched successfully. Using Node.js v$nodeMajor." -ForegroundColor Green
          }
        } else {
          Write-Host "Detected Node.js v$nodeMajor. Tunnel may be unstable on Node 24+." -ForegroundColor DarkYellow
          Write-Host "Recommended: install Node 22 LTS and rerun for best stability." -ForegroundColor DarkYellow
        }
      }

      if (-not (Ensure-ExpoNgrok -RootPath $projectRoot)) {
        return 1
      }

      Apply-ExpoNgrokPatch -RootPath $projectRoot
    }

    if ($HostMode -eq 'tunnel' -and $SkipAdbForTunnel) {
      # Expo CLI tries adb reverse before ngrok tunnel. On some Windows setups this step fails and blocks tunnel.
      $sdkBypassPath = Join-Path $projectRoot '.no-android-sdk-for-tunnel'
      $env:ANDROID_HOME = $sdkBypassPath
      $env:ANDROID_SDK_ROOT = $sdkBypassPath
      $adbOverrideApplied = $true
      Write-Host "ADB reverse step disabled for tunnel startup." -ForegroundColor DarkGray
    }

    # Keep tunnel non-interactive inside npm scripts.
    if ($HostMode -eq 'tunnel' -and -not $env:CI) {
      $env:CI = '1'
      $ciOverrideApplied = $true
    }

    # In LAN mode, avoid remote dependency checks breaking local development on flaky/blocked internet.
    if ($HostMode -eq 'lan' -and -not $env:EXPO_OFFLINE) {
      $env:EXPO_OFFLINE = '1'
      $expoOfflineOverrideApplied = $true
    }

    if (Test-Path $localExpoCli) {
      & $localExpoCli @expoArgs
    } else {
      $npxArgs = @('expo') + $expoArgs
      & npx.cmd @npxArgs
    }
  } finally {
    if ($adbOverrideApplied) {
      if ($null -eq $previousAndroidHome) {
        Remove-Item Env:ANDROID_HOME -ErrorAction SilentlyContinue
      } else {
        $env:ANDROID_HOME = $previousAndroidHome
      }
      if ($null -eq $previousAndroidSdkRoot) {
        Remove-Item Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue
      } else {
        $env:ANDROID_SDK_ROOT = $previousAndroidSdkRoot
      }
    }
    if ($ciOverrideApplied) {
      if ($null -eq $previousCi) {
        Remove-Item Env:CI -ErrorAction SilentlyContinue
      } else {
        $env:CI = $previousCi
      }
    }
    if ($expoOfflineOverrideApplied) {
      if ($null -eq $previousExpoOffline) {
        Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
      } else {
        $env:EXPO_OFFLINE = $previousExpoOffline
      }
    }
  }
  return $LASTEXITCODE
}

Set-Location $projectRoot
Stop-ExpoSession -RootPath $projectRoot

$appServer = Ensure-LocalAppServer -ProjectRoot $projectRoot -ApiPort $ApiPort
Write-Host "App server URL: $($appServer.ApiUrl)" -ForegroundColor Green

if (-not $appServer.Reachable) {
  Write-Host "Warning: local app server health check did not respond. Login/profile features will not work until the server is reachable." -ForegroundColor Yellow
} elseif ($Mode -eq 'tunnel') {
  Write-Host "Note: Expo tunnel exposes the bundle, not your local app server. Keep the computer and phone on a reachable network for login and saved data." -ForegroundColor DarkYellow
}

$exitCode = Start-Expo -HostMode $Mode -Clear:$ClearCache -SkipAdbForTunnel:$SkipAdbInTunnel

if ($Mode -eq 'tunnel' -and $exitCode -ne 0 -and -not $ClearCache) {
  Write-Host ''
  Write-Host 'Tunnel startup failed, retrying once with cleared Metro cache...' -ForegroundColor Yellow
  Stop-ExpoSession -RootPath $projectRoot
  $exitCode = Start-Expo -HostMode 'tunnel' -Clear -SkipAdbForTunnel:$SkipAdbInTunnel
}

if ($Mode -eq 'tunnel' -and $exitCode -ne 0) {
  Write-Host ''
  if ($AllowLanFallback) {
    Write-Host 'Tunnel failed, retrying with LAN mode for stable phone development...' -ForegroundColor Yellow
    Stop-ExpoSession -RootPath $projectRoot
    $null = Start-Expo -HostMode 'lan' -Clear:$ClearCache -SkipAdbForTunnel:$SkipAdbInTunnel
  } else {
    Write-Host 'Tunnel failed. LAN fallback is disabled because it will not work on different networks.' -ForegroundColor Yellow
    Write-Host 'Try again with `npm run phone:tunnel` and keep the terminal open.' -ForegroundColor DarkYellow
    Write-Host 'If it still fails, temporarily disable VPN/proxy/firewall and retry.' -ForegroundColor DarkYellow
    exit $exitCode
  }
}
