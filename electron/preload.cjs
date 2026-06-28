const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("campaignEngineDesktop", {
  isDesktop: true,
  getUpdateState: () => ipcRenderer.invoke("desktop:get-update-state"),
  saveUpdateSettings: settings => ipcRenderer.invoke("desktop:save-update-settings", settings),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:download-update"),
  installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  openExternal: url => ipcRenderer.invoke("desktop:open-external", url),
  loadWorkspace: () => ipcRenderer.invoke("desktop:workspace-load"),
  initializeWorkspace: workspace => ipcRenderer.invoke("desktop:workspace-initialize", workspace),
  replaceWorkspace: (workspace, reason) => ipcRenderer.invoke("desktop:workspace-replace", workspace, reason),
  saveWorkspaceState: state => ipcRenderer.invoke("desktop:workspace-save-state", state),
  exportWorkspace: () => ipcRenderer.invoke("desktop:workspace-export"),
  importWorkspace: () => ipcRenderer.invoke("desktop:workspace-import"),
  createSafetyBackup: () => ipcRenderer.invoke("desktop:workspace-create-safety-backup"),
  openWorkspaceFolder: () => ipcRenderer.invoke("desktop:workspace-open-folder"),
  onUpdateState: callback => {
    const listener = (_, state) => callback(state);
    ipcRenderer.on("desktop:update-state", listener);
    return () => ipcRenderer.removeListener("desktop:update-state", listener);
  }
});
