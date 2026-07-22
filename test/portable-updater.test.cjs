const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const packageJson = require("../package.json");
const {
  compareVersions,
  createPortableUpdater,
  portableInstallerScript,
  portableSchedulerScript,
  releaseFileUrl,
  validatePortableMetadata
} = require("../electron/portable-updater.cjs");

function manifestFor(payload, version = "1.1.0") {
  return {
    schemaVersion: 1,
    version,
    file: `Campaign Engine Portable ${version}.exe`,
    sha512: crypto.createHash("sha512").update(payload).digest("base64"),
    size: payload.length
  };
}

test("compares stable and prerelease semantic versions", () => {
  assert.equal(compareVersions("1.1.0", "1.0.9"), 1);
  assert.equal(compareVersions("1.1.0-beta.2", "1.1.0-beta.1"), 1);
  assert.equal(compareVersions("1.1.0", "1.1.0-beta.2"), 1);
  assert.equal(compareVersions("1.1.0", "1.1.0"), 0);
});

test("validates portable manifests and safely encodes release filenames", () => {
  const payload = Buffer.from("portable");
  const manifest = manifestFor(payload);
  assert.deepEqual(validatePortableMetadata(manifest), manifest);
  assert.equal(
    releaseFileUrl("https://downloads.example.com/releases", manifest.file),
    "https://downloads.example.com/releases/Campaign%20Engine%20Portable%201.1.0.exe"
  );
  assert.throws(
    () => validatePortableMetadata({ ...manifest, file: "../Campaign Engine.exe" }),
    /invalid executable name/
  );
});

test("uses GitHub release-safe Windows artifact names", () => {
  const artifactNames = [
    packageJson.build.nsis.artifactName,
    packageJson.build.portable.artifactName
  ];
  for (const artifactName of artifactNames) {
    assert.doesNotMatch(artifactName, /\s/);
    assert.match(artifactName, /^Campaign\.Engine\./);
    assert.match(artifactName, /\$\{version\}\.\$\{ext\}$/);
  }
});

test("generates scheduled replacement helpers with rollback and relaunch steps", () => {
  const installer = portableInstallerScript();
  const scheduler = portableSchedulerScript();
  assert.match(installer, /Copy-Item.+\$backup/);
  assert.match(installer, /Move-Item.+\$Source.+\$Target/);
  assert.match(installer, /Get-RunningTargetProcesses/);
  assert.match(installer, /Campaign Engine Portable did not close/);
  assert.match(installer, /portable-update-success\.json/);
  assert.match(installer, /Start-Process -FilePath \$Target/);
  assert.match(scheduler, /New-ScheduledTaskPrincipal.+Interactive/);
  assert.match(scheduler, /Register-ScheduledTask/);
  assert.match(scheduler, /Start-ScheduledTask/);
  assert.match(scheduler, /Unregister-ScheduledTask/);
});

test("generated portable update scripts parse in Windows PowerShell", {
  skip: process.platform !== "win32"
}, () => {
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  for (const script of [portableInstallerScript(), portableSchedulerScript()]) {
    const result = spawnSync(powershell, [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$value = [Console]::In.ReadToEnd(); [void][ScriptBlock]::Create($value)"
    ], { input: script, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test("downloads, verifies, and stages a portable self-update", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executablePath = path.join(directory, "Campaign Engine Portable.exe");
  await fs.writeFile(executablePath, "old portable executable");
  const payload = Buffer.from("new verified portable executable");
  const manifest = manifestFor(payload);
  const states = [];
  const spawnCalls = [];
  let quitCalled = false;

  const updater = createPortableUpdater({
    currentVersion: "1.0.0",
    executablePath,
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    onState: state => states.push(state),
    fetchImpl: async url => url.endsWith("latest-portable.json")
      ? new Response(JSON.stringify(manifest), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(payload, { status: 200, headers: { "content-length": String(payload.length) } }),
    spawnImpl: (command, args, options) => {
      spawnCalls.push({ command, args, options });
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit("close", 0));
      return child;
    },
    processId: 1234,
    powershellPath: "powershell.exe"
  });

  const available = await updater.check();
  const downloaded = await updater.download();
  await updater.install(() => { quitCalled = true; });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(available.version, "1.1.0");
  assert.deepEqual(await fs.readFile(downloaded.readyPath), payload);
  assert.equal(states.at(-1).status, "installing");
  assert.equal(spawnCalls.length, 1);
  assert.match(spawnCalls[0].args[spawnCalls[0].args.indexOf("-File") + 1], /schedule-portable-update\.ps1$/);
  assert.ok(spawnCalls[0].args.includes("-TaskName"));
  assert.deepEqual(spawnCalls[0].options.stdio, ["ignore", "ignore", "pipe"]);
  assert.ok(spawnCalls[0].args.includes(executablePath));
  assert.equal(quitCalled, true);
});

test("does not quit when the scheduled installer cannot be registered", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executablePath = path.join(directory, "Campaign Engine Portable.exe");
  await fs.writeFile(executablePath, "old portable executable");
  const payload = Buffer.from("new verified portable executable");
  const manifest = manifestFor(payload);
  let quitCalled = false;
  const updater = createPortableUpdater({
    currentVersion: "1.0.0",
    executablePath,
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    fetchImpl: async url => url.endsWith("latest-portable.json")
      ? new Response(JSON.stringify(manifest), { status: 200 })
      : new Response(payload, { status: 200 }),
    spawnImpl: () => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => {
        child.stderr.emit("data", Buffer.from("Task Scheduler is unavailable."));
        child.emit("close", 1);
      });
      return child;
    }
  });

  await updater.download();
  await assert.rejects(() => updater.install(() => { quitCalled = true; }), /Task Scheduler is unavailable/);
  assert.equal(quitCalled, false);
});

test("does not let delayed launch cleanup terminate an update being installed", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executablePath = path.join(directory, "Campaign Engine Portable.exe");
  await fs.writeFile(executablePath, "old portable executable");
  const payload = Buffer.from("new verified portable executable");
  const manifest = manifestFor(payload);
  const spawnCalls = [];
  const updater = createPortableUpdater({
    currentVersion: "1.0.0",
    executablePath,
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    fetchImpl: async url => url.endsWith("latest-portable.json")
      ? new Response(JSON.stringify(manifest), { status: 200 })
      : new Response(payload, { status: 200 }),
    spawnImpl: (command, args) => {
      spawnCalls.push({ command, args });
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit("close", 0));
      return child;
    }
  });

  await updater.download();
  const installPromise = updater.install(() => {});
  await updater.cleanupAfterLaunch();
  await installPromise;

  assert.equal(spawnCalls.length, 1);
  assert.ok(spawnCalls[0].args.includes("-File"));
  assert.ok(!spawnCalls[0].args.includes("-Command"));
});

