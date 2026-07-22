const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const { createCredentialStore, FOUNDRY_CREDENTIAL_FILE } = require("./credential-store.cjs");
const { createPortableUpdater } = require("./portable-updater.cjs");
const { normalizeUpdateUrl, resolveUpdateSettings } = require("./update-settings.cjs");
const { createWorkspaceStore } = require("./workspace-store.cjs");
const { normalizeBridgeSettings, syncArchivistBridge, testArchivistBridge } = require("./archivist-mcp-bridge.cjs");

let mainWindow;
let updateSettings = { updateUrl: "", autoCheck: true };
let updateState = { status: "ready", version: app.getVersion(), currentVersion: app.getVersion(), message: "No update feed configured." };
let archivistBridgeSettings = normalizeBridgeSettings();
let updateTimer;
let updateStartupTimer;
let workspaceStore;
let credentialStore;
let foundryCredentialStore;
let portableUpdater;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function settingsPath() {
  return path.join(app.getPath("userData"), "update-settings.json");
}

function archivistBridgePath() {
  return path.join(app.getPath("userData"), "archivist-nexus-bridge.json");
}

function releaseConfig() {
  const candidates = ["release-config.generated.json", "release-config.json"];
  for (const name of candidates) {
    try {
      return JSON.parse(fs.readFileSync(path.join(app.getAppPath(), name), "utf8"));
    } catch {
      // A local build does not need a preconfigured public update feed.
    }
  }
  return {};
}

function loadUpdateSettings() {
  const bundled = releaseConfig();
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(settingsPath(), "utf8"));
  } catch {
    // First launch has no settings yet.
  }
  updateSettings = resolveUpdateSettings({ bundled, saved, defaults: updateSettings });
}

function saveUpdateSettings(nextSettings) {
  updateSettings = { ...updateSettings, ...nextSettings };
  fs.writeFileSync(settingsPath(), JSON.stringify(updateSettings, null, 2));
  return updateSettings;
}

function loadArchivistBridgeSettings() {
  try {
    archivistBridgeSettings = normalizeBridgeSettings(JSON.parse(fs.readFileSync(archivistBridgePath(), "utf8")));
  } catch {
    archivistBridgeSettings = normalizeBridgeSettings();
  }
}

function saveArchivistBridgeSettings(settings) {
  archivistBridgeSettings = normalizeBridgeSettings(settings, archivistBridgeSettings);
  fs.writeFileSync(archivistBridgePath(), JSON.stringify(archivistBridgeSettings, null, 2));
  return archivistBridgeSettings;
}

function archivistBridgeState(extra = {}) {
  return {
    ...extra,
    settings: { ...archivistBridgeSettings, toolArguments: typeof archivistBridgeSettings.toolArguments === "string" ? archivistBridgeSettings.toolArguments : JSON.stringify(archivistBridgeSettings.toolArguments, null, 2) }
  };
}

function sendUpdateState(nextState) {
  updateState = { ...updateState, ...nextState, currentVersion: app.getVersion(), portable: isPortableBuild(), settings: { ...updateSettings } };
  mainWindow?.webContents.send("desktop:update-state", updateState);
}

function validUpdateUrl(value) {
  return Boolean(normalizeUpdateUrl(value));
}

function isPortableBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
}

function scheduleUpdateChecks(checkOnStart = false) {
  clearTimeout(updateStartupTimer);
  clearInterval(updateTimer);
  updateStartupTimer = undefined;
  updateTimer = undefined;
  if (!updateSettings.autoCheck || !validUpdateUrl(updateSettings.updateUrl)) return;
  if (checkOnStart) updateStartupTimer = setTimeout(() => checkForUpdates(), 4000);
  updateTimer = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    sendUpdateState({ status: "development", message: "Update checks are available in the installed Windows build." });
    return updateState;
  }
  if (!validUpdateUrl(updateSettings.updateUrl)) {
    sendUpdateState({ status: "not-configured", message: "Add a release-feed URL to enable desktop updates." });
    return updateState;
  }

  try {
    if (isPortableBuild()) {
      await portableUpdater.check();
      return updateState;
    }
    autoUpdater.setFeedURL({ provider: "generic", url: updateSettings.updateUrl.replace(/\/+$/, "") });
    sendUpdateState({ status: "checking", message: "Checking the release feed…" });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    sendUpdateState({ status: "error", message: error.message || "Unable to check for updates." });
  }
  return updateState;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#11141d",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (validUpdateUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on("checking-for-update", () => sendUpdateState({ status: "checking", message: "Checking the release feed…" }));
