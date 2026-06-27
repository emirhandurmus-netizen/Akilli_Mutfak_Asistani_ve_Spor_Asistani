param(
  [switch]$PersistPath
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-NodeDir {
  $candidates = @()

  if ($env:ProgramFiles) {
    $candidates += (Join-Path $env:ProgramFiles "nodejs")
  }
  if ($env:LOCALAPPDATA) {
    $candidates += (Join-Path $env:LOCALAPPDATA "Programs\\nodejs")
  }
  $candidates += "C:\\Program Files\\nodejs"

  foreach ($dir in ($candidates | Select-Object -Unique)) {
    $nodeExe = Join-Path $dir "node.exe"
    $npmCmd = Join-Path $dir "npm.cmd"
    if ((Test-Path $nodeExe -PathType Leaf) -and (Test-Path $npmCmd -PathType Leaf)) {
      return $dir
    }
  }

  return $null
}

function Ensure-NodePath {
  param(
    [string]$NodeDir,
    [switch]$Persist
  )

  if (-not $env:Path.Split(";") -contains $NodeDir) {
    $env:Path = "$NodeDir;$env:Path"
  }

  if ($Persist) {
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if (-not $userPath) {
      [Environment]::SetEnvironmentVariable("Path", $NodeDir, "User")
    } elseif (-not ($userPath.Split(";") -contains $NodeDir)) {
      [Environment]::SetEnvironmentVariable("Path", "$userPath;$NodeDir", "User")
    }
  }
}

$nodeDir = Resolve-NodeDir
if (-not $nodeDir) {
  Write-Host "Node.js bulunamadi." -ForegroundColor Red
  Write-Host "Node 22 LTS'i tekrar kur ve 'Add to PATH' secili oldugundan emin ol." -ForegroundColor Yellow
  exit 1
}

Ensure-NodePath -NodeDir $nodeDir -Persist:$PersistPath

$nodeVersion = & (Join-Path $nodeDir "node.exe") -v
Write-Host "Node bulundu: $nodeVersion ($nodeDir)" -ForegroundColor Green

& (Join-Path $nodeDir "npm.cmd") --prefix $projectRoot run phone:clean
exit $LASTEXITCODE
