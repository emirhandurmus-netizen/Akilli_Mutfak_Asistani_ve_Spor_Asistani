param(
  [int]$ApiPort = 3001
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $projectRoot 'scripts\ai-server-tools.ps1')

Set-Location $projectRoot

$aiServer = Ensure-LocalAiServer -ProjectRoot $projectRoot -ApiPort $ApiPort
Write-Host "AI server URL: $($aiServer.ApiUrl)" -ForegroundColor Green

if (-not $aiServer.Reachable) {
  throw "Local AI server could not be confirmed on $($aiServer.HealthUrl)."
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
