(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./workspace-schema.js") : root.CampaignWorkspaceSchema);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignBrowserWorkspace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (SCHEMA) {
  "use strict";
  const DATABASE = "campaign-engine-workspace", PRIMARY = "campaign-engine-v1", RECOVERY = "campaign-engine-recovery-v1";
  // Older app versions reject this marker instead of opening an obsolete copy.
  const MARKER = JSON.stringify({ schemaVersion: 2, browserStorage: "IndexedDB", database: DATABASE, migratedBy: "1.12.0" });
  const error = (code, message) => Object.assign(new Error(message), { code });
  const conflict = () => error("BROWSER_WORKSPACE_CONFLICT", "Another tab or an older app changed the saved workspace. Download your current work, then reload the saved workspace before editing again.");
  const parse = raw => raw == null ? null : SCHEMA.normalizeWorkspace(JSON.parse(raw));
  function compatible(raw, allowDamaged = false) {
    try { parse(raw); return true; }
    catch (failure) { if (!allowDamaged || failure.code === SCHEMA.UNSUPPORTED_SCHEMA) throw failure; return false; }
  }
  function validateRecord(record) {
    if (record == null) return null;
    if (record.storageVersion !== 1) throw error("UNSUPPORTED_BROWSER_STORAGE", "This browser workspace needs a compatible Campaign Engine version. Its saved data remains protected.");
    if (typeof record.revision !== "string" || ![record.primary, record.previous].every(raw => raw == null || typeof raw === "string") || !record.legacy || !Array.isArray(record.preserved)) throw error("INVALID_BROWSER_STORAGE", "The browser workspace storage record is damaged. Its saved contents remain untouched. Restore a downloaded backup in another browser profile or the Windows app.");
    return record;
  }
  function createStore({ indexedDB, legacyStorage, onUnavailable = () => {} } = {}) {
    let database = null, opening = null, revision = null;
    const storage = () => legacyStorage || globalThis.localStorage;
    const legacy = () => ({ primary: storage().getItem(PRIMARY), previous: storage().getItem(RECOVERY) });
    const markerPresent = values => values.primary === MARKER && values.previous === MARKER;
    const blank = values => ({ storageVersion: 1, revision: crypto.randomUUID(), primary: values.primary, previous: values.previous, legacy: { ...values }, preserved: [], migrationPending: true });
    function open() {
      if (database) return Promise.resolve(database);
      if (opening) return opening;
      opening = new Promise((resolve, reject) => {
        const factory = indexedDB || globalThis.indexedDB;
        if (!factory) { reject(error("BROWSER_STORAGE_UNAVAILABLE", "Browser storage is unavailable. Enable site storage or use the Windows app.")); return; }
        let abandoned = false;
        const request = factory.open(DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("workspace");
        request.onblocked = () => { abandoned = true; reject(error("BROWSER_STORAGE_BLOCKED", "Close other Campaign Engine tabs, then retry opening this workspace.")); };
        request.onerror = () => reject(request.error?.name === "VersionError" ? error("UNSUPPORTED_BROWSER_STORAGE", "This browser database was upgraded by a newer app. Open a compatible Campaign Engine version.") : request.error);
        request.onsuccess = () => {
          if (abandoned) { request.result.close(); return; }
          database = request.result;
          const unavailable = () => { database?.close(); database = null; onUnavailable(error("BROWSER_STORAGE_CHANGED", "Browser storage changed in another tab. Download unsaved work and reload the saved workspace.")); };
          database.onversionchange = unavailable;
          database.onclose = unavailable;
          resolve(database);
        };
      }).finally(() => { opening = null; });
      return opening;
    }
    async function transaction(mode, action) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("workspace", mode, { durability: "strict" });
        const store = tx.objectStore("workspace"), request = store.get("current");
        let result, failure;
        request.onsuccess = () => {
          try { result = action(validateRecord(request.result), store); }
          catch (cause) { failure = cause; tx.abort(); }
        };
        tx.onerror = () => { failure ||= tx.error; };
        tx.onabort = () => reject(failure || tx.error || error("BROWSER_WRITE_ABORTED", "The browser canceled this storage transaction. Your previous save remains available."));
        tx.oncomplete = () => resolve(result);
      });
    }
    async function finishMigration(record) {
      if (!record.migrationPending) {
        if (!markerPresent(legacy())) throw conflict();
        return record;
      }
      const values = legacy();
      for (const field of ["primary", "previous"]) if (values[field] !== MARKER && values[field] !== (record.migrationSource || record.legacy)[field]) throw conflict();
      // The database already contains both exact legacy byte sequences. A
      // partially written pair of markers is resumable after interruption.
      if (values.primary !== MARKER) storage().setItem(PRIMARY, MARKER);
      if (values.previous !== MARKER) storage().setItem(RECOVERY, MARKER);
      if (!markerPresent(legacy())) throw conflict();
      return transaction("readwrite", (current, store) => {
        if (!current || current.revision !== record.revision) throw conflict();
        current.migrationPending = false; delete current.migrationSource; store.put(current, "current"); return current;
      });
    }
    async function load({ resolveLegacyConflict = false } = {}) {
      let record = await transaction("readonly", current => current);
      revision = record?.revision || null;
      if (!record) {
        const values = legacy();
        if (values.primary === MARKER || values.previous === MARKER) throw error("BROWSER_DATABASE_MISSING", "The browser database is missing after a previous migration. Choose a downloaded backup to recover your workspace.");
        compatible(values.primary, true); compatible(values.previous, true);
        record = await transaction("readwrite", (current, store) => {
          if (current) return current;
          if (JSON.stringify(legacy()) !== JSON.stringify(values)) throw conflict();
          const next = blank(values); store.put(next, "current"); return next;
        });
      }
      if (resolveLegacyConflict && !markerPresent(legacy())) {
        record = await transaction("readwrite", (current, store) => {
          if (!current || current.revision !== record.revision) throw conflict();
          compatible(current.primary, true); compatible(current.previous, true);
          const values = legacy();
          for (const [field, raw] of Object.entries(values)) if (raw != null && raw !== MARKER && !Object.values(current.legacy).includes(raw) && !current.preserved.some(copy => copy.raw === raw)) current.preserved.push({ id: `preserved-${crypto.randomUUID()}`, label: `Older app ${field} workspace`, raw });
          current.migrationSource = values; current.migrationPending = true; current.revision = crypto.randomUUID();
          store.put(current, "current"); return current;
        });
      }
      revision = record.revision;
      record = await finishMigration(record);
      return parse(record.primary);
    }
    function write(value, { replace = false, allowDamaged = false } = {}) {
      // Capture before any asynchronous database work: later edits belong to
      // the next queued save, even while this transaction is waiting.
      const raw = JSON.stringify(SCHEMA.normalizeWorkspace(value, "browser"));
      const expected = revision;
      return transaction("readwrite", (record, store) => {
        if ((record?.revision || null) !== expected) throw conflict();
        if (!markerPresent(legacy())) throw conflict();
        if (!record) {
          if (!replace || !allowDamaged) throw error("BROWSER_DATABASE_MISSING", "Restore a reviewed backup before saving this workspace.");
          record = blank({ primary: null, previous: null }); record.migrationPending = false;
        }
        if (record.migrationPending) throw error("BROWSER_MIGRATION_PENDING", "Retry opening the workspace to finish its storage migration before saving.");
        const validPrimary = compatible(record.primary, replace && allowDamaged);
        const validPrevious = compatible(record.previous, true);
        for (const [label, original, valid] of [["primary", record.primary, validPrimary], ["previous", record.previous, validPrevious]]) {
          if (!valid && original != null && !record.preserved.some(copy => copy.raw === original)) record.preserved.push({ id: `preserved-${crypto.randomUUID()}`, label: `Preserved damaged ${label}`, raw: original });
        }
        const next = { ...record, previous: record.primary, primary: raw, revision: crypto.randomUUID() };
        store.put(next, "current"); return next.revision;
      }).then(nextRevision => { revision = nextRevision; });
    }
    async function readRaw(id = "primary") {
      const record = await transaction("readonly", current => current);
      if (!record) {
        const values = legacy(), raw = id === "previous" ? values.previous : values.primary;
        if (raw === MARKER) throw error("BROWSER_DATABASE_MISSING", "Choose a downloaded backup; the browser database is unavailable.");
        return raw;
      }
      if (id === "primary" || id === "previous") return record[id];
      if (id === "legacy-primary") return record.legacy.primary;
      if (id === "legacy-previous") return record.legacy.previous;
      const copy = record.preserved.find(item => item.id === id);
      if (!copy) throw new Error("Choose a listed browser recovery copy.");
      return copy.raw;
    }
    async function listCopies() {
      const record = await transaction("readonly", current => current);
      const copies = record ? [
        { id: "previous", label: "Previous automatic save", raw: record.previous },
        { id: "legacy-primary", label: "Original workspace before storage upgrade", raw: record.legacy.primary },
        { id: "legacy-previous", label: "Original recovery copy before storage upgrade", raw: record.legacy.previous },
        ...record.preserved
      ] : [{ id: "previous", label: "Previous browser workspace", raw: legacy().previous }];
      return copies.filter(copy => copy.raw != null && copy.raw !== MARKER).map(({ id, label, raw }) => {
        try { const value = JSON.parse(raw), summary = SCHEMA.summary(value); return { id, label, summary, savedAt: typeof value?.savedAt === "string" ? value.savedAt : undefined }; }
        catch (failure) { return { id, label, error: failure.message }; }
      });
    }
    return { load, save: value => write(value), replace: (value, options) => write(value, { ...options, replace: true }), readRaw, listCopies,
      get revision() { return revision; }, close() { database?.close(); database = null; } };
  }
  return { DATABASE, PRIMARY, RECOVERY, MARKER, createStore };
});
