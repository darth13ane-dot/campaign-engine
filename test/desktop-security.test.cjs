const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");
const { EventEmitter } = require("node:events");
const { createDesktopSecurity, normalizeExternalUrl, confirmCustomBridge } = require("../electron/desktop-security.cjs");
const root = path.resolve(__dirname, "..");
const entryPath = path.join(root, "index.html");
const entryUrl = pathToFileURL(entryPath).href;

function fixture() {
  const handles = new Map(), events = new Map(), opened = [];
  const contents = new EventEmitter();
  contents.mainFrame = { url: entryUrl };
  contents.isDestroyed = () => false;
  contents.setWindowOpenHandler = fn => { contents.openWindow = fn; };
  contents.session = {
    setPermissionRequestHandler: fn => { contents.permissionRequest = fn; },
    setPermissionCheckHandler: fn => { contents.permissionCheck = fn; },
    setDevicePermissionHandler: fn => { contents.devicePermission = fn; }
  };
  const window = { webContents: contents, isDestroyed: () => false };
  const ipcMain = { handle: (name, fn) => handles.set(name, fn), on: (name, fn) => events.set(name, fn) };
  const shell = { openExternal: async url => { opened.push(url); } };
  const security = createDesktopSecurity({ getWindow: () => window, entryPath, ipcMain, shell });
  return { security, window, contents, ipcMain, shell, handles, events, opened, event: { sender: contents, senderFrame: contents.mainFrame } };
}

test("desktop authority belongs to the exact application main frame, including hash routes", () => {
  const f = fixture();
  assert.equal(f.security.isTrustedSender(f.event), true);
  f.contents.mainFrame.url = entryUrl + "#session-prep";
  assert.equal(f.security.isTrustedSender(f.event), true);
  for (const url of ["https://example.com/", "about:blank", "about:srcdoc", entryUrl + "?replacement=1", entryUrl + ".html", pathToFileURL(path.join(root, "other.html")).href]) {
    f.contents.mainFrame.url = url;
    assert.equal(f.security.isTrustedSender(f.event), false, url);
  }
  f.contents.mainFrame.url = entryUrl;
  assert.equal(f.security.isTrustedSender({ ...f.event, senderFrame: { url: entryUrl } }), false, "same-address child frame");
  assert.equal(f.security.isTrustedSender({ ...f.event, sender: {} }), false, "another window");
  assert.equal(f.security.isTrustedSender({ ...f.event, senderFrame: null }), false);
  f.window.isDestroyed = () => true;
  assert.equal(f.security.isTrustedSender(f.event), false);
});

