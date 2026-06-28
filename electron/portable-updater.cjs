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
  [string]$ExpectedSha512
)
$ErrorActionPreference = "Stop"
$backup = "$Target.previous"
$log = Join-Path (Split-Path -Parent $Source) "portable-update-error.log"
try {
  $deadline = [DateTime]::UtcNow.AddSeconds(90)
  while ((Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
  }
  if (Get-Process -Id $ParentPid -ErrorAction SilentlyContinue) {
    throw "Campaign Engine did not close before the portable update timed out."
  }
  if (Test-Path -LiteralPath $Target) {
    Copy-Item -LiteralPath $Target -Destination $backup -Force
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
} catch {
  if (Test-Path -LiteralPath $backup) {
    Copy-Item -LiteralPath $backup -Destination $Target -Force
  }
  $_ | Out-String | Set-Content -LiteralPath $log
}`;
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

  function state(nextState) {
    onState({ ...nextState, portable: true });
  }

  function stagingDirectory(version) {
    const root = path.join(tempDirectory, "Campaign Engine", "portable-updates");
    const destination = path.join(root, version);
    if (!pathInside(tempDirectory, destination)) throw new Error("The portable update staging path is invalid.");
    return { root, destination };
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

  async function download() {
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

  async function install(quit) {
    if (!downloadedUpdate) throw new Error("Download and verify the portable update before installing it.");
    await fsPromises.access(path.dirname(executablePath), fs.constants.W_OK);
    await fsPromises.access(executablePath, fs.constants.R_OK | fs.constants.W_OK);
    const helperPath = path.join(path.dirname(downloadedUpdate.readyPath), "install-portable-update.ps1");
    await fsPromises.writeFile(helperPath, portableInstallerScript(), "utf8");
    const child = spawnImpl(powershellPath, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-File", helperPath,
      "-ParentPid", String(processId),
      "-Source", downloadedUpdate.readyPath,
      "-Target", executablePath,
      "-ExpectedSha512", downloadedUpdate.sha512
    ], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    if (typeof child.once === "function") {
      await new Promise((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
    }
    child.unref();
    state({ status: "installing", version: downloadedUpdate.version, message: "Restarting to install the portable update…" });
    setImmediate(quit);
  }

  async function cleanupAfterLaunch() {
    const backupPath = `${executablePath}.previous`;
    await fsPromises.rm(backupPath, { force: true });
    const { root } = stagingDirectory(currentVersion);
    if (pathInside(tempDirectory, root)) await fsPromises.rm(root, { recursive: true, force: true });
  }

  return { check, download, install, cleanupAfterLaunch };
}

module.exports = {
  PORTABLE_METADATA_FILE,
  PORTABLE_METADATA_SCHEMA_VERSION,
  compareVersions,
  createPortableUpdater,
  portableInstallerScript,
  releaseFileUrl,
  sha512File,
  validatePortableMetadata
};
