(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./session-prep.js") : root.CampaignSessionPrep, common ? require("./player-packet.js") : root.CampaignPlayerPacket, common ? require("./session-table.js") : root.CampaignSessionTable, common ? require("./workspace-schema.js") : root.CampaignWorkspaceSchema);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignSessionWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PREP, PACKETS, TABLE, SCHEMA) {
  "use strict";

  const SCHEMA_VERSION = SCHEMA.SESSION_WORKFLOW_SCHEMA_VERSION;
  const RECORD_COLLECTIONS = ["characters", "quests", "locations", "journal", "arcs"];
  const MUTABLE_FIELDS = {
    characters: ["name", "role", "description", "tags", "factions", "voice", "quirks", "relationships", "statBlock"],
    quests: ["title", "status", "detail", "tags"],
    locations: ["title", "detail", "tags"],
    journal: ["title", "body", "permission", "tags"],
    arcs: ["title", "status", "horizon", "tension", "change", "nextStep", "milestones", "related", "directions", "archetype", "tropes", "threadGaps"]
  };

  const clone = value => value == null ? value : structuredClone(value);
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value, limit = 4000) => String(value == null ? "" : value).replace(/\r\n?/g, "\n").trim().slice(0, limit);
  const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const recordTitle = (collection, record) => collection === "characters" ? record?.name : record?.title;
  const recordKey = (collection, record) => String(record?.archivistId || record?.id || `${collection}:${recordTitle(collection, record) || ""}`);
  const normalizedPacketWorkflows = new WeakSet();

  function normalizePacketMap(value) {
    const packets = Object.entries(object(value) ? value : {}).map(([key, packet]) => PACKETS.normalizePacket(packet, key)).filter(Boolean);
    const reservedIds = new Set(packets.map(packet => packet.id)), result = {};
    const counts = new Map();
    for (const packet of packets) counts.set(packet.id, (counts.get(packet.id) || 0) + 1);
    let recovered = 0;
    for (const packet of packets) {
      // Every document in an ambiguous identity group needs a fresh review.
      if (counts.get(packet.id) > 1) delete packet.approval;
      if (Object.hasOwn(result, packet.id)) {
        const prefix = packet.id.slice(0, 130);
        do { packet.id = `${prefix}-recovered-${++recovered}`; } while (reservedIds.has(packet.id));
        reservedIds.add(packet.id);
      }
      Object.defineProperty(result, packet.id, { value: packet, enumerable: true, writable: true, configurable: true });
    }
    return result;
  }

  function emptyWorkflow() {
    const workflow = { schemaVersion: SCHEMA_VERSION, preps: {}, desks: {}, reconciliations: {}, playerPackets: {} };
    normalizedPacketWorkflows.add(workflow);
    return workflow;
  }

  function normalizeDesk(value, key) {
    if (!object(value)) return null;
    const deskId = text(value.id || key, 160) || id("desk");
    const status = value.status === "completed" || value.status === "ended" ? "ended" : "active";
    return {
      id: deskId,
      sessionRef: PREP.sessionReference(value.sessionRef || { name: value.sessionTitle }),
      status,
      startedAt: text(value.startedAt, 80) || new Date().toISOString(),
      endedAt: status === "ended" ? text(value.endedAt, 80) || new Date().toISOString() : null,
      opening: text(value.opening, 12000),
      ...(Array.isArray(value.openingProvenance) ? { openingProvenance: value.openingProvenance.map(PREP.normalizeProvenance).filter(Boolean) } : {}),
      durationMinutes: Math.max(15, Math.min(1440, Number(value.durationMinutes) || 180)),
      spotlights: Array.isArray(value.spotlights) ? value.spotlights.filter(object).map((item, index) => ({ id: text(item.id, 160) || `${deskId}-spotlight-${index}`, character: text(item.character, 200), opportunity: text(item.opportunity, 4000), ...PREP.provenanceFields(item) })).filter(item => item.character || item.opportunity) : [],
      beats: Array.isArray(value.beats) ? value.beats.filter(object).map((beat, index) => ({ id: text(beat.id, 160) || `${deskId}-beat-${index}`, title: text(beat.title || beat.text, 240), kind: ["scene", "beat", "social", "exploration", "combat", "pressure"].includes(beat.kind) ? beat.kind : "beat", detail: text(beat.detail, 12000), question: text(beat.question, 4000), minutes: Number.isFinite(Number(beat.minutes)) && beat.minutes != null ? Math.max(0, Math.min(1440, Math.round(Number(beat.minutes)))) : 30, done: Boolean(beat.done), ...PREP.provenanceFields(beat), ...PREP.sceneReferenceFields(beat) })).filter(beat => beat.title) : [],
      pinned: Array.isArray(value.pinned) ? value.pinned.filter(object).map(PREP.recordReference).filter(entry => entry.type && entry.name) : [],
      scratch: text(value.scratch, 12000),
      ...(object(value.tableDrafts) ? { tableDrafts: TABLE.normalizeDrafts(value.tableDrafts) } : {}),
      ...(text(value.focusedBeatId, 160) ? { focusedBeatId: text(value.focusedBeatId, 160) } : {}),
      log: Array.isArray(value.log) ? value.log.filter(object).map((entry, index) => ({ id: text(entry.id, 160) || `${deskId}-log-${index}`, at: text(entry.at, 80) || new Date().toISOString(), text: text(entry.text, 8000), ...TABLE.normalizeLogScene(entry) })).filter(entry => entry.text) : [],
      clocks: Array.isArray(value.clocks) ? value.clocks.filter(object).map((clock, index) => ({ id: text(clock.id, 160) || `${deskId}-clock-${index}`, label: text(clock.label, 160), value: Math.max(0, Number(clock.value) || 0), max: Math.max(1, Math.min(20, Number(clock.max) || 4)), ...PREP.provenanceFields(clock) })).filter(clock => clock.label) : [],
      revelations: Array.isArray(value.revelations) ? value.revelations.filter(object).map((item, index) => ({ id: text(item.id, 160) || `${deskId}-revelation-${index}`, text: text(item.text, 4000), checked: Boolean(item.checked), ...PREP.provenanceFields(item) })).filter(item => item.text) : []
    };
  }

  function normalizeWorkflow(value) {
    if (!object(value)) return emptyWorkflow();
    SCHEMA.assertWorkflowVersion(value);
    const preps = {};
    Object.entries(object(value.preps) ? value.preps : {}).forEach(([key, prep]) => { const next = PREP.normalizePrep(prep, key); if (next) Object.defineProperty(preps, next.id, { value: next, enumerable: true, writable: true, configurable: true }); });
    const playerPackets = normalizePacketMap(value.playerPackets);
    const desks = {};
    const sourceDesks = object(value.desks) ? value.desks : Array.isArray(value.sessions) ? Object.fromEntries(value.sessions.map((desk, index) => [desk.id || `legacy-${index}`, desk])) : {};
    Object.entries(sourceDesks).forEach(([key, desk]) => { const next = normalizeDesk(desk, key); if (next) desks[next.id] = next; });
    const reconciliations = {};
    const sourceDrafts = object(value.reconciliations) ? value.reconciliations : object(value.drafts) ? value.drafts : {};
    Object.entries(sourceDrafts).forEach(([key, draft]) => {
      if (!object(draft)) return;
      const draftId = text(draft.id || key, 160) || id("reconcile");
      reconciliations[draftId] = { id: draftId, deskId: text(draft.deskId, 160), status: ["draft", "applying", "applied", "discarded"].includes(draft.status) ? draft.status : "draft", recap: text(draft.recap, 12000), proposals: sanitizeProposals(draft.proposals || []), createdAt: text(draft.createdAt, 80) || new Date().toISOString(), appliedAt: text(draft.appliedAt, 80) || null, error: text(draft.error, 1000) || "", ...(Array.isArray(draft.appliedProposalIds) ? { appliedProposalIds: [...new Set(draft.appliedProposalIds.map(value => text(value, 160)).filter(Boolean))].slice(0, 100) } : {}) };
    });
    const workflow = { schemaVersion: SCHEMA_VERSION, preps, desks, reconciliations, playerPackets };
    normalizedPacketWorkflows.add(workflow);
    return workflow;
  }

  function normalizeCampaign(campaign) {
    if (!object(campaign)) return campaign;
    for (const field of ["sessionWorkflow", "sessionDeskState", "reconciliationState"]) SCHEMA.assertWorkflowVersion(campaign[field]);
    // Schema 3 marks page-aware prep and live capture as incompatible with older
    // builds. Existing schema 2 content already has this shape: preserve it in place.
    if ([2, SCHEMA_VERSION].includes(Number(campaign.sessionWorkflow?.schemaVersion))) {
      campaign.sessionWorkflow.schemaVersion = SCHEMA_VERSION;
      if (!normalizedPacketWorkflows.has(campaign.sessionWorkflow)) {
        campaign.sessionWorkflow.playerPackets = normalizePacketMap(campaign.sessionWorkflow.playerPackets);
        normalizedPacketWorkflows.add(campaign.sessionWorkflow);
      }
      return campaign;
    }
    const legacy = campaign.sessionWorkflow || campaign.sessionDeskState || campaign.reconciliationState;
    if (legacy) campaign.sessionWorkflow = normalizeWorkflow(legacy);
    delete campaign.sessionDeskState;
    delete campaign.reconciliationState;
    return campaign;
  }

  function ensureWorkflow(campaign) {
    normalizeCampaign(campaign);
    if (!campaign.sessionWorkflow) campaign.sessionWorkflow = emptyWorkflow();
    for (const collection of ["preps", "desks", "reconciliations", "playerPackets"]) if (!object(campaign.sessionWorkflow[collection])) campaign.sessionWorkflow[collection] = {};
    return campaign.sessionWorkflow;
  }

  function findDeskForSession(campaign, session) {
    const workflow = campaign?.sessionWorkflow?.schemaVersion === SCHEMA_VERSION ? campaign.sessionWorkflow : campaign?.sessionWorkflow ? normalizeWorkflow(campaign.sessionWorkflow) : null;
    if (!workflow) return null;
    return PREP.findLinkedSessionItem(campaign, session, Object.values(workflow.desks || {}));
  }

  function startDesk(campaign, session, now = new Date().toISOString()) {
    const workflow = ensureWorkflow(campaign);
    const existing = findDeskForSession(campaign, session);
    const sessionRef = PREP.ensureSessionReferences(campaign, session);
    if (existing) { existing.sessionRef = sessionRef; return workflow.desks[existing.id] = existing; }
    const deskId = id("desk");
    const directions = Array.isArray(session?.directions) ? session.directions : [];
    const source = PREP.findPrepForSession(campaign, session);
    const prep = source ? PREP.normalizePrep(source) : null;
    const scenes = (prep?.scenes || []).filter(scene => scene.title || scene.detail || scene.question).map(scene => ({ ...scene, title: scene.title || "Untitled scene", done: false }));
    const desk = normalizeDesk({
      id: deskId, sessionRef, status: "active", startedAt: now,
      opening: prep?.opening, openingProvenance: prep?.openingProvenance, durationMinutes: prep?.durationMinutes, spotlights: prep?.spotlights,
      pinned: prep?.pinned, clocks: prep?.clocks, revelations: prep?.revelations,
      beats: scenes.length ? scenes : directions.map((title, index) => ({ id: `${deskId}-beat-${index}`, title, kind: "beat", done: false }))
    }, deskId);
    workflow.desks[deskId] = desk;
    return desk;
  }

  function endDesk(campaign, deskId, now = new Date().toISOString()) {
    const workflow = ensureWorkflow(campaign);
    const desk = workflow.desks[deskId];
    if (!desk) throw new Error("The session desk could not be found.");
    if (desk.status === "ended") return desk;
    desk.status = "ended";
    desk.endedAt = now;
    return desk;
  }

  function createReconciliation(campaign, deskId, proposals = [], recap = "", now = new Date().toISOString()) {
    const workflow = ensureWorkflow(campaign);
    const desk = workflow.desks[deskId];
    if (!desk || desk.status !== "ended") throw new Error("End the session before reconciling its consequences.");
    const existing = Object.values(workflow.reconciliations).find(item => item.deskId === deskId && !["applied", "discarded"].includes(item.status));
    if (existing) return existing;
    const draftId = id("reconcile");
    return workflow.reconciliations[draftId] = { id: draftId, deskId, status: "draft", recap: text(recap, 12000), proposals: sanitizeProposals(proposals), createdAt: now, appliedAt: null, error: "" };
  }

  function sanitizeProposal(value, index = 0) {
    if (!object(value)) return null;
    const action = ["update", "create", "connection"].includes(value.action) ? value.action : "update";
    const evidence = (Array.isArray(value.evidence) ? value.evidence : [value.evidence]).map(item => text(item, 700)).filter(Boolean).slice(0, 8);
    const base = { id: text(value.id, 160) || `proposal-${Date.now()}-${index}`, action, approved: Boolean(value.approved), evidence, summary: text(value.summary, 300) };
    if (!evidence.length) return null;
    if (action === "connection") {
      if (!object(value.from) || !object(value.to)) return null;
      return { ...base, from: { type: text(value.from.type, 40), name: text(value.from.name, 200) }, to: { type: text(value.to.type, 40), name: text(value.to.name, 200) }, connectionType: text(value.connectionType || value.type, 80), note: text(value.note || value.after, 1000), before: null, after: text(value.note || value.after, 1000) };
    }
    const collection = RECORD_COLLECTIONS.includes(value.collection) ? value.collection : "";
    if (!collection) return null;
    if (action === "create") {
      if (!object(value.record)) return null;
      const record = {};
      MUTABLE_FIELDS[collection].forEach(field => { if (value.record[field] != null) record[field] = clone(value.record[field]); });
      if (!text(recordTitle(collection, record), 200)) return null;
      return { ...base, collection, record, before: null, after: clone(record) };
    }
    const field = MUTABLE_FIELDS[collection].includes(value.field) ? value.field : "";
    const target = object(value.target) ? { name: text(value.target.name, 200), archivistId: text(value.target.archivistId, 160) || undefined, id: text(value.target.id, 160) || undefined } : null;
    if (!field || !target || !target.name && !target.archivistId && !target.id) return null;
    return { ...base, collection, target, field, before: clone(value.before), after: clone(value.after) };
  }

  function sanitizeProposals(values) {
    return (Array.isArray(values) ? values : []).map(sanitizeProposal).filter(Boolean).slice(0, 100);
  }

  function findTarget(campaign, proposal) {
    return (campaign[proposal.collection] || []).find(record => proposal.target.archivistId ? record.archivistId === proposal.target.archivistId : proposal.target.id ? record.id === proposal.target.id : recordTitle(proposal.collection, record) === proposal.target.name);
  }

  function applyOne(campaign, proposal) {
    if (proposal.action === "create") {
      const duplicate = (campaign[proposal.collection] || []).some(record => recordKey(proposal.collection, record) === recordKey(proposal.collection, proposal.record));
      if (duplicate) throw new Error(`A ${proposal.collection} record with that identity already exists.`);
      (campaign[proposal.collection] ||= []).unshift({ ...clone(proposal.record), id: proposal.record.id || id(`local-${proposal.collection}`), source: "session-reconciliation" });
      return;
    }
    if (proposal.action === "connection") {
      (campaign.connections ||= []).push({ id: id("connection"), from: clone(proposal.from), to: clone(proposal.to), type: proposal.connectionType || "Related to", note: proposal.note, source: "session-reconciliation" });
      return;
    }
    const target = findTarget(campaign, proposal);
    if (!target) throw new Error(`The proposed ${proposal.collection} record no longer exists.`);
    if (JSON.stringify(target[proposal.field]) !== JSON.stringify(proposal.before)) throw new Error(`“${recordTitle(proposal.collection, target)}” changed after this proposal was drafted. Review it again before applying.`);
    target[proposal.field] = clone(proposal.after);
    if (target.archivistId || target.localOverrides) target.localOverrides = { ...(target.localOverrides || {}), [proposal.field]: clone(proposal.after) };
  }

  function applyApproved(campaign, draftId, selectedIds, now = new Date().toISOString()) {
    const workflow = ensureWorkflow(campaign);
    const draft = workflow.reconciliations[draftId];
    if (!draft || draft.status !== "draft") throw new Error("This reconciliation draft is not ready to apply.");
    const selected = new Set(selectedIds || []);
    const approved = draft.proposals.filter(proposal => proposal.approved && selected.has(proposal.id));
    if (!approved.length) throw new Error("Approve and select at least one proposed change.");
    const next = clone(campaign);
    const nextDraft = next.sessionWorkflow.reconciliations[draftId];
    nextDraft.status = "applying";
    try {
      approved.forEach(proposal => applyOne(next, proposal));
      nextDraft.status = "applied";
      nextDraft.appliedAt = now;
      nextDraft.appliedProposalIds = approved.map(proposal => proposal.id);
      nextDraft.error = "";
      return next;
    } catch (error) {
      draft.status = "draft";
      draft.error = text(error.message || error, 1000);
      throw error;
    }
  }

  return { SCHEMA_VERSION, MUTABLE_FIELDS, normalizeWorkflow, normalizeCampaign, ensureWorkflow, findDeskForSession, startDesk, endDesk, createReconciliation, sanitizeProposal, sanitizeProposals, applyApproved, recordTitle, sessionReference: PREP.sessionReference };
});
