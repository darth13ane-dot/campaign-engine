const fs = require("node:fs/promises");
const path = require("node:path");

const WORKSPACE_SCHEMA_VERSION = 1;

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

  async function writeWorkspace(value, { preservePrevious = true } = {}) {
    await ensureDirectories();
    const workspace = normalizeWorkspace(
      { ...value, appVersion, savedAt: now().toISOString() },
      appVersion
    );
    const temporaryPath = `${workspacePath}.${process.pid}.tmp`;

    if (preservePrevious && await pathExists(workspacePath)) {
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
    const destination = path.join(backupDirectory, `campaign-engine-${safeReason}-${safeTimestamp(now())}.json`);
    await fs.writeFile(destination, `${JSON.stringify(workspace, null, 2)}\n`, "utf8");

    const backups = (await fs.readdir(backupDirectory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
      .map(entry => entry.name)
      .sort()
      .reverse();
    await Promise.all(backups.slice(12).map(name => fs.unlink(path.join(backupDirectory, name)).catch(() => {})));
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
    await createSafetyBackup("before-import");
    return writeWorkspace(incoming);
  }

  async function replaceWorkspace(value, reason = "before-import") {
    const incoming = normalizeWorkspace(value, appVersion);
    await createSafetyBackup(reason);
    return writeWorkspace(incoming);
  }

  async function getInfo() {
    const workspace = await loadWorkspace();
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
