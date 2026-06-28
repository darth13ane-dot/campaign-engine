param(
  [switch]$ValidateOnly,
  [string]$ExportPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$snapshotPath = Join-Path $root "archivist-data.js"
$detailsPath = Join-Path $root "archivist-details.js"
$packagePath = Join-Path $root "package.json"
$userDataDirectory = Join-Path ([Environment]::GetFolderPath("ApplicationData")) "Campaign Engine"
$workspacePath = Join-Path $userDataDirectory "campaign-engine-workspace.json"
$previousPath = Join-Path $userDataDirectory "campaign-engine-workspace.previous.json"
$backupDirectory = Join-Path $userDataDirectory "backups"

Add-Type -AssemblyName System.Web.Extensions
$jsonSerializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$jsonSerializer.MaxJsonLength = [int]::MaxValue
$jsonSerializer.RecursionLimit = 256

function ConvertFrom-CaseSensitiveJson {
  param([string]$Json)
  return $script:jsonSerializer.DeserializeObject($Json)
}

function Read-JavaScriptJsonAssignment {
  param(
    [string]$Path,
    [string]$VariableName
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "The private Archivist source file is missing: $Path"
  }

  $text = [System.IO.File]::ReadAllText($Path)
  $marker = "window.$VariableName"
  $markerIndex = $text.IndexOf($marker, [StringComparison]::Ordinal)
  if ($markerIndex -lt 0) {
    throw "The Archivist source file has an unexpected format: $Path"
  }

  $equalsIndex = $text.IndexOf("=", $markerIndex + $marker.Length)
  if ($equalsIndex -lt 0) {
    throw "The Archivist source file has an unexpected format: $Path"
  }

  $json = $text.Substring($equalsIndex + 1).Trim()
  if ($json.EndsWith(";")) {
    $json = $json.Substring(0, $json.Length - 1).TrimEnd()
  }
  return ConvertFrom-CaseSensitiveJson -Json $json
}

function Write-Utf8Json {
  param(
    [string]$Path,
    [object]$Value
  )

  $json = $script:jsonSerializer.Serialize($Value)
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, "$json`n", $utf8WithoutBom)
}

$snapshot = Read-JavaScriptJsonAssignment -Path $snapshotPath -VariableName "ARCHIVIST_SNAPSHOT"
$details = Read-JavaScriptJsonAssignment -Path $detailsPath -VariableName "ARCHIVIST_DETAILS"
$campaigns = @($snapshot["campaigns"])
if ($campaigns.Count -eq 0) {
  throw "The private Archivist snapshot does not contain any campaigns."
}

$package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
$workspace = [ordered]@{
  schemaVersion = 1
  appVersion = [string]$package.version
  savedAt = [DateTime]::UtcNow.ToString("o")
  state = [ordered]@{
    source = "archivist"
    activeCampaignId = [string]$campaigns[0]["id"]
    campaigns = $campaigns
  }
  archivist = $details
}

if ($ExportPath) {
  $exportDirectory = Split-Path -Parent $ExportPath
  if ($exportDirectory) {
    [System.IO.Directory]::CreateDirectory($exportDirectory) | Out-Null
  }
  Write-Utf8Json -Path $ExportPath -Value $workspace
  Write-Host "Created an Archivist workspace import with $($campaigns.Count) campaigns:" -ForegroundColor Green
  Write-Host "  $ExportPath"
  return
}

if ($ValidateOnly) {
  Write-Host "Private Archivist workspace is ready to seed:" -ForegroundColor Green
  Write-Host "  $($campaigns.Count) campaigns"
  Write-Host "  $workspacePath"
  return
}

[System.IO.Directory]::CreateDirectory($userDataDirectory) | Out-Null
[System.IO.Directory]::CreateDirectory($backupDirectory) | Out-Null

$shouldSeed = -not (Test-Path -LiteralPath $workspacePath)
$replaceDemoWorkspace = $false
if (-not $shouldSeed) {
  try {
    $existing = ConvertFrom-CaseSensitiveJson -Json (Get-Content -LiteralPath $workspacePath -Raw)
    $existingState = $existing["state"]
    $existingCampaignIds = @($existingState["campaigns"] | ForEach-Object { [string]$_["id"] } | Sort-Object)
    $replaceDemoWorkspace = [string]$existingState["source"] -ne "archivist" -and ($existingCampaignIds -join ",") -eq "gut,vey"
  } catch {
    throw "The existing Campaign Engine workspace could not be read. Open the app's data folder and restore a backup before replacing it."
  }
}

if (-not $shouldSeed -and -not $replaceDemoWorkspace) {
  Write-Host "Campaign Engine already has a private workspace; it was left unchanged."
  return
}

if ($replaceDemoWorkspace) {
  $timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH-mm-ssZ")
  Copy-Item -LiteralPath $workspacePath -Destination (Join-Path $backupDirectory "campaign-engine-before-archivist-$timestamp.json")
  Copy-Item -LiteralPath $workspacePath -Destination $previousPath -Force
}

$temporaryPath = "$workspacePath.$PID.tmp"
Write-Utf8Json -Path $temporaryPath -Value $workspace
Move-Item -LiteralPath $temporaryPath -Destination $workspacePath -Force

if ($replaceDemoWorkspace) {
  Write-Host "The demo campaigns were backed up and replaced with $($campaigns.Count) Archivist campaigns." -ForegroundColor Green
} else {
  Write-Host "Created a private workspace with $($campaigns.Count) Archivist campaigns." -ForegroundColor Green
}
