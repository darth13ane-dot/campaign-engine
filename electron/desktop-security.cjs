const { pathToFileURL } = require("node:url");

function normalizeExternalUrl(value) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return "";
  try {
    const url = new URL(value.trim());
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch { return ""; }
}

function createDesktopSecurity({ getWindow, entryPath, ipcMain, shell }) {
  const entryUrl = pathToFileURL(entryPath).href;
  function isApplicationUrl(value) {
    try {
      const url = new URL(value);
      url.hash = "";
      return url.href === entryUrl;
    } catch { return false; }
  }
  function isTrustedSender(event) {
    try {
      const window = getWindow();
      const contents = window?.webContents;
      return Boolean(window && !window.isDestroyed() && contents && !contents.isDestroyed()
        && event?.sender === contents && event.senderFrame
        && event.senderFrame === contents.mainFrame && isApplicationUrl(event.senderFrame.url));
    } catch { return false; }
  }
  function assertTrustedSender(event) {
    if (!isTrustedSender(event)) throw new Error("Desktop access is available only from the Campaign Engine application window.");
  }
  function handle(channel, listener) {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event);
      return listener(event, ...args);
    });
  }
  function on(channel, listener) {
    ipcMain.on(channel, (event, ...args) => {
      if (isTrustedSender(event)) listener(event, ...args);
    });
  }
  function openExternal(value) {
    const url = normalizeExternalUrl(value);
    if (!url) throw new Error("Use an HTTP or HTTPS web address without embedded credentials.");
    return shell.openExternal(url);
  }
  function secureWindow(window) {
    const contents = window.webContents;
    contents.on("will-navigate", (event, url) => { if (!isApplicationUrl(url)) event.preventDefault(); });
    contents.on("will-redirect", (event, url) => { if (!isApplicationUrl(url)) event.preventDefault(); });
    contents.on("will-frame-navigate", event => {
      // Embedded GM and player packets are sandboxed, script-free documents.
      const allowed = event.isMainFrame ? isApplicationUrl(event.url) : event.url === "about:srcdoc";
      if (!allowed) event.preventDefault();
    });
    contents.on("will-attach-webview", event => event.preventDefault());
    contents.setWindowOpenHandler(({ url }) => {
      if (normalizeExternalUrl(url)) {
        Promise.resolve().then(() => openExternal(url)).catch(() => {
          if (!contents.isDestroyed()) contents.send("desktop:external-link-error", "The web address could not be opened. Check your default browser and try again.");
        });
      }
      return { action: "deny" };
    });
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    contents.session.setPermissionCheckHandler(() => false);
    contents.session.setDevicePermissionHandler(() => false);
  }
  return { handle, on, isApplicationUrl, isTrustedSender, assertTrustedSender, secureWindow, openExternal };
}

async function confirmCustomBridge({ settings, dialog, window }) {
  if (settings.command === "archivist") return;
  if (!settings.command) throw new Error("Choose the built-in Archivist connection or configure a custom connection first.");
  const launchDescription = JSON.stringify({ program: settings.command, arguments: settings.args }, null, 2);
  if (launchDescription.length > 8000) throw new Error("The custom connection command is too long to review. Shorten its arguments before running it.");
  const result = await dialog.showMessageBox(window, {
    type: "warning",
    title: "Run a custom connection?",
    message: "This connection starts a program on your computer.",
    detail: `Run it only if you trust this program and its arguments. It can read and change files with your Windows account's access.\n\n${launchDescription}`,
    buttons: ["Cancel", "Run this connection"],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  });
  if (result.response !== 1) throw new Error("Custom connection canceled. No program was started.");
}

module.exports = { createDesktopSecurity, normalizeExternalUrl, confirmCustomBridge };