test("waits for in-progress launch cleanup before scheduling an update", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executablePath = path.join(directory, "Campaign Engine Portable.exe");
  await fs.writeFile(executablePath, "old portable executable");
  const payload = Buffer.from("new verified portable executable");
  const manifest = manifestFor(payload);
  const spawnCalls = [];
  let finishCleanup;
  const updater = createPortableUpdater({
    currentVersion: "1.0.0",
    executablePath,
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    fetchImpl: async url => url.endsWith("latest-portable.json")
      ? new Response(JSON.stringify(manifest), { status: 200 })
      : new Response(payload, { status: 200 }),
    spawnImpl: (command, args) => {
      spawnCalls.push({ command, args });
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      if (args.includes("-Command")) finishCleanup = () => child.emit("close", 0);
      else setImmediate(() => child.emit("close", 0));
      return child;
    }
  });

  await updater.download();
  const cleanupPromise = updater.cleanupAfterLaunch();
  const installPromise = updater.install(() => {});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(spawnCalls.length, 1);
  assert.ok(spawnCalls[0].args.includes("-Command"));

  finishCleanup();
  await cleanupPromise;
  await installPromise;
  assert.equal(spawnCalls.length, 2);
  assert.ok(spawnCalls[1].args.includes("-File"));
});

test("does not delete an active portable download during launch cleanup", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executablePath = path.join(directory, "Campaign Engine Portable.exe");
  await fs.writeFile(executablePath, "old portable executable");
  const payload = Buffer.from("new delayed portable executable");
  const manifest = manifestFor(payload);
  let releaseController;
  let releaseRequestedResolve;
  const releaseRequested = new Promise(resolve => {
    releaseRequestedResolve = resolve;
  });

  const updater = createPortableUpdater({
    currentVersion: "1.0.0",
    executablePath,
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    fetchImpl: async url => {
      if (url.endsWith("latest-portable.json")) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      const stream = new ReadableStream({
        start(controller) {
          releaseController = controller;
        }
      });
      releaseRequestedResolve();
      return new Response(stream, { status: 200, headers: { "content-length": String(payload.length) } });
    }
  });

  const downloadPromise = updater.download();
  await releaseRequested;
  await updater.cleanupAfterLaunch();
  releaseController.enqueue(payload);
  releaseController.close();

  const downloaded = await downloadPromise;
  assert.deepEqual(await fs.readFile(downloaded.readyPath), payload);
});

test("rejects a portable download that does not match its manifest", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const expected = Buffer.from("expected portable executable");
  const manifest = manifestFor(expected);
  const updater = createPortableUpdater({
    currentVersion: "1.0.0",
    executablePath: path.join(directory, "Campaign Engine Portable.exe"),
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    fetchImpl: async url => url.endsWith("latest-portable.json")
      ? new Response(JSON.stringify(manifest), { status: 200 })
      : new Response(Buffer.from("tampered portable executable"), { status: 200 })
  });

  await updater.check();
  await assert.rejects(() => updater.download(), /unexpected file size|SHA-512 verification/);
});

test("preserves failed diagnostics and rollback until a successful launch is confirmed", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-portable-update-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executablePath = path.join(directory, "Campaign Engine Portable.exe");
  const backupPath = `${executablePath}.previous`;
  const staging = path.join(directory, "Campaign Engine", "portable-updates", "1.0.9");
  const errorLog = path.join(staging, "portable-update-error.log");
  const successMarker = path.join(staging, "portable-update-success.json");
  await fs.mkdir(staging, { recursive: true });
  await fs.writeFile(executablePath, "current executable");
  await fs.writeFile(backupPath, "rollback executable");
  await fs.writeFile(errorLog, "replacement failed");
  const updater = createPortableUpdater({
    currentVersion: "1.0.9",
    executablePath,
    feedUrl: () => "https://downloads.example.com/releases",
    tempDirectory: directory,
    spawnImpl: () => {
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      setImmediate(() => child.emit("close", 0));
      return child;
    }
  });

  await updater.cleanupAfterLaunch();
  assert.equal(await fs.readFile(errorLog, "utf8"), "replacement failed");
  assert.equal(await fs.readFile(backupPath, "utf8"), "rollback executable");

  await fs.writeFile(successMarker, JSON.stringify({ version: "1.0.9" }));
  await updater.cleanupAfterLaunch();
  await assert.rejects(() => fs.access(staging));
  assert.equal(await fs.readFile(backupPath, "utf8"), "rollback executable");
});