autoUpdater.on("update-available", info => sendUpdateState({ status: "available", version: info.version, message: `Version ${info.version} is ready to download.` }));
autoUpdater.on("update-not-available", () => sendUpdateState({ status: "up-to-date", message: "Campaign Engine is up to date." }));
autoUpdater.on("download-progress", progress => sendUpdateState({ status: "downloading", percent: Math.round(progress.percent), message: `Downloading update: ${Math.round(progress.percent)}%` }));
autoUpdater.on("update-downloaded", info => sendUpdateState({ status: "downloaded", version: info.version, message: `Version ${info.version} is ready to install.` }));
autoUpdater.on("error", error => sendUpdateState({ status: "error", message: error.message || "Desktop update failed." }));

ipcMain.handle("desktop:get-update-state", () => ({ ...updateState, currentVersion: app.getVersion(), portable: isPortableBuild(), settings: { ...updateSettings } }));
ipcMain.handle("desktop:save-update-settings", (_, settings) => {
  const updateUrl = String(settings?.updateUrl || "").trim();
  if (updateUrl && !validUpdateUrl(updateUrl)) throw new Error("Use an HTTPS release-feed URL.");
  saveUpdateSettings({ updateUrl: normalizeUpdateUrl(updateUrl), autoCheck: Boolean(settings?.autoCheck) });
  scheduleUpdateChecks();
  sendUpdateState({ status: updateUrl ? "ready" : "not-configured", message: updateUrl ? "Release feed saved." : "No update feed configured." });
  return { ...updateState, settings: { ...updateSettings } };
});
ipcMain.handle("desktop:check-for-updates", () => checkForUpdates());
ipcMain.handle("desktop:download-update", async () => {
  try {
    if (isPortableBuild()) await portableUpdater.download();
    else await autoUpdater.downloadUpdate();
    return updateState;
  } catch (error) {
    sendUpdateState({ status: "error", message: error.message || "Desktop update download failed." });
    throw error;
  }
});
ipcMain.handle("desktop:install-update", async () => {
  try {
    if (isPortableBuild()) return await portableUpdater.install(() => app.quit());
    return autoUpdater.quitAndInstall(false, true);
  } catch (error) {
    sendUpdateState({ status: "error", message: error.message || "Desktop update installation failed." });
    throw error;
  }
});
ipcMain.handle("desktop:open-external", (_, url) => {
  if (!validUpdateUrl(url)) throw new Error("Only http and https links can be opened outside Campaign Engine.");
  return shell.openExternal(url);
});
ipcMain.handle("desktop:workspace-load", async () => ({
  workspace: await workspaceStore.loadWorkspace(),
  info: await workspaceStore.getInfo()
}));
ipcMain.handle("desktop:workspace-initialize", async (_, workspace) => {
  const saved = await workspaceStore.initializeWorkspace(workspace);
  return { workspace: saved, info: await workspaceStore.getInfo() };
});
ipcMain.handle("desktop:workspace-replace", async (_, workspace, reason) => {
  const saved = await workspaceStore.replaceWorkspace(workspace, reason || "before-replace");
  return { workspace: saved, info: await workspaceStore.getInfo() };
});
ipcMain.handle("desktop:workspace-save-state", async (_, state) => {
  await workspaceStore.saveState(state);
  return workspaceStore.getInfo();
});
ipcMain.handle("desktop:workspace-export", async () => {
  const date = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Back up Campaign Engine",
    defaultPath: path.join(app.getPath("documents"), `Campaign Engine Backup ${date}.json`),
    filters: [{ name: "Campaign Engine backup", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  await workspaceStore.exportWorkspace(result.filePath);
  return { canceled: false, filePath: result.filePath, info: await workspaceStore.getInfo() };
});
ipcMain.handle("desktop:workspace-import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Restore a Campaign Engine backup",
    properties: ["openFile"],
    filters: [{ name: "Campaign Engine backup", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  const workspace = await workspaceStore.importWorkspace(result.filePaths[0]);
  return { canceled: false, workspace, info: await workspaceStore.getInfo() };
});
ipcMain.handle("desktop:workspace-create-safety-backup", async () => {
  const filePath = await workspaceStore.createSafetyBackup("manual");
  return { filePath, info: await workspaceStore.getInfo() };
});
ipcMain.handle("desktop:workspace-open-folder", async () => {
  const error = await shell.openPath(app.getPath("userData"));
  if (error) throw new Error(error);
  return workspaceStore.getInfo();
});
ipcMain.handle("desktop:api-key-load", () => credentialStore.loadApiKey());
ipcMain.handle("desktop:api-key-save", (_, apiKey) => credentialStore.saveApiKey(apiKey));
ipcMain.handle("desktop:api-key-clear", () => credentialStore.clearApiKey());
ipcMain.handle("desktop:foundry-api-key-load", () => foundryCredentialStore.loadApiKey());
ipcMain.handle("desktop:foundry-api-key-save", (_, apiKey) => foundryCredentialStore.saveApiKey(apiKey));
ipcMain.handle("desktop:foundry-api-key-clear", () => foundryCredentialStore.clearApiKey());
ipcMain.handle("desktop:archivist-bridge-state", () => archivistBridgeState({ status: archivistBridgeSettings.command ? "configured" : "not-configured" }));
ipcMain.handle("desktop:archivist-bridge-save", (_, settings) => archivistBridgeState({ status: "saved", settings: saveArchivistBridgeSettings(settings) }));
ipcMain.handle("desktop:archivist-bridge-test", async (_, settings) => {
  const nextSettings = saveArchivistBridgeSettings(settings || archivistBridgeSettings);
  const result = await testArchivistBridge(nextSettings);
  archivistBridgeSettings = saveArchivistBridgeSettings({ ...nextSettings, lastStatus: `Connected${result.tools.length ? ` · ${result.tools.length} tool${result.tools.length === 1 ? "" : "s"}` : ""}` });
  return archivistBridgeState({ status: "connected", result });
});
ipcMain.handle("desktop:archivist-bridge-sync", async (_, settings) => {
  const nextSettings = saveArchivistBridgeSettings(settings || archivistBridgeSettings);
  const result = await syncArchivistBridge(nextSettings);
  const lastStatus = result.mode === "archivist-native"
    ? `Synced ${result.campaignCount} Archivist campaign${result.campaignCount === 1 ? "" : "s"}`
    : "Custom import tool completed";
  archivistBridgeSettings = saveArchivistBridgeSettings({ ...nextSettings, lastStatus, lastSync: new Date().toISOString() });
  return archivistBridgeState({ status: "synced", payload: result.payload, result });
});

app.whenReady().then(() => {
  workspaceStore = createWorkspaceStore({
    directory: app.getPath("userData"),
    appVersion: app.getVersion()
  });
  credentialStore = createCredentialStore({
    directory: app.getPath("userData"),
    safeStorage
  });
  foundryCredentialStore = createCredentialStore({
    directory: app.getPath("userData"),
    safeStorage,
    fileName: FOUNDRY_CREDENTIAL_FILE,
    credentialName: "Foundry API key"
  });
  loadUpdateSettings();
  loadArchivistBridgeSettings();
  if (isPortableBuild()) {
    portableUpdater = createPortableUpdater({
      currentVersion: app.getVersion(),
      executablePath: path.resolve(process.env.PORTABLE_EXECUTABLE_FILE),
      feedUrl: () => updateSettings.updateUrl,
      tempDirectory: app.getPath("temp"),
      onState: sendUpdateState
    });
    setTimeout(() => portableUpdater.cleanupAfterLaunch().catch(error => {
      console.warn("Portable update cleanup did not complete.", error);
    }), 15000);
  }
  createWindow();
  scheduleUpdateChecks(true);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  clearTimeout(updateStartupTimer);
  clearInterval(updateTimer);
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});
