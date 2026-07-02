const crypto = require("node:crypto");
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const PORTABLE_METADATA_FILE = "latest-portable.json";
const PORTABLE_METADATA_SCHEMA_VERSION = 1;

function parseVersion(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : []
  };
}

function comparePrerelease(left, right) {
  if (!left.length && !right.length) return 0;
  if (!left.length) return 1;
  if (!right.length) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    if (left[index] === right[index]) continue;
    const leftNumber = /^\d+$/.test(left[index]) ? Number(left[index]) : null;
    const rightNumber = /^\d+$/.test(right[index]) ? Number(right[index]) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber < rightNumber ? -1 : 1;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return left[index].localeCompare(right[index]) < 0 ? -1 : 1;
  }
  return 0;
}

function compareVersions(leftValue, rightValue) {
  const left = parseVersion(leftValue);
  const right = parseVersion(rightValue);
  if (!left || !right) throw new Error("Portable update metadata contains an invalid semantic version.");
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function validSha512(value) {
  try {
    return /^[A-Za-z0-9+/]+={0,2}$/.test(String(value || ""))
      && Buffer.from(value, "base64").length === 64;
  } catch {
    return false;
  }
}

function validatePortableMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The portable update manifest is invalid.");
  }
  if (value.schemaVersion !== PORTABLE_METADATA_SCHEMA_VERSION) {
    throw new Error("The portable update manifest uses an unsupported schema.");
  }
  const version = String(value.version || "").trim();
  const file = String(value.file || "").trim();
  const sha512 = String(value.sha512 || "").trim();
  const size = Number(value.size);
  if (!parseVersion(version)) throw new Error("The portable update manifest has an invalid version.");
  if (!file || path.basename(file) !== file || !/\.exe$/i.test(file)) {
    throw new Error("The portable update manifest has an invalid executable name.");
  }
  if (!validSha512(sha512)) throw new Error("The portable update manifest has an invalid SHA-512 checksum.");
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("The portable update manifest has an invalid file size.");
  return { schemaVersion: PORTABLE_METADATA_SCHEMA_VERSION, version, file, sha512, size };
}

function releaseFileUrl(feedUrl, fileName) {
  const base = `${String(feedUrl || "").replace(/\/+$/, "")}/`;
  return new URL(String(fileName).split("/").map(encodeURIComponent).join("/"), base).toString();
}

function pathInside(parent, child) {
  const parentPath = `${path.resolve(parent)}${path.sep}`.toLowerCase();
  return path.resolve(child).toLowerCase().startsWith(parentPath);
}

async function sha512File(filePath) {
  const hash = crypto.createHash("sha512");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("base64");
}

function portableInstallerScript() {
  return String.raw`param(
  [int]$ParentPid,
  [string]$Source,
  [string]$Target,
  [string]$ExpectedSha512,
  [string]$UpdateVersion
)
$ErrorActionPreference = "Stop"
$backup = "$Target.previous"
$stagingDirectory = Split-Path -Parent $Source
$log = Join-Path $stagingDirectory "portable-update-error.log"
$success = Join-Path $stagingDirectory "portable-update-success.json"
$backupCreated = $false
try {
  Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $success -Force -ErrorAction SilentlyContinue
  $targetFullPath = [System.IO.Path]::GetFullPath($Target)
  function Get-RunningTargetProcesses {
    @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
      try {
        $_.Path -and ([System.IO.Path]::GetFullPath($_.Path) -ieq $targetFullPath)
      } catch {
        $false
      }
    })
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(90)
  while ((Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) {
    throw "Campaign Engine did not close before the portable update timed out."
  }
  $deadline = [DateTime]::UtcNow.AddSeconds(90)
  while ((Get-RunningTargetProcesses).Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if ((Get-RunningTargetProcesses).Count -gt 0) {
    throw "Campaign Engine Portable did not close before the portable update timed out."
  }
  if (Test-Path -LiteralPath $Target) {
    Copy-Item -LiteralPath $Target -Destination $backup -Force
    $backupCreated = $true
  }
  Move-Item -LiteralPath $Source -Destination $Target -Force
  $stream = [System.IO.File]::OpenRead($Target)
  try {
    $algorithm = [System.Security.Cryptography.SHA512]::Create()
    try {
      $actual = [Convert]::ToBase64String($algorithm.ComputeHash($stream))
    } finally {
      $algorithm.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
  if ($actual -ne $ExpectedSha512) {
    throw "The installed portable executable failed its final checksum verification."
  }
  Start-Process -FilePath $Target -WorkingDirectory (Split-Path -Parent $Target)
  @{
    version = $UpdateVersion
    target = $targetFullPath
    installedAt = [DateTime]::UtcNow.ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $success -Encoding UTF8
} catch {
  if ($backupCreated -and (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $backup -Destination $Target -Force
  }
  $_ | Out-String | Set-Content -LiteralPath $log
  throw
}`;
}

