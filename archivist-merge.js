(function initializeArchivistMerge(root, factory) {
  const tools = factory();
  if (typeof module === "object" && module.exports) module.exports = tools;
  if (root) root.CampaignArchivistMerge = tools;
})(typeof globalThis === "object" ? globalThis : this, function createArchivistMerge() {
  const COLLECTIONS = {
    sessions: { title: item => item?.title, detail: ["sessions"], editable: ["title", "number", "date", "recap", "tags", "directions", "archetype", "tropes", "threadGaps", "upcoming"] },
    characters: { title: item => item?.name, detail: ["characters"], editable: ["name", "role", "description", "tags"] },
    quests: { title: item => item?.title, detail: ["quests"], editable: ["title", "status", "detail", "tags"] },
    locations: { title: item => item?.title, detail: ["world"], editable: ["title", "detail", "tags"] },
    journal: { title: item => item?.title, detail: ["journals"], editable: ["title", "body", "permission", "tags"] }
  };

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizedName(value = "") {
    return String(value).trim().toLocaleLowerCase().replace(/\s+/g, " ");
  }

  function detailsCampaign(root, campaignId) {
    if (!isObject(root)) return {};
    if (isObject(root.campaigns)) return root.campaigns[campaignId] || {};
    return root[campaignId] || {};
  }

  function detailMap(campaignDetails, collection, item = {}) {
    const config = COLLECTIONS[collection];
    if (!config) return {};
    if (collection !== "locations") return campaignDetails?.[config.detail[0]] || {};
    const kind = String(item.tags?.[0] || item.kind || item.type || "location").toLocaleLowerCase();
    return campaignDetails?.world?.[kind] || campaignDetails?.world?.location || {};
  }

  function findDetail(campaignDetails, collection, item) {
    const values = detailMap(campaignDetails, collection, item);
    const title = COLLECTIONS[collection]?.title(item);
    const id = item?.archivistId || item?.sourceId;
    if (id) {
      if (collection === "locations") {
        const worldDetail = Object.values(campaignDetails?.world || {})
          .flatMap(group => Object.values(group || {}))
          .find(value => value?.id === id);
        if (worldDetail) return worldDetail;
      }
      const byId = Object.values(values).find(value => value?.id === id);
      if (byId) return byId;
    }
    if (title && values[title]) return values[title];
    const key = normalizedName(title);
    return Object.entries(values).find(([name]) => normalizedName(name) === key)?.[1] || null;
  }

  function normalizeRecord(collection, value, campaignDetails, imported = false) {
    const item = clone(value || {});
    if (collection === "journal") {
      if (!item.body && item.detail) item.body = item.detail;
      if (!item.permission) item.permission = "GM only";
    }
    if (!Array.isArray(item.tags)) item.tags = [];
    const detail = findDetail(campaignDetails, collection, item);
    const archivistId = item.archivistId || item.sourceId || detail?.id;
    if (archivistId) item.archivistId = String(archivistId);
    if (imported && !item.source) item.source = "archivist";
    return item;
  }

  function annotateCampaign(campaign, detailsRoot, imported = false) {
    const next = clone(campaign || {});
    const campaignDetails = detailsCampaign(detailsRoot, next.id);
    for (const collection of Object.keys(COLLECTIONS)) {
      next[collection] = Array.isArray(next[collection])
        ? next[collection].map(item => normalizeRecord(collection, item, campaignDetails, imported))
        : [];
    }
    return next;
  }

  function recordIdentity(collection, item) {
    if (item?.archivistId) return `archivist:${item.archivistId}`;
    if (item?.localId) return `local:${item.localId}`;
    return `name:${normalizedName(COLLECTIONS[collection]?.title(item))}`;
  }

  function nameIdentity(collection, item) {
    return normalizedName(COLLECTIONS[collection]?.title(item));
  }

  function isManualOnly(item) {
    return item?.source === "manual" || (item?.localId && !item?.archivistId);
  }

  function localOverrides(collection, existing) {
    if (isObject(existing?.localOverrides)) return clone(existing.localOverrides);
    if (existing?.lastEditedBy !== "manual-edit") return {};
    const override = {};
    for (const key of COLLECTIONS[collection].editable) {
      if (existing[key] !== undefined) override[key] = clone(existing[key]);
    }
    return override;
  }

  function mergeMatchedRecord(collection, existing, incoming, stats) {
    const overrides = localOverrides(collection, existing);
    const merged = { ...clone(incoming), ...overrides };
    for (const key of ["localId", "lastEditedBy", "updatedAt"]) {
      if (existing[key] !== undefined) merged[key] = clone(existing[key]);
    }
    if (Object.keys(overrides).length) {
      merged.localOverrides = overrides;
      stats.editsPreserved += 1;
    }
    merged.archivistId = incoming.archivistId || existing.archivistId;
    merged.source = incoming.source || existing.source || "archivist";
    stats.updated += 1;
    return merged;
  }

  function dedupeIncoming(collection, incoming, stats) {
    const result = [];
    const positions = new Map();
    for (const item of incoming) {
      const key = recordIdentity(collection, item);
      if (!positions.has(key)) {
        positions.set(key, result.length);
        result.push(item);
        continue;
      }
      const index = positions.get(key);
      result[index] = { ...result[index], ...item };
      stats.duplicatesCollapsed += 1;
    }
    return result;
  }

  function mergeCollection(collection, existingRecords, incomingRecords, stats) {
    const existing = Array.isArray(existingRecords) ? existingRecords : [];
    const incoming = dedupeIncoming(collection, Array.isArray(incomingRecords) ? incomingRecords : [], stats);
    const byArchivistId = new Map();
    const byName = new Map();
    existing.forEach((item, index) => {
      if (item.archivistId) byArchivistId.set(String(item.archivistId), index);
      if (!isManualOnly(item)) byName.set(nameIdentity(collection, item), index);
    });

    const consumed = new Set();
    const merged = incoming.map(item => {
      let index = item.archivistId ? byArchivistId.get(String(item.archivistId)) : undefined;
      if (index === undefined && !isManualOnly(item)) index = byName.get(nameIdentity(collection, item));
      if (index === undefined || consumed.has(index)) {
        stats.added += 1;
        return item;
      }
      consumed.add(index);
      return mergeMatchedRecord(collection, existing[index], item, stats);
    });

    existing.forEach((item, index) => {
      if (consumed.has(index)) return;
      merged.push(item);
      stats.localRecordsRetained += 1;
    });
    return merged;
  }

  function mergeConnections(existingConnections, incomingConnections) {
    if (!Array.isArray(incomingConnections)) return clone(existingConnections || []);
    const incoming = clone(incomingConnections);
    const incomingIds = new Set(incoming.map(item => item.archivistId || item.id).filter(Boolean).map(String));
    for (const item of existingConnections || []) {
      const id = item.archivistId || item.id;
      if (id && incomingIds.has(String(id))) continue;
      incoming.push(clone(item));
    }
    return incoming;
  }

  function emptyStats() {
    return {
      campaignsAdded: 0,
      campaignsUpdated: 0,
      campaignsRetained: 0,
      added: 0,
      updated: 0,
      localRecordsRetained: 0,
      editsPreserved: 0,
      duplicatesCollapsed: 0
    };
  }

  function mergeCampaign(existingCampaign, incomingCampaign, existingDetails, incomingDetails, stats) {
    const existing = annotateCampaign(existingCampaign, existingDetails, false);
    const incoming = annotateCampaign(incomingCampaign, incomingDetails, true);
    const merged = { ...existing, ...incoming, source: "archivist" };
    for (const collection of Object.keys(COLLECTIONS)) {
      merged[collection] = mergeCollection(collection, existing[collection], incoming[collection], stats);
    }
    merged.connections = mergeConnections(existing.connections, incomingCampaign.connections);
    for (const key of ["arcs", "documents", "builders"]) {
      if (Array.isArray(existing[key]) && !Array.isArray(incomingCampaign[key])) merged[key] = existing[key];
    }
    if (existing.systemData && !incomingCampaign.systemData) merged.systemData = existing.systemData;
    stats.campaignsUpdated += 1;
    return merged;
  }

  function mergeCampaigns(existingCampaigns, incomingCampaigns, existingDetails = {}, incomingDetails = {}) {
    const stats = emptyStats();
    const existing = Array.isArray(existingCampaigns) ? existingCampaigns : [];
    const incoming = Array.isArray(incomingCampaigns) ? incomingCampaigns : [];
    const existingById = new Map(existing.map((campaign, index) => [String(campaign.id), index]));
    const consumed = new Set();
    const incomingPositions = new Map();
    const dedupedIncoming = [];

    for (const campaign of incoming) {
      const key = String(campaign?.id || `title:${normalizedName(campaign?.title)}`);
      if (!incomingPositions.has(key)) {
        incomingPositions.set(key, dedupedIncoming.length);
        dedupedIncoming.push(campaign);
      } else {
        const index = incomingPositions.get(key);
        dedupedIncoming[index] = { ...dedupedIncoming[index], ...campaign };
        stats.duplicatesCollapsed += 1;
      }
    }

    const campaigns = dedupedIncoming.map(campaign => {
      const index = existingById.get(String(campaign.id));
      if (index === undefined) {
        stats.campaignsAdded += 1;
        const prepared = annotateCampaign(campaign, incomingDetails, true);
        for (const collection of Object.keys(COLLECTIONS)) {
          prepared[collection] = dedupeIncoming(collection, prepared[collection], stats);
          stats.added += prepared[collection].length;
        }
        return prepared;
      }
      consumed.add(index);
      return mergeCampaign(existing[index], campaign, existingDetails, incomingDetails, stats);
    });

    existing.forEach((campaign, index) => {
      if (consumed.has(index)) return;
      campaigns.push(clone(campaign));
      stats.campaignsRetained += 1;
    });
    return { campaigns, stats };
  }

  function mergeEntityMap(existing = {}, incoming = {}) {
    const next = {};
    const incomingIds = new Set();
    for (const [name, value] of Object.entries(incoming || {})) {
      next[name] = clone(value);
      if (value?.id) incomingIds.add(String(value.id));
    }
    for (const [name, value] of Object.entries(existing || {})) {
      if (Object.prototype.hasOwnProperty.call(next, name)) continue;
      if (value?.id && incomingIds.has(String(value.id))) continue;
      next[name] = clone(value);
    }
    return next;
  }

  function mergeCampaignDetails(existing = {}, incoming = {}) {
    const next = { ...clone(existing), ...clone(incoming) };
    for (const key of ["sessions", "characters", "quests", "journals"]) {
      next[key] = mergeEntityMap(existing?.[key], incoming?.[key]);
    }
    next.world = { ...clone(existing?.world || {}), ...clone(incoming?.world || {}) };
    const worldKinds = new Set([...Object.keys(existing?.world || {}), ...Object.keys(incoming?.world || {})]);
    for (const kind of worldKinds) {
      next.world[kind] = mergeEntityMap(existing?.world?.[kind], incoming?.world?.[kind]);
    }
    return next;
  }

  function asDetailsRoot(value = {}, importedAt = null) {
    if (isObject(value?.campaigns)) return clone(value);
    return { importedAt, campaigns: clone(value || {}) };
  }

  function mergeDetailsRoots(existingRoot = {}, incomingRoot = {}) {
    const existing = asDetailsRoot(existingRoot, existingRoot?.importedAt);
    const incoming = asDetailsRoot(incomingRoot, incomingRoot?.importedAt);
    const campaignIds = new Set([...Object.keys(existing.campaigns || {}), ...Object.keys(incoming.campaigns || {})]);
    const campaigns = {};
    for (const id of campaignIds) {
      campaigns[id] = incoming.campaigns?.[id]
        ? mergeCampaignDetails(existing.campaigns?.[id], incoming.campaigns[id])
        : clone(existing.campaigns?.[id] || {});
    }
    return {
      ...existing,
      ...incoming,
      importedAt: incoming.importedAt || new Date().toISOString(),
      campaigns
    };
  }

  return Object.freeze({
    annotateCampaign,
    asDetailsRoot,
    emptyStats,
    findDetail,
    mergeCampaigns,
    mergeDetailsRoots,
    normalizedName,
    recordIdentity
  });
});
