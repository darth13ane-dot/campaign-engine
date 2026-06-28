param(
  [string]$UpdateUrl = "",
  [switch]$IncludeArchivistData
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$env:ELECTRON_CACHE = Join-Path $root ".electron-cache"
$env:electron_config_cache = $env:ELECTRON_CACHE
$env:ELECTRON_BUILDER_CACHE = Join-Path $root ".electron-builder-cache"
if ($env:NODE_OPTIONS -notmatch "(^|\s)--use-system-ca(\s|$)") {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm was not found. Install Node.js 22 or newer, then run: corepack enable"
}

$releaseSnapshotPath = Join-Path $root "release-assets\archivist-data.js"
$releaseDetailsPath = Join-Path $root "release-assets\archivist-details.js"
$releaseSnapshotOriginal = $null
$releaseDetailsOriginal = $null

try {
  if ($IncludeArchivistData) {
    $releaseSnapshotOriginal = [System.IO.File]::ReadAllBytes($releaseSnapshotPath)
    $releaseDetailsOriginal = [System.IO.File]::ReadAllBytes($releaseDetailsPath)
    Copy-Item -LiteralPath (Join-Path $root "archivist-data.js") -Destination $releaseSnapshotPath -Force
    Copy-Item -LiteralPath (Join-Path $root "archivist-details.js") -Destination $releaseDetailsPath -Force
    Write-Host "Building the private Archivist edition." -ForegroundColor Cyan
  }

  if ($UpdateUrl) {
    $env:CAMPAIGN_ENGINE_UPDATE_URL = $UpdateUrl
    & pnpm run configure:release
    if ($LASTEXITCODE -ne 0) { throw "The release feed could not be configured." }
  }

  & pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "Campaign Engine dependencies could not be installed." }

  & pnpm test
  if ($LASTEXITCODE -ne 0) { throw "Campaign Engine tests failed. No installer was created." }

  & pnpm run dist
  if ($LASTEXITCODE -ne 0) { throw "The Windows installer build failed." }

  Write-Host ""
  Write-Host "Campaign Engine is ready in:" -ForegroundColor Green
  Write-Host "  $root\dist"
  Write-Host ""
  Get-ChildItem -LiteralPath (Join-Path $root "dist") -File |
    Where-Object { $_.Extension -in ".exe", ".yml", ".json", ".blockmap" } |
    Select-Object Name, @{ Name = "SizeMB"; Expression = { [math]::Round($_.Length / 1MB, 1) } } |
    Format-Table -AutoSize
} finally {
  if ($null -ne $releaseSnapshotOriginal) {
    [System.IO.File]::WriteAllBytes($releaseSnapshotPath, $releaseSnapshotOriginal)
  }
  if ($null -ne $releaseDetailsOriginal) {
    [System.IO.File]::WriteAllBytes($releaseDetailsPath, $releaseDetailsOriginal)
  }
}
