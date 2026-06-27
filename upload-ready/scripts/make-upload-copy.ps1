param(
  [string]$OutputDir = "upload-ready",
  [switch]$IncludeGenerated
)

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root $OutputDir

if (Test-Path $target) {
  Remove-Item -LiteralPath $target -Recurse -Force
}

New-Item -ItemType Directory -Path $target | Out-Null

function Copy-VisibleFile {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$DestinationName
  )

  $dest = Join-Path $target $DestinationName
  Copy-Item -LiteralPath $Source -Destination $dest -Force
}

function Copy-VisibleDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$DestinationName
  )

  if (-not (Test-Path $Source)) {
    return
  }

  $dest = Join-Path $target $DestinationName
  Copy-Item -LiteralPath $Source -Destination $dest -Recurse -Force
}

@(
  'App.tsx',
  'index.ts',
  'app.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'metro.config.js',
  'server',
  'scripts',
  'README.md'
) | ForEach-Object {
  $source = Join-Path $root $_
  if (Test-Path $source) {
    Copy-VisibleDirectory -Source $source -DestinationName $_
  }
}

Copy-VisibleFile -Source (Join-Path $root '.env.example') -DestinationName 'env.example'
if (Test-Path (Join-Path $root 'env.local.example')) {
  Copy-VisibleFile -Source (Join-Path $root 'env.local.example') -DestinationName 'env.local.example'
}
Copy-VisibleFile -Source (Join-Path $root '.gitignore') -DestinationName 'gitignore'
Copy-VisibleFile -Source (Join-Path $root '.nvmrc') -DestinationName 'nvmrc'

if (Test-Path (Join-Path $root 'app.config.js')) {
  Copy-VisibleFile -Source (Join-Path $root 'app.config.js') -DestinationName 'app.config.js'
}

if ($IncludeGenerated) {
  if (Test-Path (Join-Path $root '.expo')) {
    Copy-VisibleDirectory -Source (Join-Path $root '.expo') -DestinationName 'expo'
  }

  if (Test-Path (Join-Path $root 'dist')) {
    Copy-VisibleDirectory -Source (Join-Path $root 'dist') -DestinationName 'dist'
  }

  if (Test-Path (Join-Path $root 'web-build')) {
    Copy-VisibleDirectory -Source (Join-Path $root 'web-build') -DestinationName 'web-build'
  }
}

Write-Host "Created upload copy at $target"
