(function initializeCampaignCleanup(root, factory) {
  const tools = factory();
  if (typeof module === "object" && module.exports) module.exports = tools;
  if (root) root.CampaignCleanup = tools;
})(typeof globalThis === "object" ? globalThis : this, function createCampaignCleanup() {
  const DEFAULT_CONNECTION_TYPES = [
    "Allied with", "Depends on", "Hunts", "Is tied to", "Knows about",
    "Leads to", "Opposes", "Protects", "Reveals", "Seeks"
  ];
  const DEFAULT_ARC_STATUSES = ["Planned", "Active", "On hold", "Complete"];

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function cleanText(value, limit = 500) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function stringList(value, maximum, limit) {
    return [...new Set(asArray(value).map(item => cleanText(item, limit)).filter(Boolean))].slice(0, maximum);
  }

  function entryKey(entry) {
    return `${entry?.type || ""}:${String(entry?.name || "").trim().toLocaleLowerCase()}`;
  }

  function campaignEntries(campaign) {
    return [
      ...asArray(campaign.characters).map(item => ({ type: "character", name: item.name })),
      ...asArray(campaign.quests).map(item => ({ type: "quest", name: item.title })),
      ...asArray(campaign.locations).map(item => ({ type: "location", name: item.title })),
      ...asArray(campaign.journal).map(item => ({ type: "journal", name: item.title })),
      ...asArray(campaign.sessions).map(item => ({ type: "session", name: item.title }))
    ].filter(entry => entry.name);
  }

  function connectionLabel(connection) {
    const from = cleanText(connection?.from?.name, 100) || "Unknown";
    const to = cleanText(connection?.to?.name, 100) || "Unknown";
    const type = cleanText(connection?.type, 80) || "is connected to";
    return `${from} ${type.toLocaleLowerCase()} ${to}`;
  }

  function connectionRows(campaign) {
    return asArray(campaign.connections).map((item, index) => ({
      ref: `C${index + 1}`,
      index,
      item,
      label: connectionLabel(item)
    }));
  }

  function arcRows(campaign) {
    return asArray(campaign.arcs).map((item, index) => ({
      ref: `A${index + 1}`,
      index,
      item,
      label: cleanText(item?.title, 100) || `Untitled arc ${index + 1}`
    }));
  }

  function buildInventory(campaign) {
    return {
      connections: connectionRows(campaign),
      arcs: arcRows(campaign)
    };
  }

  function matchingOption(value, options, fallback) {
    const normalized = String(value || "").trim().toLocaleLowerCase();
    return options.find(option => option.toLocaleLowerCase() === normalized) || fallback;
  }

  function sanitizedEntries(campaign, values) {
    const entries = new Map(campaignEntries(campaign).map(entry => [entryKey(entry), entry]));
    const seen = new Set();
    return asArray(values).flatMap(value => {
      const key = entryKey(value);
      const entry = entries.get(key);
      if (!entry || seen.has(key)) return [];
      seen.add(key);
      return [entry];
    }).slice(0, 12);
  }

  function validAction(value) {
    const action = String(value || "").trim().toLocaleLowerCase();
    return action === "merge" || action === "remove" ? action : "";
  }

  function selectedRows(rowMap, values, keepRef = "") {
    const seen = new Set();
    return asArray(values).flatMap(value => {
      const ref = String(value || "").trim().toUpperCase();
      const row = rowMap.get(ref);
      if (!row || ref === keepRef || seen.has(ref)) return [];
      seen.add(ref);
      return [row];
    });
  }

  function sanitizeConnectionActions(campaign, values, connectionTypes) {
    const rows = connectionRows(campaign);
    const rowMap = new Map(rows.map(row => [row.ref, row]));
    const claimed = new Set();
    return asArray(values).slice(0, 10).flatMap(value => {
      const action = validAction(value?.action);
      const keepRef = action === "merge" ? String(value?.keepRef || "").trim().toUpperCase() : "";
      const keep = keepRef ? rowMap.get(keepRef) : null;
      const remove = selectedRows(rowMap, value?.removeRefs, keepRef);
      const reason = cleanText(value?.reason, 420);
      const evidence = cleanText(value?.evidence, 420);
      const refs = [...(keep ? [keep.ref] : []), ...remove.map(row => row.ref)];
      if (!action || !reason || !evidence || !remove.length || (action === "merge" && !keep)) return [];
      if (refs.some(ref => claimed.has(ref))) return [];
      refs.forEach(ref => claimed.add(ref));
      return [{
        action,
        keepRef: keep?.ref || "",
        keepLabel: keep?.label || "",
        removeRefs: remove.map(row => row.ref),
        removeLabels: remove.map(row => row.label),
        mergedType: action === "merge"
          ? matchingOption(value?.mergedType, connectionTypes, keep.item.type)
          : "",
        mergedNote: action === "merge"
          ? cleanText(value?.mergedNote, 320) || cleanText(keep.item.note, 320)
          : "",
        reason,
        evidence
      }];
    });
  }

  function sanitizeMergedArc(campaign, keep, value, arcStatuses) {
    const merged = value && typeof value === "object" ? value : {};
    return {
      title: cleanText(merged.title, 100) || keep.title,
      status: matchingOption(merged.status, arcStatuses, keep.status || "Planned"),
      horizon: cleanText(merged.horizon, 80) || keep.horizon || "",
      tension: cleanText(merged.tension, 600) || keep.tension || "",
      change: cleanText(merged.change, 500) || keep.change || "",
      nextStep: cleanText(merged.nextStep, 400) || keep.nextStep || "",
      milestones: stringList(merged.milestones?.length ? merged.milestones : keep.milestones, 8, 220),
      related: sanitizedEntries(campaign, merged.related?.length ? merged.related : keep.related),
      directions: stringList(merged.directions?.length ? merged.directions : keep.directions, 4, 420),
      archetype: cleanText(merged.archetype, 160) || keep.archetype || "",
      tropes: stringList(merged.tropes?.length ? merged.tropes : keep.tropes, 6, 100),
      threadGaps: stringList(merged.threadGaps?.length ? merged.threadGaps : keep.threadGaps, 5, 320)
    };
  }

  function sanitizeArcActions(campaign, values, arcStatuses) {
    const rows = arcRows(campaign);
    const rowMap = new Map(rows.map(row => [row.ref, row]));
    const claimed = new Set();
    return asArray(values).slice(0, 10).flatMap(value => {
      const action = validAction(value?.action);
      const keepRef = action === "merge" ? String(value?.keepRef || "").trim().toUpperCase() : "";
      const keep = keepRef ? rowMap.get(keepRef) : null;
      const remove = selectedRows(rowMap, value?.removeRefs, keepRef);
      const reason = cleanText(value?.reason, 420);
      const evidence = cleanText(value?.evidence, 420);
      const refs = [...(keep ? [keep.ref] : []), ...remove.map(row => row.ref)];
      if (!action || !reason || !evidence || !remove.length || (action === "merge" && !keep)) return [];
      if (refs.some(ref => claimed.has(ref))) return [];
      refs.forEach(ref => claimed.add(ref));
      return [{
        action,
        keepRef: keep?.ref || "",
        keepLabel: keep?.label || "",
        removeRefs: remove.map(row => row.ref),
        removeLabels: remove.map(row => row.label),
        merged: action === "merge" ? sanitizeMergedArc(campaign, keep.item, value?.merged, arcStatuses) : null,
        reason,
        evidence
      }];
    });
  }

  function sanitizeSuggestions(campaign, output, scope = "both", options = {}) {
    const connectionTypes = asArray(options.connectionTypes).length
      ? options.connectionTypes
      : DEFAULT_CONNECTION_TYPES;
    const arcStatuses = asArray(options.arcStatuses).length
      ? options.arcStatuses
      : DEFAULT_ARC_STATUSES;
    return {
      connections: scope === "arcs"
        ? []
        : sanitizeConnectionActions(campaign, output?.connections, connectionTypes),
      arcs: scope === "connections"
        ? []
        : sanitizeArcActions(campaign, output?.arcs, arcStatuses)
    };
  }

  function selectedIndexes(value) {
    return new Set(asArray(value).map(Number).filter(Number.isInteger));
  }

  function applySelected(campaign, suggestions, selection = {}) {
    const connectionIndexes = selectedIndexes(selection.connections);
    const arcIndexes = selectedIndexes(selection.arcs);
    const connectionMap = new Map(connectionRows(campaign).map(row => [row.ref, row.item]));
    const arcMap = new Map(arcRows(campaign).map(row => [row.ref, row.item]));
    const removeConnections = new Set();
    const removeArcs = new Set();
    const stats = {
      actionsApplied: 0,
      connectionsMerged: 0,
      connectionsRemoved: 0,
      arcsMerged: 0,
      arcsRemoved: 0
    };

    asArray(suggestions?.connections).forEach((action, index) => {
      if (!connectionIndexes.has(index)) return;
      const remove = action.removeRefs.map(ref => connectionMap.get(ref)).filter(Boolean);
      if (!remove.length) return;
      if (action.action === "merge") {
        const keep = connectionMap.get(action.keepRef);
        if (!keep) return;
        keep.type = action.mergedType;
        keep.note = action.mergedNote;
        keep.lastEditedBy = "ai-cleanup-approved";
        keep.updatedAt = new Date().toISOString();
        stats.connectionsMerged += 1;
      }
      remove.forEach(item => removeConnections.add(item));
      stats.connectionsRemoved += remove.length;
      stats.actionsApplied += 1;
    });

    asArray(suggestions?.arcs).forEach((action, index) => {
      if (!arcIndexes.has(index)) return;
      const remove = action.removeRefs.map(ref => arcMap.get(ref)).filter(Boolean);
      if (!remove.length) return;
      if (action.action === "merge") {
        const keep = arcMap.get(action.keepRef);
        if (!keep) return;
        Object.assign(keep, action.merged, {
          lastEditedBy: "ai-cleanup-approved",
          updatedAt: new Date().toISOString()
        });
        stats.arcsMerged += 1;
      }
      remove.forEach(item => removeArcs.add(item));
      stats.arcsRemoved += remove.length;
      stats.actionsApplied += 1;
    });

    campaign.connections = asArray(campaign.connections).filter(item => !removeConnections.has(item));
    campaign.arcs = asArray(campaign.arcs).filter(item => !removeArcs.has(item));
    return stats;
  }

  return Object.freeze({
    applySelected,
    buildInventory,
    cleanText,
    sanitizeSuggestions
  });
});