test("all registered desktop handlers reject foreign windows, child frames, and navigated pages before doing work", async () => {
  const f = fixture();
  const mainFile = path.join(root, "electron/main.cjs");
  const realRequire = createRequire(mainFile);
  const electron = { ipcMain: f.ipcMain, shell: f.shell, app: { getVersion: () => "test", requestSingleInstanceLock: () => true, whenReady: () => ({ then() {} }), on() {} } };
  const context = vm.createContext({
    require: name => name === "electron" ? electron : name === "electron-updater" ? { autoUpdater: { on() {} } } : realRequire(name),
    __dirname: path.dirname(mainFile), process, console, fixtureWindow: f.window
  });
  vm.runInContext(fs.readFileSync(mainFile, "utf8"), context);
  vm.runInContext("mainWindow = fixtureWindow", context);
  const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
  const channels = [...preload.matchAll(/ipcRenderer\.invoke\("([^"]+)"/g)].map(match => match[1]);
  assert.equal(f.handles.size, channels.length);
  const invalid = [
    { sender: {}, senderFrame: f.contents.mainFrame },
    { sender: f.contents, senderFrame: { url: entryUrl } },
    { sender: f.contents, senderFrame: null }
  ];
  for (const channel of channels) {
    for (const event of invalid) await assert.rejects(async () => f.handles.get(channel)(event), /only from the Campaign Engine/);
    f.contents.mainFrame.url = "https://example.com/";
    await assert.rejects(async () => f.handles.get(channel)(f.event), /only from the Campaign Engine/);
    f.contents.mainFrame.url = entryUrl;
  }
  assert.equal(f.handles.get("desktop:get-update-state")(f.event).currentVersion, "test");
  let dirty = 0, closed = 0;
  context.closeGuard = { setDirty: () => dirty++, finish: async () => closed++ };
  vm.runInContext("workspaceCloseGuard = closeGuard", context);
  for (const listener of f.events.values()) for (const event of invalid) listener(event, true);
  assert.deepEqual([dirty, closed], [0, 0]);
  f.events.get("desktop:workspace-dirty")(f.event, true);
  f.events.get("desktop:workspace-close-ready")(f.event, { ok: true });
  assert.deepEqual([dirty, closed], [1, 1]);
});

test("desktop navigation and permission rules preserve the app and isolated packet preview", async () => {
  const f = fixture();
  f.security.secureWindow(f.window);
  function prevented(name, fields, url) {
    let blocked = false;
    f.contents.emit(name, { ...fields, preventDefault() { blocked = true; } }, url);
    return blocked;
  }
  assert.equal(prevented("will-navigate", {}, entryUrl), false);
  assert.equal(prevented("will-navigate", {}, entryUrl + "#dashboard"), false);
  assert.equal(prevented("will-navigate", {}, "https://example.com/"), true);
  assert.equal(prevented("will-redirect", {}, "https://example.com/"), true);
  assert.equal(prevented("will-frame-navigate", { url: "https://example.com/", isMainFrame: false }), true);
  assert.equal(prevented("will-frame-navigate", { url: entryUrl, isMainFrame: false }), true);
  assert.equal(prevented("will-frame-navigate", { url: "about:srcdoc", isMainFrame: false }), false);
  assert.equal(prevented("will-frame-navigate", { url: "about:srcdoc", isMainFrame: true }), true);
  assert.equal(prevented("will-attach-webview", {}), true);
  for (const permission of ["media", "geolocation", "notifications", "clipboard-read", "display-capture"]) {
    let approved;
    f.contents.permissionRequest(f.contents, permission, value => { approved = value; });
    assert.equal(approved, false, permission);
    assert.equal(f.contents.permissionCheck(f.contents, permission, "file://"), false);
  }
  assert.equal(f.contents.devicePermission({ deviceType: "usb" }), false);
  assert.deepEqual(f.contents.openWindow({ url: "javascript:alert(1)" }), { action: "deny" });
  assert.deepEqual(f.contents.openWindow({ url: "https://example.com/guide" }), { action: "deny" });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.opened, ["https://example.com/guide"]);
});

test("external links accept web addresses and reject executable schemes, credentials, and control characters", () => {
  for (const value of ["file:///C:/Windows/System32/cmd.exe", "javascript:alert(1)", "data:text/html,test", "ms-settings:privacy", "https://user:secret@example.com/", "https://example.com/\n", {}, null]) assert.equal(normalizeExternalUrl(value), "");
  assert.equal(normalizeExternalUrl("https://example.com/guide?q=1#section"), "https://example.com/guide?q=1#section");
  assert.equal(normalizeExternalUrl("http://127.0.0.1:30000/"), "http://127.0.0.1:30000/");
});

test("custom connection launch requires native approval of the exact program and arguments", async () => {
  const prompts = [];
  const dialog = { showMessageBox: async (_window, options) => { prompts.push(options); return { response: 0 }; } };
  const window = {};
  await confirmCustomBridge({ settings: { command: "archivist", args: [] }, dialog, window });
  assert.equal(prompts.length, 0);
  const settings = { command: "node", args: ["C:\\My Tools\\connection.cjs", "--mode=read"] };
  await assert.rejects(confirmCustomBridge({ settings, dialog, window }), /canceled.*No program/);
  assert.equal(prompts[0].defaultId, 0);
  assert.equal(prompts[0].cancelId, 0);
  assert(prompts[0].detail.includes(JSON.stringify({ program: settings.command, arguments: settings.args }, null, 2)));
  dialog.showMessageBox = async () => ({ response: 1 });
  await confirmCustomBridge({ settings, dialog, window });
  await assert.rejects(confirmCustomBridge({ settings: { command: "node", args: ["x".repeat(9000)] }, dialog, window }), /too long to review/);
});

test("HTML entry point applies script restrictions before any executable or external resource", () => {
  const html = fs.readFileSync(entryPath, "utf8");
  const policyTag = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert(policyTag);
  assert(html.indexOf(policyTag[0]) < html.indexOf("<link"));
  const directives = Object.fromEntries(policyTag[1].split(";").map(value => value.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
  assert.deepEqual(directives["script-src"], ["'self'", "'wasm-unsafe-eval'"]);
  assert.deepEqual(directives["object-src"], ["'none'"]);
  assert.deepEqual(directives["base-uri"], ["'none'"]);
  assert.deepEqual(directives["form-action"], ["'none'"]);
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), "inline scripts would violate the policy");
  assert(!/\son[a-z]+\s*=/i.test(html), "inline event handlers would violate the policy");
});
