const fs = require("node:fs/promises");
const path = require("node:path");

const { WORKSPACE_SCHEMA_VERSION, UNSUPPORTED_SCHEMA, assertState, normalizeWorkspace, summary } = require("../workspace-schema.js");

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function createWorkspaceStore({ directory, appVersion, now = () => new Date() }) {
  if (!directory) throw new Error("A workspace directory is required.");

  const workspacePath = path.join(directory, "campaign-engine-workspace.json");
  const previousPath = path.join(directory, "campaign-engine-workspace.previous.json");
  const backupDirectory = path.join(directory, "backups");
  let recoveredFromPrevious = false;

  async function ensureDirectories() {
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(backupDirectory, { recursive: true });
  }

  async function assertPreviousSchemaSupported() {
    try {
      normalizeWorkspace(await readJson(previousPath), appVersion);
    } catch (error) {
      if (error.code === UNSUPPORTED_SCHEMA) {
        error.message = `The previous workspace backup (${previousPath}) is protected. ${error.message} Use a compatible app, or move that backup to a safe location before retrying.`;
        throw error;
      }
      // A missing or damaged previous copy can be replaced by the valid primary.
      if (error.code && !["ENOENT", "INVALID_WORKSPACE_DATA"].includes(error.code)) throw error;
    }
  }

  async function writeWorkspace(value, { preservePrevious = true } = {}) {
    await ensureDirectories();
    const workspace = normalizeWorkspace(
      { ...value, appVersion, savedAt: now().toISOString() },
      appVersion
    );
    const temporaryPath = `${workspacePath}.${process.pid}.tmp`;

    if (preservePrevious && await pathExists(workspacePath)) {
      await assertPreviousSchemaSupported();
      await fs.copyFile(workspacePath, previousPath);
    }

    await fs.writeFile(temporaryPath, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
    try {
      await fs.rename(temporaryPath, workspacePath);
    } catch (error) {
      if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
      await fs.unlink(workspacePath).catch(() => {});
      await fs.rename(temporaryPath, workspacePath);
    }
    return workspace;
  }

  async function recoverPreviousWorkspace(primaryError) {
    if (!await pathExists(previousPath)) throw primaryError;
    const recovered = normalizeWorkspace(await readJson(previousPath), appVersion);
    const corruptPath = path.join(directory, `campaign-engine-workspace.corrupt-${safeTimestamp(now())}.json`);
    try {
      await fs.rename(workspacePath, corruptPath);
    } catch {
      // Keep going if the damaged file disappeared between the read and recovery.
    }
    await fs.copyFile(previousPath, workspacePath);
    recoveredFromPrevious = true;
    return { ...recovered, recoveredFromPrevious: true };
  }

  async function loadWorkspace() {
    await ensureDirectories();
    if (!await pathExists(workspacePath)) return null;
    try {
      return normalizeWorkspace(await readJson(workspacePath), appVersion);
    } catch (error) {
      // A newer workspace is valid data for another app version, so leave both files intact.
      if (error.code === UNSUPPORTED_SCHEMA) throw error;
      return recoverPreviousWorkspace(error);
    }
  }

  async function initializeWorkspace(value) {
    const existing = await loadWorkspace();
    if (existing) return existing;
    return writeWorkspace(value, { preservePrevious: false });
  }

  async function saveState(state) {
    assertState(state);
    const existing = await loadWorkspace();
    return writeWorkspace({
      ...(existing || {}),
      state,
      archivist: existing?.archivist || {}
    });
  }

  async function createSafetyBackup(reason = "manual") {
    const workspace = await loadWorkspace();
    if (!workspace) return null;
    await ensureDirectories();
    const safeReason = String(reason).replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "manual";
    const createdAt = now();
    const basename = `campaign-engine-${safeReason}-${safeTimestamp(createdAt)}`;
    const content = `${JSON.stringify({ ...workspace, backupCreatedAt: createdAt.toISOString() }, null, 2)}\n`;
    let destination;
    for (let suffix = 0; ; suffix++) {
      destination = path.join(backupDirectory, `${basename}${suffix ? `-${suffix}` : ""}.json`);
      try {
        await fs.writeFile(destination, content, { encoding: "utf8", flag: "wx" });
        break;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }

    const entries = (await fs.readdir(backupDirectory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && /^campaign-engine-.+\.json$/.test(entry.name));
    const backups = (await Promise.all(entries.map(async entry => {
      const backupPath = path.join(backupDirectory, entry.name);
      try {
        const backup = await readJson(backupPath);
        normalizeWorkspace(backup, appVersion);
        // Legacy copies carry their creation time in the filename; savedAt describes the workspace edit.
        const legacy = entry.name.match(/-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z(?:-\d+)?\.json$/);
        const legacyCreatedAt = legacy ? `${legacy[1]}T${legacy[2]}:${legacy[3]}:${legacy[4]}.${legacy[5]}Z` : "";
        let timestamp = [backup.backupCreatedAt, legacyCreatedAt, backup.savedAt].map(value => Date.parse(value)).find(Number.isFinite);
        if (timestamp === undefined) timestamp = (await fs.stat(backupPath)).mtimeMs;
        return { name: entry.name, path: backupPath, timestamp };
      } catch {
        // Leave unreadable, damaged, and unsupported-version files available for manual recovery.
        return null;
      }
    }))).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp
      || Number(b.path === destination) - Number(a.path === destination)
      || b.name.localeCompare(a.name, undefined, { numeric: true }));
    await Promise.all(backups.slice(12).map(backup => fs.unlink(backup.path).catch(() => {})));
    return destination;
  }

  async function exportWorkspace(destination) {
    const workspace = await loadWorkspace();
    if (!workspace) throw new Error("There is no desktop workspace to back up yet.");
    await fs.writeFile(destination, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");
    return destination;
  }

  async function importWorkspace(source) {
    const incoming = normalizeWorkspace(await readJson(source), appVersion);
    await assertPreviousSchemaSupported();
    await createSafetyBackup("before-import");
    return writeWorkspace(incoming);
  }

  async function replaceWorkspace(value, reason = "before-import") {
    const incoming = normalizeWorkspace(value, appVersion);
    await assertPreviousSchemaSupported();
    try { await createSafetyBackup(reason); }
    catch (error) {
      if (reason !== "reviewed-restore" || !(error instanceof SyntaxError || error.code === "INVALID_WORKSPACE_DATA")) throw error;
      // An explicitly reviewed recovery can replace damaged data after preserving
      // the exact original bytes. Future schemas and I/O failures stay protected.
      for (const [label, source] of [["primary", workspacePath], ["previous", previousPath]]) {
        if (!await pathExists(source)) continue;
        const raw = await fs.readFile(source);
        try { normalizeWorkspace(JSON.parse(raw.toString("utf8")), appVersion); }
        catch (sourceError) { if (sourceError.code === UNSUPPORTED_SCHEMA) throw sourceError; }
        const preserved = path.join(backupDirectory, `campaign-engine-preserved-${label}-${safeTimestamp(now())}-${require("node:crypto").randomUUID()}.json`);
        await fs.writeFile(preserved, raw, { flag: "wx" });
      }
      return writeWorkspace(incoming, { preservePrevious: false });
    }
    return writeWorkspace(incoming);
  }

  async function readWorkspaceBackup(id) {
    if (typeof id !== "string" || (id !== "previous" && (path.basename(id) !== id || !/^campaign-engine-[a-z0-9.-]+\.json$/i.test(id)))) throw new Error("Choose a listed workspace recovery copy.");
    const source = id === "previous" ? previousPath : path.join(backupDirectory, id);
    if (!(await fs.lstat(source)).isFile()) throw new Error("This recovery copy is not a regular file.");
    return normalizeWorkspace(await readJson(source), appVersion);
  }

  async function listWorkspaceBackups() {
    await ensureDirectories();
    const ids = (await fs.readdir(backupDirectory, { withFileTypes: true })).filter(entry => entry.isFile() && /^campaign-engine-[a-z0-9.-]+\.json$/i.test(entry.name)).map(entry => entry.name);
    if (await pathExists(previousPath)) ids.push("previous");
    const copies = await Promise.all(ids.map(async id => {
      const source = id === "previous" ? previousPath : path.join(backupDirectory, id);
      const reason = id.replace(/^campaign-engine-/, "").replace(/-\d{4}-\d{2}-\d{2}T.*$/, "").replace(/\.json$/, "");
      const labels = { previous: "Previous automatic save", manual: "Manual safety copy", "reviewed-restore": "Before workspace restore", "before-import": "Before backup import", "before-delete-campaign": "Before campaign deletion", "before-archivist-bridge": "Before Archivist import", "preserved-primary": "Preserved primary file", "preserved-previous": "Preserved previous file" };
      const label = labels[reason] || reason.replace(/-/g, " ");
      const info = { id, label, timestamp: (await fs.stat(source)).mtimeMs };
      try {
        const workspace = await readWorkspaceBackup(id), raw = await readJson(source);
        return { ...info, savedAt: raw.backupCreatedAt || workspace.savedAt, summary: summary(workspace) };
      } catch (error) { return { ...info, error: error.message }; }
    }));
    return copies.sort((left, right) => right.timestamp - left.timestamp).map(({ timestamp, ...copy }) => copy);
  }

  async function getInfo(workspace) {
    if (workspace === undefined) workspace = await loadWorkspace();
    return {
      mode: "desktop",
      workspacePath,
      backupDirectory,
      exists: Boolean(workspace),
      savedAt: workspace?.savedAt || null,
      recoveredFromPrevious
    };
  }

  return {
    workspacePath,
    backupDirectory,
    loadWorkspace,
    initializeWorkspace,
    saveState,
    createSafetyBackup,
    exportWorkspace,
    importWorkspace,
    replaceWorkspace,
    listWorkspaceBackups,
    readWorkspaceBackup,
    getInfo
  };
}

module.exports = {
  WORKSPACE_SCHEMA_VERSION,
  assertState,
  normalizeWorkspace,
  createWorkspaceStore
};
