param(
  [string]$Version = "",
  [string]$UpdateUrl = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm was not found. Install Node.js 22 or newer, then run: corepack enable"
}
if ($env:NODE_OPTIONS -notmatch "(^|\s)--use-system-ca(\s|$)") {
  $env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()
}

if (-not $Version) {
  $Version = Read-Host "New version (for example 1.0.1)"
}

if (-not $UpdateUrl) {
  try {
    $configuredRelease = Get-Content (Join-Path $root "release-config.json") -Raw | ConvertFrom-Json
    $UpdateUrl = [string]$configuredRelease.updateUrl
  } catch {
    $UpdateUrl = ""
  }
}
if (-not $UpdateUrl) {
  $UpdateUrl = Read-Host "HTTPS update feed containing the Windows executables and update metadata"
}
if ($UpdateUrl -notmatch "^https://[^/]+") {
  throw "A release build requires an HTTPS update feed so installed copies can receive later versions."
}

& pnpm exec node scripts/set-version.mjs $Version
if ($LASTEXITCODE -ne 0) { throw "The version was not changed." }

& pnpm install --lockfile-only
if ($LASTEXITCODE -ne 0) { throw "The dependency lockfile could not be refreshed." }

& (Join-Path $PSScriptRoot "build-windows.ps1") -UpdateUrl $UpdateUrl
