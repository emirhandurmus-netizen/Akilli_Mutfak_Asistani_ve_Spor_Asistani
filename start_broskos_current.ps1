param(
  [ValidateSet('web', 'android', 'ios')]
  [string]$Mode = 'web'
)

$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\emirh\OneDrive\Masaüstü\githup\broskos_app'
$flutterPath = 'C:\Users\emirh\tools\flutter\bin\flutter.bat'
$webLauncher = Join-Path $projectRoot 'start_localhost.ps1'

if (-not (Test-Path $projectRoot)) {
  throw "Guncel BroskosApp projesi bulunamadi: $projectRoot"
}

if (-not (Test-Path $flutterPath)) {
  throw "Flutter bulunamadi: $flutterPath"
}

Write-Host 'C:\MobilUygulama komutlari artik guncel BroskosApp projesine yonlendiriliyor.' -ForegroundColor Cyan
Write-Host "Kaynak proje: $projectRoot" -ForegroundColor DarkCyan

switch ($Mode) {
  'web' {
    if (-not (Test-Path $webLauncher)) {
      throw "Web baslatici bulunamadi: $webLauncher"
    }

    & $webLauncher
    break
  }
  'android' {
    Set-Location $projectRoot
    & $flutterPath run -d android
    break
  }
  'ios' {
    throw 'iOS derleme/calistrma Windows ortaminda dogrudan desteklenmiyor. Web icin npm run dev, Android icin npm run android kullan.'
  }
}
