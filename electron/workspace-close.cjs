function createWorkspaceCloseGuard({ requestFlush, close, reportError }) {
  let dirty = false, waiting = false, allowed = false;
  return {
    setDirty(value) { dirty = Boolean(value); },
    onClose(event) {
      if (allowed || !dirty) return;
      event.preventDefault();
      if (!waiting) { waiting = true; requestFlush(); }
    },
    async finish(result) {
      if (!waiting) return;
      waiting = false;
      if (result?.ok) { dirty = false; allowed = true; close(); }
      else if (await reportError(result?.error || "The workspace could not be saved.")) { waiting = true; requestFlush(); }
    }
  };
}
module.exports = { createWorkspaceCloseGuard };
