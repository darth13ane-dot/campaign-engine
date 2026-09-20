(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignHistory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const COLLECTIONS = ["sessions", "characters", "quests", "locations", "journal", "arcs", "connections", "builders"];
  const clone = value => value == null ? null : structuredClone(value);
  const equal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const identity = record => String(record.archivistId || record.localId || record.id);
  const title = record => record?.name || record?.title || record?.type || "Record";
  function ensureIds(campaign) {
    for (const collection of COLLECTIONS) for (const record of campaign[collection] || []) {
      if (!record.archivistId && !record.localId && !record.id) record.localId = `local-${crypto.randomUUID()}`;
    }
    return campaign;
  }
  function snapshot(campaign) {
    ensureIds(campaign);
    return Object.fromEntries(COLLECTIONS.map(collection => [collection, clone(campaign[collection] || [])]));
  }
  function diff(before, after) {
    const changes = [];
    for (const collection of COLLECTIONS) {
      const old = new Map((before[collection] || []).map(record => [identity(record), record]));
      const next = new Map((after[collection] || []).map(record => [identity(record), record]));
      for (const id of new Set([...old.keys(), ...next.keys()])) {
        if (!equal(old.get(id), next.get(id))) changes.push({ collection, id, title: title(next.get(id) || old.get(id)), before: clone(old.get(id)), after: clone(next.get(id)) });
      }
    }
    return changes;
  }
  function append(campaign, changes, label = "Campaign edit") {
    if (!changes.length) return null;
    const entry = { id: `history-${crypto.randomUUID()}`, at: new Date().toISOString(), label, changes };
    campaign.history = [entry, ...(campaign.history || [])].slice(0, 100);
    // Bound backup growth while keeping the newest operation available for undo.
    let bytes = 0;
    const encoder = new TextEncoder();
    for (let index = 0; index < campaign.history.length; index++) {
      bytes += encoder.encode(JSON.stringify(campaign.history[index])).byteLength;
      if (bytes > 2000000 && index > 0) { campaign.history.length = index; break; }
    }
    return entry;
  }
  function createTracker() {
    const baselines = new Map();
    // Persisted records are JSON. Keep their serialized baselines so each save
    // reads a record once and only materializes records that actually changed.
    function encoded(campaign) {
      ensureIds(campaign);
      return new Map(COLLECTIONS.map(collection => [collection,
        new Map((campaign[collection] || []).map(record => [identity(record), JSON.stringify(record)]))
      ]));
    }
    function changesBetween(before, after) {
      const changes = [];
      for (const collection of COLLECTIONS) {
        const old = before.get(collection), next = after.get(collection);
        for (const id of new Set([...old.keys(), ...next.keys()])) {
          if (old.get(id) === next.get(id)) continue;
          const previous = old.has(id) ? JSON.parse(old.get(id)) : null;
          const current = next.has(id) ? JSON.parse(next.get(id)) : null;
          changes.push({ collection, id, title: title(current || previous), before: previous, after: current });
        }
      }
      return changes;
    }
    return {
      reset(campaigns) { baselines.clear(); campaigns.forEach(c => baselines.set(c.id, encoded(c))); },
      capture(campaigns, label) {
        const retained = new Set();
        for (const campaign of campaigns) {
          const next = encoded(campaign), previous = baselines.get(campaign.id);
          if (previous) append(campaign, changesBetween(previous, next), label);
          baselines.set(campaign.id, next);
          retained.add(campaign.id);
        }
        for (const id of baselines.keys()) if (!retained.has(id)) baselines.delete(id);
      }
    };
  }
  function undo(campaign, entryId) {
    const entry = campaign.history?.find(item => item.id === entryId);
    if (!entry || entry.undoneAt) throw new Error("This change is no longer available to undo.");
    for (const change of entry.changes) {
      const current = (campaign[change.collection] || []).find(record => identity(record) === change.id);
      if (!equal(current, change.after)) throw new Error(`${change.title} changed again. Undo the newer change first.`);
    }
    for (const change of [...entry.changes].reverse()) {
      const records = campaign[change.collection] || (campaign[change.collection] = []);
      const index = records.findIndex(record => identity(record) === change.id);
      if (!change.before) records.splice(index, 1);
      else if (index < 0) records.unshift(clone(change.before));
      else records[index] = clone(change.before);
    }
    entry.undoneAt = new Date().toISOString();
    return entry;
  }
  return { COLLECTIONS, ensureIds, snapshot, diff, append, createTracker, undo, identity };
});
