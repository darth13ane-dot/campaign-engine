(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignSessionWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
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

  function emptyWorkflow() {
    return { schemaVersion: SCHEMA_VERSION, desks: {}, reconciliations: {} };
  }

  function normalizeDesk(value, key) {
    if (!object(value)) return null;
    const deskId = text(value.id || key, 160) || id("desk");
    const status = value.status === "completed" || value.status === "ended" ? "ended" : "active";
    return {
      id: deskId,
      sessionRef: object(value.sessionRef) ? clone(value.sessionRef) : { name: text(value.sessionTitle || "Session", 160) },
      status,
      startedAt: text(value.startedAt, 80) || new Date().toISOString(),
      endedAt: status === "ended" ? text(value.endedAt, 80) || new Date().toISOString() : null,
      beats: Array.isArray(value.beats) ? value.beats.filter(object).map((beat, index) => ({ id: text(beat.id, 160) || `${deskId}-beat-${index}`, title: text(beat.title || beat.text, 240), kind: ["scene", "beat", "pressure"].includes(beat.kind) ? beat.kind : "beat", done: Boolean(beat.done) })).filter(beat => beat.title) : [],
      pinned: Array.isArray(value.pinned) ? value.pinned.filter(object).map(entry => ({ type: text(entry.type, 40), name: text(entry.name, 200), archivistId: text(entry.archivistId, 160) || undefined })).filter(entry => entry.type && entry.name) : [],
      scratch: text(value.scratch, 12000),
      log: Array.isArray(value.log) ? value.log.filter(object).map((entry, index) => ({ id: text(entry.id, 160) || `${deskId}-log-${index}`, at: text(entry.at, 80) || new Date().toISOString(), text: text(entry.text, 8000) })).filter(entry => entry.text) : [],
      clocks: Array.isArray(value.clocks) ? value.clocks.filter(object).map((clock, index) => ({ id: text(clock.id, 160) || `${deskId}-clock-${index}`, label: text(clock.label, 160), value: Math.max(0, Number(clock.value) || 0), max: Math.max(1, Math.min(20, Number(clock.max) || 4)) })).filter(clock => clock.label) : [],
      revelations: Array.isArray(value.revelations) ? value.revelations.filter(object).map((item, index) => ({ id: text(item.id, 160) || `${deskId}-revelation-${index}`, text: text(item.text, 500), checked: Boolean(item.checked) })).filter(item => item.text) : []
    };
  }

  function normalizeWorkflow(value) {
    if (!object(value)) return emptyWorkflow();
    const desks = {};
    const sourceDesks = object(value.desks) ? value.desks : Array.isArray(value.sessions) ? Object.fromEntries(value.sessions.map((desk, index) => [desk.id || `legacy-${index}`, desk])) : {};
    Object.entries(sourceDesks).forEach(([key, desk]) => { const next = normalizeDesk(desk, key); if (next) desks[next.id] = next; });
    const reconciliations = {};
    const sourceDrafts = object(value.reconciliations) ? value.reconciliations : object(value.drafts) ? value.drafts : {};
    Object.entries(sourceDrafts).forEach(([key, draft]) => {
      if (!object(draft)) return;
      const draftId = text(draft.id || key, 160) || id("reconcile");
      reconciliations[draftId] = { id: draftId, deskId: text(draft.deskId, 160), status: ["draft", "applying", "applied", "discarded"].includes(draft.status) ? draft.status : "draft", recap: text(draft.recap, 12000), proposals: sanitizeProposals(draft.proposals || []), createdAt: text(draft.createdAt, 80) || new Date().toISOString(), appliedAt: text(draft.appliedAt, 80) || null, error: text(draft.error, 1000) || "" };
    });
    return { schemaVersion: SCHEMA_VERSION, desks, reconciliations };
  }

  function normalizeCampaign(campaign) {
    if (!object(campaign)) return campaign;
    if (campaign.sessionWorkflow?.schemaVersion === SCHEMA_VERSION) return campaign;
    const legacy = campaign.sessionWorkflow || campaign.sessionDeskState || campaign.reconciliationState;
    if (legacy) campaign.sessionWorkflow = normalizeWorkflow(legacy);
    delete campaign.sessionDeskState;
    delete campaign.reconciliationState;
    return campaign;
  }

  function ensureWorkflow(campaign) {
    normalizeCampaign(campaign);
    if (!campaign.sessionWorkflow) campaign.sessionWorkflow = emptyWorkflow();
    return campaign.sessionWorkflow;
  }

  function sessionReference(session) {
    return { name: text(session?.title || "Session", 160), archivistId: text(session?.archivistId, 160) || undefined, number: Number(session?.number) || undefined };
  }

  function findDeskForSession(campaign, session) {
    const workflow = campaign?.sessionWorkflow?.schemaVersion === SCHEMA_VERSION ? campaign.sessionWorkflow : campaign?.sessionWorkflow ? normalizeWorkflow(campaign.sessionWorkflow) : null;
    if (!workflow) return null;
    const ref = sessionReference(session);
    return Object.values(workflow.desks).find(desk => ref.archivistId ? desk.sessionRef.archivistId === ref.archivistId : desk.sessionRef.name === ref.name) || null;
  }

  function startDesk(campaign, session, now = new Date().toISOString()) {
    const workflow = ensureWorkflow(campaign);
    const existing = findDeskForSession(campaign, session);
    if (existing) return workflow.desks[existing.id] = existing;
    const deskId = id("desk");
    const directions = Array.isArray(session?.directions) ? session.directions : [];
    const desk = normalizeDesk({ id: deskId, sessionRef: sessionReference(session), status: "active", startedAt: now, beats: directions.map((title, index) => ({ id: `${deskId}-beat-${index}`, title, kind: "beat", done: false })) }, deskId);
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
      nextDraft.error = "";
      return next;
    } catch (error) {
      draft.status = "draft";
      draft.error = text(error.message || error, 1000);
      throw error;
    }
  }

  return { SCHEMA_VERSION, MUTABLE_FIELDS, normalizeWorkflow, normalizeCampaign, ensureWorkflow, findDeskForSession, startDesk, endDesk, createReconciliation, sanitizeProposal, sanitizeProposals, applyApproved, recordTitle };
});
