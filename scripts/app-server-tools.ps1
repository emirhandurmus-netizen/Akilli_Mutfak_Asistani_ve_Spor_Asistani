function Get-LanIp {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike '169.254*' -and
        $_.IPAddress -ne '127.0.0.1' -and
        $_.PrefixOrigin -ne 'WellKnown'
      } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) {
      return $ip
    }
  } catch {}

  try {
    return [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object {
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        $_.IPAddressToString -notlike '169.254*' -and
        $_.IPAddressToString -ne '127.0.0.1'
      } |
      Select-Object -First 1 -ExpandProperty IPAddressToString
  } catch {
    return $null
  }
}

function Stop-ListeningProcess {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
      try {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
      } catch {}
    }
  } catch {}
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

function Get-AppServerHealth {
  param([int]$Port)

  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
  } catch {
    return $null
  }
}

function Wait-AppServerReady {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $health = Get-AppServerHealth -Port $Port
    if ($health -and $health.ok -and $health.service -eq 'app-server') {
      return $true
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Ensure-LocalAppServer {
  param(
    [string]$ProjectRoot,
    [int]$ApiPort = 3001,
    [switch]$Restart
  )

  $lanIp = Get-LanIp
  if (-not $lanIp) {
    $lanIp = '127.0.0.1'
  }

  $apiUrl = "http://$lanIp`:$ApiPort"
  $healthUrl = "http://127.0.0.1:$ApiPort/health"

  $env:APP_SERVER_PORT = "$ApiPort"
  $env:EXPO_PUBLIC_APP_SERVER_URL = $apiUrl

  $health = Get-AppServerHealth -Port $ApiPort
  if (-not $Restart -and $health -and $health.ok -and $health.service -eq 'app-server') {
    return [pscustomobject]@{
      ApiUrl = $apiUrl
      HealthUrl = $healthUrl
      LanIp = $lanIp
      Started = $false
      Reachable = $true
    }
  }

  Stop-ListeningProcess -Port $ApiPort

  $serverCommand = @(
    "Set-Location '$ProjectRoot'"
    "`$env:APP_SERVER_PORT='$ApiPort'"
    "npm.cmd run server"
  ) -join '; '

  Start-Process powershell -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $serverCommand
  ) | Out-Null

  return [pscustomobject]@{
    ApiUrl = $apiUrl
    HealthUrl = $healthUrl
    LanIp = $lanIp
    Started = $true
    Reachable = (Wait-AppServerReady -Port $ApiPort)
  }
}
