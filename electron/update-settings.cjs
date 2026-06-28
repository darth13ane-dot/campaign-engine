function normalizeUpdateUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function resolveUpdateSettings({ bundled = {}, saved = {}, defaults = {} } = {}) {
  const bundledUrl = normalizeUpdateUrl(bundled.updateUrl);
  const savedUrl = normalizeUpdateUrl(saved.updateUrl);
  return {
    updateUrl: savedUrl || bundledUrl || normalizeUpdateUrl(defaults.updateUrl),
    autoCheck: typeof saved.autoCheck === "boolean"
      ? saved.autoCheck
      : typeof bundled.autoCheck === "boolean"
        ? bundled.autoCheck
        : defaults.autoCheck !== false
  };
}

module.exports = { normalizeUpdateUrl, resolveUpdateSettings };
