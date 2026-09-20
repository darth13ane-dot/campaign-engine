(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./workspace-schema.js") : root.CampaignWorkspaceSchema);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignPersistence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (SCHEMA) {
  function initialState(saved, snapshot, seed) {
    if (saved != null) return SCHEMA.assertState(saved);
    const fallback = Array.isArray(snapshot) && snapshot.length
      ? { source: "archivist", activeCampaignId: snapshot[0].id, campaigns: structuredClone(snapshot) }
      : structuredClone(seed);
    return SCHEMA.assertState(fallback);
  }

  // Keep just the newest pending state. A write already in progress always finishes first.
  function createSaveController({ snapshot, write, onStatus = () => {}, delay = 300, maxWait = 1500 }) {
    let revision = 0, savedRevision = 0, timer = null, deadline = null, running = null;
    const clearTimers = () => { clearTimeout(timer); clearTimeout(deadline); timer = deadline = null; };
    function notify(status, error) { onStatus({ status, error, dirty: revision !== savedRevision }); }
    function flush() {
      clearTimers();
      if (running) return running.then(() => revision !== savedRevision ? flush() : undefined);
      if (revision === savedRevision) return Promise.resolve();
      const target = revision;
      notify("saving");
      // Capture and start the writer synchronously; saving finishes only when
      // its promise confirms the transaction or desktop write has completed.
      let result;
      try { result = write(snapshot()); } catch (error) { notify("error", error); return Promise.reject(error); }
      running = Promise.resolve(result).then(() => {
        savedRevision = target;
        notify(revision === savedRevision ? "saved" : "pending");
      }, error => { notify("error", error); throw error; }).finally(() => { running = null; });
      return running.then(() => revision !== savedRevision ? flush() : undefined);
    }
    function request() {
      revision += 1;
      notify("pending");
      clearTimeout(timer);
      const save = () => { flush().catch(() => {}); };
      timer = setTimeout(save, delay);
      if (!deadline) deadline = setTimeout(save, maxWait);
    }
    function reset() {
      if (running) throw new Error("Wait for the pending workspace save before reloading.");
      clearTimers(); revision = savedRevision = 0; notify("saved");
    }
    return { request, flush, reset, get dirty() { return revision !== savedRevision; } };
  }
  return { initialState, createSaveController };
});
