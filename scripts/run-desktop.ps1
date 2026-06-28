param(
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$env:ELECTRON_CACHE = Join-Path $root ".electron-cache"
$env:electron_config_cache = $env:ELECTRON_CACHE
if ($env:NODE_OPTIONS -notmatch "(^|\s)--use-system-ca(\s|$)") {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

$unpackedApp = Join-Path $root "dist\win-unpacked\Campaign Engine.exe"
$portableApp = Get-ChildItem -LiteralPath (Join-Path $root "dist") -Filter "Campaign Engine Portable *.exe" -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$desktopApp = if (Test-Path -LiteralPath $unpackedApp) { $unpackedApp } elseif ($portableApp) { $portableApp.FullName } else { $null }

if ($desktopApp) {
  if ($ValidateOnly) {
    & (Join-Path $PSScriptRoot "seed-archivist-workspace.ps1") -ValidateOnly
    Write-Host "Campaign Engine desktop app found:" -ForegroundColor Green
    Write-Host "  $desktopApp"
    return
  }
  & (Join-Path $PSScriptRoot "seed-archivist-workspace.ps1")
  Start-Process -FilePath $desktopApp
  return
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "No built Campaign Engine desktop app was found. Run the Setup executable in dist, or install Node.js 22 or newer and run: corepack enable"
}

if (-not (Test-Path -LiteralPath (Join-Path $root "node_modules"))) {
  & pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw "Campaign Engine dependencies could not be installed." }
}

& (Join-Path $PSScriptRoot "seed-archivist-workspace.ps1")

& pnpm start
if ($LASTEXITCODE -ne 0) { throw "Campaign Engine could not start." }
