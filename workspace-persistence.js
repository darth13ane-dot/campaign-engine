(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignPersistence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function initialState(saved, snapshot, seed) {
    if (saved && Array.isArray(saved.campaigns) && saved.campaigns.length && saved.campaigns.every(c => c && typeof c === "object" && c.id)) return saved;
    const fallback = Array.isArray(snapshot) && snapshot.length
      ? { source: "archivist", activeCampaignId: snapshot[0].id, campaigns: structuredClone(snapshot) }
      : structuredClone(seed);
    // A workspace-level library can exist before it has a usable campaign.
    if (saved && Object.hasOwn(saved, "prepTemplates")) fallback.prepTemplates = structuredClone(saved.prepTemplates);
    return fallback;
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
      // Invoke synchronous browser storage before returning, including during pagehide.
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
    return { request, flush, get dirty() { return revision !== savedRevision; } };
  }
  return { initialState, createSaveController };
});