function portableSchedulerScript() {
  return String.raw`param(
  [string]$TaskName,
  [string]$PowerShellPath,
  [string]$InstallerPath,
  [int]$ParentPid,
  [string]$Source,
  [string]$Target,
  [string]$ExpectedSha512,
  [string]$UpdateVersion
)
$ErrorActionPreference = "Stop"
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
function Quote-Argument([string]$Value) {
  return '"' + $Value + '"'
}
$arguments = @(
  "-NoProfile",
  "-NonInteractive",
  "-WindowStyle", "Hidden",
  "-ExecutionPolicy", "Bypass",
  "-File", (Quote-Argument $InstallerPath),
  "-ParentPid", $ParentPid,
  "-Source", (Quote-Argument $Source),
  "-Target", (Quote-Argument $Target),
  "-ExpectedSha512", (Quote-Argument $ExpectedSha512),
  "-UpdateVersion", (Quote-Argument $UpdateVersion)
) -join " "
$action = New-ScheduledTaskAction -Execute $PowerShellPath -Argument $arguments -WorkingDirectory (Split-Path -Parent $Target)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $TaskName
} catch {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  throw
}`;
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.on("data", chunk => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000);
    });
    child.once("error", reject);
    child.once("close", code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Portable update scheduler exited with code ${code}.`));
    });
  });
}

function createPortableUpdater({
  currentVersion,
  executablePath,
  feedUrl,
  tempDirectory,
  onState = () => {},
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  processId = process.pid,
  powershellPath = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
}) {
  let availableUpdate = null;
  let downloadedUpdate = null;
  let activeDownload = null;
  let cleanupTask = null;

  function state(nextState) {
    onState({ ...nextState, portable: true });
  }

  function stagingDirectory(version) {
    const root = path.join(tempDirectory, "Campaign Engine", "portable-updates");
    const destination = path.join(root, version);
    if (!pathInside(tempDirectory, destination)) throw new Error("The portable update staging path is invalid.");
    return { root, destination };
  }

  async function cleanupScheduledTasks() {
    const child = spawnImpl(powershellPath, [
      "-NoProfile",
      "-NonInteractive",
      "-WindowStyle", "Hidden",
      "-Command",
      "$tasks = @(Get-ScheduledTask -TaskName 'Campaign Engine Portable Update *' -ErrorAction SilentlyContinue); $tasks | Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue"
    ], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    await waitForChild(child);
  }

  async function check() {
    state({ status: "checking", message: "Checking the portable release feed…" });
    const response = await fetchImpl(releaseFileUrl(feedUrl(), PORTABLE_METADATA_FILE), {
      cache: "no-store",
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`Portable update manifest returned ${response.status}.`);
    const metadata = validatePortableMetadata(await response.json());
    if (compareVersions(metadata.version, currentVersion) <= 0) {
      availableUpdate = null;
      downloadedUpdate = null;
      state({ status: "up-to-date", version: currentVersion, message: "Campaign Engine Portable is up to date." });
      return null;
    }
    availableUpdate = metadata;
    downloadedUpdate = null;
    state({
      status: "available",
      version: metadata.version,
      message: `Portable version ${metadata.version} is ready to download.`
    });
    return metadata;
  }

  async function performDownload() {
    if (cleanupTask) await cleanupTask;
    if (!availableUpdate) await check();
    if (!availableUpdate) return null;
    const metadata = availableUpdate;
    const { destination } = stagingDirectory(metadata.version);
    await fsPromises.rm(destination, { recursive: true, force: true });
    await fsPromises.mkdir(destination, { recursive: true });
    const partialPath = path.join(destination, "Campaign Engine Portable.download");
    const readyPath = path.join(destination, "Campaign Engine Portable.ready.exe");
    const response = await fetchImpl(releaseFileUrl(feedUrl(), metadata.file), {
      cache: "no-store",
      redirect: "follow"
    });
    if (!response.ok || !response.body) throw new Error(`Portable update download returned ${response.status}.`);

    let downloadedBytes = 0;
    let lastPercent = -1;
    const hash = crypto.createHash("sha512");
    const progress = new Transform({
      transform(chunk, encoding, callback) {
        downloadedBytes += chunk.length;
        hash.update(chunk);
        const percent = Math.min(100, Math.floor((downloadedBytes / metadata.size) * 100));
        if (percent !== lastPercent) {
          lastPercent = percent;
          state({ status: "downloading", percent, message: `Downloading portable update: ${percent}%` });
        }
        callback(null, chunk);
      }
    });

    try {
      await pipeline(Readable.fromWeb(response.body), progress, fs.createWriteStream(partialPath, { flags: "wx" }));
      const actualSha512 = hash.digest("base64");
      if (downloadedBytes !== metadata.size) throw new Error("The portable update download has an unexpected file size.");
      const actualHash = Buffer.from(actualSha512, "base64");
      const expectedHash = Buffer.from(metadata.sha512, "base64");
      if (!crypto.timingSafeEqual(actualHash, expectedHash)) {
        throw new Error("The portable update download failed SHA-512 verification.");
      }
      await fsPromises.rename(partialPath, readyPath);
    } catch (error) {
      await fsPromises.rm(partialPath, { force: true });
      throw error;
    }

    downloadedUpdate = { ...metadata, readyPath };
    state({
      status: "downloaded",
      version: metadata.version,
      message: `Portable version ${metadata.version} is verified and ready to install.`
    });
    return downloadedUpdate;
  }

  function download() {
    if (activeDownload) return activeDownload;
    activeDownload = performDownload().finally(() => {
      activeDownload = null;
    });
    return activeDownload;
  }

  async function install(quit) {
    if (!downloadedUpdate) throw new Error("Download and verify the portable update before installing it.");
    await fsPromises.access(path.dirname(executablePath), fs.constants.W_OK);
    await fsPromises.access(executablePath, fs.constants.R_OK | fs.constants.W_OK);
    const helperPath = path.join(path.dirname(downloadedUpdate.readyPath), "install-portable-update.ps1");
    const schedulerPath = path.join(path.dirname(downloadedUpdate.readyPath), "schedule-portable-update.ps1");
    const taskName = `Campaign Engine Portable Update ${downloadedUpdate.version} ${processId}`;
    await fsPromises.writeFile(helperPath, portableInstallerScript(), "utf8");
    await fsPromises.writeFile(schedulerPath, portableSchedulerScript(), "utf8");
    const child = spawnImpl(powershellPath, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", schedulerPath,
      "-TaskName", taskName,
      "-PowerShellPath", powershellPath,
      "-InstallerPath", helperPath,
      "-ParentPid", String(processId),
      "-Source", downloadedUpdate.readyPath,
      "-Target", executablePath,
      "-ExpectedSha512", downloadedUpdate.sha512,
      "-UpdateVersion", downloadedUpdate.version
    ], {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    await waitForChild(child);
    state({ status: "installing", version: downloadedUpdate.version, message: "Restarting to install the portable update…" });
    setImmediate(quit);
  }

  async function cleanupAfterLaunch() {
    if (activeDownload) return;
    cleanupTask = (async () => {
      try {
        await cleanupScheduledTasks();
      } catch {
        // Task cleanup can be retried on the next launch.
      }
      const { root, destination } = stagingDirectory(currentVersion);
      const successPath = path.join(destination, "portable-update-success.json");
      let success;
      try {
        success = JSON.parse(await fsPromises.readFile(successPath, "utf8"));
      } catch {
        return;
      }
      if (success?.version !== currentVersion) return;
      await fsPromises.rm(destination, { recursive: true, force: true });
      try {
        if (!(await fsPromises.readdir(root)).length) await fsPromises.rmdir(root);
      } catch {
        // Preserve other staged versions and failed-install diagnostics.
      }
    })();
    try {
      await cleanupTask;
    } finally {
      cleanupTask = null;
    }
  }

  return { check, download, install, cleanupAfterLaunch };
}

module.exports = {
  PORTABLE_METADATA_FILE,
  PORTABLE_METADATA_SCHEMA_VERSION,
  compareVersions,
  createPortableUpdater,
  portableInstallerScript,
  portableSchedulerScript,
  releaseFileUrl,
  sha512File,
  validatePortableMetadata
};
