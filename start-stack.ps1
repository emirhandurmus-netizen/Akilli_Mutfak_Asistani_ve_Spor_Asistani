param(
  [int]$ApiPort = 3001
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'scripts\app-server-tools.ps1')

Set-Location $projectRoot

$appServer = Ensure-LocalAppServer -ProjectRoot $projectRoot -ApiPort $ApiPort
Write-Host "App server URL: $($appServer.ApiUrl)" -ForegroundColor Green

if (-not $appServer.Reachable) {
  throw "Local app server could not be confirmed on $($appServer.HealthUrl)."
}

$env:EXPO_OFFLINE = '1'
$env:BROWSER = 'none'
$expoPort = Resolve-ExpoPort -PreferredPort 8081
$expoArgs = @('start', '--lan', '--web', '--port', "$expoPort")

if ($expoPort -ne 8081) {
  Write-Host "Port 8081 is busy, using Expo port $expoPort." -ForegroundColor Yellow
}

$localExpoCli = Join-Path $projectRoot 'node_modules\.bin\expo.cmd'
if (Test-Path $localExpoCli) {
  & $localExpoCli @expoArgs
} else {
  $npxArgs = @('expo') + $expoArgs
  & npx.cmd @npxArgs
}
