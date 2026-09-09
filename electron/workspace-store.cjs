const fs = require("node:fs/promises");
const path = require("node:path");

const WORKSPACE_SCHEMA_VERSION = 1;
const UNSUPPORTED_SCHEMA = "UNSUPPORTED_WORKSPACE_SCHEMA";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertState(state) {
  if (!isObject(state) || !Array.isArray(state.campaigns)) {
    throw new Error("This file does not contain a valid Campaign Engine workspace.");
  }
  if (state.campaigns.some(campaign => !isObject(campaign))) {
    throw new Error("One or more campaign records in this workspace are invalid.");
  }
  return state;
}

function normalizeWorkspace(value, appVersion, savedAt = new Date().toISOString()) {
  const version = isObject(value) ? value.schemaVersion : undefined;
  if (version != null && (!Number.isInteger(Number(version)) || Number(version) < 0 || Number(version) > WORKSPACE_SCHEMA_VERSION)) {
    const error = new Error(Number(version) > WORKSPACE_SCHEMA_VERSION
      ? `This workspace uses schema version ${version}, which requires a newer Campaign Engine version. This app supports workspace schema ${WORKSPACE_SCHEMA_VERSION}.`
      : `This workspace uses an unsupported schema version. This app supports workspace schema ${WORKSPACE_SCHEMA_VERSION}.`);
    error.code = UNSUPPORTED_SCHEMA;
    throw error;
  }
  const source = isObject(value) && isObject(value.state)
    ? value
    : { state: value };
  const state = assertState(source.state);
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    appVersion: String(source.appVersion || appVersion || "0.0.0"),
    savedAt: String(source.savedAt || savedAt),
    state,
    archivist: isObject(source.archivist) ? source.archivist : {}
  };
}

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
      if (error.code && error.code !== "ENOENT") throw error;
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
    await createSafetyBackup(reason);
    return writeWorkspace(incoming);
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
    getInfo
  };
}

module.exports = {
  WORKSPACE_SCHEMA_VERSION,
  assertState,
  normalizeWorkspace,
  createWorkspaceStore
};
