const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  compareVersions,
  createPortableUpdater,
  portableInstallerScript,
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

test("generates a replacement helper with rollback and relaunch steps", () => {
  const script = portableInstallerScript();
  assert.match(script, /Copy-Item.+\$backup/);
  assert.match(script, /Move-Item.+\$Source.+\$Target/);
  assert.match(script, /SHA512/);
  assert.match(script, /Start-Process -FilePath \$Target/);
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
      return { unref() {} };
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
  assert.equal(spawnCalls[0].options.detached, true);
  assert.ok(spawnCalls[0].args.includes(executablePath));
  assert.equal(quitCalled, true);
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
