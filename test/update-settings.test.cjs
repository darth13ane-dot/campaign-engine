const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeUpdateUrl, resolveUpdateSettings } = require("../electron/update-settings.cjs");

test("uses a newly bundled release feed when an older saved feed is empty", () => {
  const settings = resolveUpdateSettings({
    bundled: { updateUrl: "https://github.com/example/campaign-engine/releases/latest/download/" },
    saved: { updateUrl: "", autoCheck: true },
    defaults: { autoCheck: true }
  });

  assert.equal(settings.updateUrl, "https://github.com/example/campaign-engine/releases/latest/download");
  assert.equal(settings.autoCheck, true);
});

test("accepts HTTPS feeds and local HTTP development feeds only", () => {
  assert.equal(normalizeUpdateUrl("https://downloads.example.com/app/"), "https://downloads.example.com/app");
  assert.equal(normalizeUpdateUrl("http://127.0.0.1:8080/releases/"), "http://127.0.0.1:8080/releases");
  assert.equal(normalizeUpdateUrl("http://downloads.example.com/app"), "");
});

test("preserves a valid user override and automatic-check preference", () => {
  const settings = resolveUpdateSettings({
    bundled: { updateUrl: "https://downloads.example.com/stable" },
    saved: { updateUrl: "https://downloads.example.com/beta", autoCheck: false }
  });

  assert.equal(settings.updateUrl, "https://downloads.example.com/beta");
  assert.equal(settings.autoCheck, false);
});
