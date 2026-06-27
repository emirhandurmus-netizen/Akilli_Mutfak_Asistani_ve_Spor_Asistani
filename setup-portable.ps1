param(
  [switch]$SkipDotfileCopy
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Copy-IfMissing {
  param(
    [Parameter(Mandatory = $true)][string]$SourceName,
    [Parameter(Mandatory = $true)][string]$DestinationName
  )

  $source = Join-Path $root $SourceName
  $destination = Join-Path $root $DestinationName

  if ((Test-Path $source) -and -not (Test-Path $destination)) {
    Copy-Item -LiteralPath $source -Destination $destination -Force
  }
}

if (-not $SkipDotfileCopy) {
  Copy-IfMissing -SourceName 'gitignore' -DestinationName '.gitignore'
  Copy-IfMissing -SourceName 'nvmrc' -DestinationName '.nvmrc'
  Copy-IfMissing -SourceName 'env.local.example' -DestinationName '.env.local'
}

Write-Host 'Portable setup finished.'
Write-Host 'If you need Gemini-backed recipe generation, put your real key into .env.local or env.local.'
