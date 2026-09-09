(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./session-prep.js") : root.CampaignSessionPrep, common ? require("./session-workflow.js") : root.CampaignSessionWorkflow);
  if (common) module.exports = api;
  if (root) root.CampaignPrepContinuity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PREP, WORKFLOW) {
  "use strict";

  const COLLECTIONS = ["scenes", "revelations", "clocks", "tasks", "spotlights", "pinned"];
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const rows = value => Array.isArray(value) ? value.filter(object) : [];
  const clone = value => value == null ? value : structuredClone(value);
  const text = (value, limit = 12000) => String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, limit);
  const identifiers = ["archivistId", "localId", "id"];
  const hasIdentity = value => identifiers.some(field => text(value?.[field]));
  const ended = desk => ["ended", "completed"].includes(desk?.status);

  function material(value, key = "") {
    if (Array.isArray(value)) return value.map(item => material(item));
    if (!object(value)) return value;
    const identityRef = ["sessionRef", "sourceSessionRef"].includes(key) && hasIdentity(value);
    return Object.fromEntries(Object.keys(value).sort().filter(field => !["continuityReview", "templateReview", "updatedAt"].includes(field) && !(identityRef && ["name", "number"].includes(field))).map(field => [field, material(value[field], field)]));
  }
  const fingerprint = value => JSON.stringify(material(value));
  function shortKey(value) {
    let left = 2166136261, right = 3339675911;
    for (const character of String(value)) { const code = character.codePointAt(0); left = Math.imul(left ^ code, 16777619); right = Math.imul(right ^ code, 2246822519); }
    return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
  }
  function identity(value) {
    const field = identifiers.find(key => text(value?.[key]));
    return field ? `${field}:${value[field]}` : `legacy:${shortKey(JSON.stringify([value?.name || value?.title, value?.number || null]))}`;
  }
  function sessionMaterial(session) {
    return { sessionRef: PREP.sessionReference(session), recap: session.recap || "", directions: session.directions || [], upcoming: Boolean(session.upcoming) };
  }
  function resolveTarget(campaign, targetSession) {
    if (!object(campaign) || !object(targetSession)) throw new Error("Choose a target session before reviewing continuity.");
    const target = PREP.findSession(campaign, PREP.sessionReference(targetSession));
    if (!target) throw new Error("The target session is missing or its legacy name is ambiguous.");
    return target;
  }
  function deskEntries(campaign) {
    return Object.entries(campaign?.sessionWorkflow?.desks || {}).filter(([, desk]) => object(desk)).map(([key, desk]) => ({ key, id: text(desk.id || key, 160), desk }));
  }
  function desksForSession(campaign, session) {
    return deskEntries(campaign).filter(entry => PREP.findSession(campaign, entry.desk.sessionRef) === session);
  }
  function isEarlier(campaign, source, target, sourceDesk) {
    if (source === target) return false;
    if (Number(source.number) > 0 && Number(target.number) > 0) return Number(source.number) < Number(target.number);
    const sourceDate = Date.parse(source.date), targetDate = Date.parse(target.date);
    if (Number.isFinite(sourceDate) && Number.isFinite(targetDate) && sourceDate !== targetDate) return sourceDate < targetDate;
    if (target.upcoming) return true;
    const targetDesk = desksForSession(campaign, target)[0]?.desk;
    if (sourceDesk?.endedAt && targetDesk?.startedAt) return Date.parse(sourceDesk.endedAt) < Date.parse(targetDesk.startedAt);
    return campaign.sessions.indexOf(source) > campaign.sessions.indexOf(target);
  }

  function sourceSessions(campaign, targetSession) {
    const target = resolveTarget(campaign, targetSession);
    const result = [];
    for (const session of rows(campaign.sessions)) {
      if (session === target || PREP.findSession(campaign, PREP.sessionReference(session)) !== session) continue;
      const linked = desksForSession(campaign, session);
      if (linked.length > 1 || linked.some(entry => !ended(entry.desk))) continue;
      const entry = linked[0];
      if (!entry && session.upcoming || !isEarlier(campaign, session, target, entry?.desk)) continue;
      result.push({ key: entry ? `desk:${entry.id}` : `session:${identity(session)}`, kind: entry ? "ended" : "recorded", deskId: entry?.id || null, sessionRef: PREP.sessionReference(session), title: text(session.title, 200), number: session.number || null, endedAt: entry?.desk.endedAt || null });
    }
    return result.sort((a, b) => (Number(b.number) || 0) - (Number(a.number) || 0) || (Date.parse(b.endedAt) || 0) - (Date.parse(a.endedAt) || 0) || a.title.localeCompare(b.title));
  }

  function chooseSource(campaign, target, options) {
    const available = sourceSessions(campaign, target);
    if (options.sourceSessionRef != null) {
      const requested = PREP.findSession(campaign, options.sourceSessionRef);
      if (!requested) throw new Error("The source session is missing or its legacy name is ambiguous. Choose another source.");
      const match = available.find(source => PREP.findSession(campaign, source.sessionRef) === requested);
      if (!match) throw new Error("Choose an earlier recorded session or an ended live session. Active sessions cannot supply continuity.");
      return match;
    }
    if (Object.hasOwn(options, "sourceDeskId")) {
      if (options.sourceDeskId === null) return null;
      const matches = available.filter(source => source.deskId === options.sourceDeskId);
      if (matches.length !== 1) throw new Error("The selected source desk is unavailable, ambiguous, or no longer ended. Choose another source.");
      return matches[0];
    }
    return available[0] || null;
  }

  function appliedEvidence(campaign, deskId) {
    const drafts = rows(Object.values(campaign.sessionWorkflow?.reconciliations || {})).filter(draft => draft.deskId === deskId);
    const appliedConsequences = [];
    let legacyBatches = 0;
    for (const draft of drafts) {
      if (draft.status !== "applied") continue;
      if (!Array.isArray(draft.appliedProposalIds)) { legacyBatches += 1; continue; }
      const executed = new Set(draft.appliedProposalIds);
      for (const proposal of rows(draft.proposals)) {
        if (!executed.has(proposal.id)) continue;
        appliedConsequences.push({ id: proposal.id, draftId: draft.id, summary: text(proposal.summary || `${proposal.action || "Update"} ${proposal.collection || "connection"}`, 1000), action: proposal.action, collection: proposal.collection, target: clone(proposal.target), field: proposal.field, before: clone(proposal.before), after: clone(proposal.after), evidence: (Array.isArray(proposal.evidence) ? proposal.evidence : []).map(item => text(item, 4000)).filter(Boolean) });
      }
    }
    return { drafts, appliedConsequences, consequenceNote: legacyBatches ? `${legacyBatches} older applied batch${legacyBatches === 1 ? " has" : "es have"} no record of the exact selected proposals. Their proposed changes are omitted; use the recorded session and current campaign records.` : "" };
  }

  function sourceContext(campaign, descriptor) {
    if (!descriptor) return { source: null, session: null, desk: null, prep: null, drafts: [] };
    const session = PREP.findSession(campaign, descriptor.sessionRef);
    const entry = descriptor.deskId && deskEntries(campaign).find(value => value.id === descriptor.deskId && PREP.findSession(campaign, value.desk.sessionRef) === session);
    const desk = entry?.desk || null;
    const prep = PREP.findPrepForSession(campaign, session);
    const consequences = desk ? appliedEvidence(campaign, descriptor.deskId) : { drafts: [], appliedConsequences: [], consequenceNote: "" };
    return {
      session, desk, prep, drafts: consequences.drafts,
      source: { ...clone(descriptor), recap: text(session.recap), scratch: text(desk?.scratch), log: rows(desk?.log).map(item => ({ id: item.id, at: item.at, text: text(item.text, 8000) })), appliedConsequences: consequences.appliedConsequences, consequenceNote: consequences.consequenceNote }
    };
  }

  function normalizeProvenance(value) {
    if (PREP.normalizeProvenance) return PREP.normalizeProvenance(value);
    if (!object(value) || !text(value.key, 1500)) return null;
    return { key: text(value.key, 1500), ...(value.sourceDeskId ? { sourceDeskId: text(value.sourceDeskId, 160) } : {}), ...(value.sourceSessionRef ? { sourceSessionRef: PREP.sessionReference(value.sourceSessionRef) } : {}), sourceCollection: text(value.sourceCollection, 80), sourceRowId: text(value.sourceRowId, 240), ...(value.recordRef ? { recordRef: PREP.recordReference(value.recordRef) } : {}), ...(value.label ? { label: text(value.label, 400) } : {}) };
  }
  function provenance(campaign, context, collection, row, recordRef) {
    const inherited = normalizeProvenance(row.provenance);
    if (inherited) return inherited;
    let sourceRowId = text(row.id, 240) || (recordRef ? identity(recordRef) : `legacy:${shortKey(fingerprint(row))}`);
    let logicalCollection = collection === "beats" ? "scenes" : collection;
    // Prepared rows retain their IDs when copied into live play. Desk creation is
    // a lifecycle change, so it must not create another origin for the same row.
    const origin = context.session ? identity(context.session) : "campaign";
    if (collection === "beats" && !rows(context.prep?.scenes).some(scene => scene.id && scene.id === row.id)) {
      const prefix = `${context.source?.deskId}-beat-`;
      const suffix = String(row.id || "").startsWith(prefix) ? String(row.id).slice(prefix.length) : "";
      const direction = /^\d+$/.test(suffix) && context.session?.directions?.[Number(suffix)];
      if (direction && text(direction, 240) === text(row.title || row.text, 240)) {
        logicalCollection = "directions";
        sourceRowId = `legacy:${shortKey(fingerprint({ title: text(direction) }))}`;
      }
    }
    return normalizeProvenance({ key: JSON.stringify([String(campaign.id), origin, logicalCollection, sourceRowId]), ...(context.source?.deskId ? { sourceDeskId: context.source.deskId } : {}), ...(context.session ? { sourceSessionRef: PREP.sessionReference(context.session) } : {}), sourceCollection: collection, sourceRowId, ...(recordRef ? { recordRef } : {}), label: context.source?.title || "Current campaign" });
  }
  function existingKeys(prep) {
    return new Set(COLLECTIONS.flatMap(collection => rows(prep?.[collection]).map(item => text(item.provenance?.key, 1500)).filter(Boolean)));
  }
  function samePinnedRecord(campaign, left, right) {
    if (left.type !== right.type) return false;
    const resolved = PREP.resolvePinnedRecord(campaign, left);
    return Boolean(resolved && resolved === PREP.resolvePinnedRecord(campaign, right)) || PREP.referencesMatch(left, right);
  }

  function buildCandidates(campaign, context, targetPrep, grounding) {
    const candidates = [], keys = existingKeys(targetPrep), offered = new Set();
    const add = (category, collection, row, after, reason, sourceCollection, recordRef, evidence) => {
      const origin = provenance(campaign, ["quests", "arcs"].includes(category) ? {} : context, sourceCollection, row, recordRef);
      if (offered.has(origin.key)) return;
      offered.add(origin.key);
      const duplicate = keys.has(origin.key) || collection === "pinned" && rows(targetPrep?.pinned).some(item => samePinnedRecord(campaign, item, after));
      const label = text(after.title || after.text || after.label || after.character || after.name, 240);
      candidates.push({ id: `continuity-${shortKey(origin.key)}`, category, collection, label, reason, evidence: evidence || [reason], before: null, after: clone(after), selected: false, duplicate, provenance: origin });
    };
    const prior = context.source?.title || "Earlier session";
    if (context.source) {
      const isLive = Boolean(context.desk);
      const sceneRows = isLive ? rows(context.desk.beats) : rows(context.prep?.scenes);
      for (const scene of sceneRows) {
        if (isLive && scene.done || !(text(scene.title || scene.text) || text(scene.detail) || text(scene.question))) continue;
        const after = { title: text(scene.title || scene.text || "Untitled scene", 240), kind: ["scene", "social", "exploration", "combat", "pressure"].includes(scene.kind) ? scene.kind : "scene", minutes: Number.isFinite(Number(scene.minutes)) ? Math.max(0, Math.min(1440, Math.round(Number(scene.minutes)))) : 30, detail: text(scene.detail), question: text(scene.question, 4000) };
        add("scenes", "scenes", scene, after, isLive ? "Live scene not marked complete." : "Prepared earlier; no live progress recorded.", isLive ? "beats" : "scenes", null, [`${prior}: ${isLive ? "This live scene was not marked complete when the session ended." : "This scene was prepared earlier; no live progress is recorded."}`]);
      }
      if (!isLive && !sceneRows.some(scene => text(scene.title || scene.detail || scene.question))) {
        for (const direction of Array.isArray(context.session.directions) ? context.session.directions : []) {
          if (!text(direction)) continue;
          add("scenes", "scenes", { title: text(direction) }, { title: text(direction, 240), kind: "scene", minutes: 30, detail: text(direction), question: "" }, "Possible direction prepared earlier; no live progress recorded.", "directions", null, [`${prior}: saved as a possible direction. No live completion status is available.`]);
        }
      }
      for (const item of rows(isLive ? context.desk.revelations : context.prep?.revelations)) {
        if (item.checked || !text(item.text)) continue;
        add("revelations", "revelations", item, { text: text(item.text, 4000), checked: false }, isLive ? "Revelation not checked off in the ended live desk." : "Prepared earlier; no live discovery recorded.", "revelations", null, [`${prior}: ${isLive ? "This revelation remains unchecked in the ended live desk." : "This revelation was prepared earlier; no live discovery is recorded."}`]);
      }
      for (const clock of rows(isLive ? context.desk.clocks : context.prep?.clocks)) {
        const max = Math.max(1, Math.min(20, Math.round(Number(clock.max) || 4))), value = Math.max(0, Math.round(Number(clock.value) || 0));
        if (!text(clock.label) || value >= max) continue;
        add("clocks", "clocks", clock, { label: text(clock.label, 160), value, max }, isLive ? `Live clock remains active at ${value}/${max}.` : `Prepared earlier at ${value}/${max}; no live progress recorded.`, "clocks", null, [`${prior}: ${isLive ? "ended live clock" : "prepared starting value"} ${value}/${max}.`]);
      }
      for (const task of rows(context.prep?.tasks)) {
        if (task.done || !text(task.text)) continue;
        add("tasks", "tasks", task, { text: text(task.text, 1000), done: false }, "Preparation task remains incomplete.", "tasks", null, [`${prior}: this task is still unchecked in session preparation.`]);
      }
      for (const spotlight of rows(isLive && Array.isArray(context.desk.spotlights) ? context.desk.spotlights : context.prep?.spotlights)) {
        if (!text(spotlight.character) || !text(spotlight.opportunity)) continue;
        add("spotlights", "spotlights", spotlight, { character: text(spotlight.character, 200), opportunity: text(spotlight.opportunity, 4000) }, "Earlier spotlight opportunity; review its relevance for this session.", "spotlights", null, [`${prior}: prepared spotlight opportunity. Completion is not tracked for spotlights.`]);
      }
      for (const pin of rows(isLive ? context.desk.pinned : context.prep?.pinned)) {
        const record = PREP.resolvePinnedRecord(campaign, pin);
        if (!record) continue;
        const ref = PREP.recordReference({ ...record, type: pin.type, name: record.name || record.title });
        add("pinned", "pinned", pin, ref, "Campaign record kept at hand in the earlier session.", "pinned", ref, [`${prior}: pinned campaign reference. Current record: ${ref.name}.`]);
      }
    }
    for (const { category, record } of grounding) {
      const ref = PREP.recordReference({ ...record, type: category === "quests" ? "quest" : "arc", name: record.name || record.title });
      const detail = category === "quests" ? text(record.detail || record.description) : [text(record.tension), text(record.nextStep)].filter(Boolean).join("\n\n");
      if (!ref.name || !detail) continue;
      add(category, "scenes", record, { title: ref.name, kind: "scene", minutes: 30, detail, question: "" }, `Current active ${category === "quests" ? "quest" : "story arc"}; adapt its recorded next step into a situation.`, category, ref, [`Current ${category === "quests" ? "quest" : "story arc"} “${ref.name}” (${text(record.status, 80)}): ${detail}`]);
    }
    return candidates;
  }

  function buildReview(campaign, targetSession, options = {}) {
    const target = resolveTarget(campaign, targetSession);
    const descriptor = chooseSource(campaign, target, options);
    const context = sourceContext(campaign, descriptor);
    const targetPrep = PREP.findPrepForSession(campaign, target);
    const targetDesks = desksForSession(campaign, target);
    const grounding = ["quests", "arcs"].flatMap(category => rows(campaign[category]).filter(record => text(record.status, 80).toLowerCase() === "active").map(record => ({ category, record })));
    const pins = rows(context.desk ? context.desk.pinned : context.prep?.pinned);
    const normalizedDesk = context.desk ? WORKFLOW.normalizeWorkflow({ desks: { [descriptor.deskId]: context.desk } }).desks[descriptor.deskId] : null;
    const snapshot = {
      source: fingerprint(context.source ? { key: context.source.key, session: sessionMaterial(context.session), desk: normalizedDesk, prep: context.prep ? PREP.normalizePrep(context.prep) : null, drafts: context.drafts, linkedRecords: pins.map(ref => ({ ref, record: PREP.resolvePinnedRecord(campaign, ref) })) } : null),
      target: fingerprint({ session: sessionMaterial(target), prep: targetPrep ? PREP.normalizePrep(targetPrep) : null, desks: targetDesks.map(entry => ({ id: entry.id, status: entry.desk.status })) }),
      grounding: fingerprint(grounding)
    };
    return {
      schemaVersion: 1, id: PREP.createId("continuity-review"), campaignId: String(campaign.id),
      target: { sessionRef: PREP.sessionReference(target), prepId: targetPrep?.id || null, hasLiveDesk: targetDesks.length > 0, before: clone(material(targetPrep)), counts: Object.fromEntries(COLLECTIONS.map(collection => [collection, rows(targetPrep?.[collection]).length])) },
      source: context.source,
      candidates: buildCandidates(campaign, context, targetPrep, grounding), snapshot
    };
  }

  function freshReview(campaign, targetSession, review) {
    if (!object(review) || review.schemaVersion !== 1 || !object(review.snapshot) || !object(review.target) || !Array.isArray(review.candidates)) throw new Error("This continuity review is invalid. Refresh it before applying.");
    if (review.campaignId !== String(campaign.id)) throw new Error("This continuity review belongs to a different campaign.");
    const target = resolveTarget(campaign, targetSession);
    if (PREP.findSession(campaign, review.target.sessionRef) !== target) throw new Error("The reviewed target session is missing or has changed identity.");
    let options = { sourceDeskId: null };
    if (review.source) {
      const source = PREP.findSession(campaign, review.source.sessionRef);
      if (!source) throw new Error("The reviewed source session is missing or has changed identity.");
      options = review.source.deskId ? { sourceDeskId: review.source.deskId } : { sourceSessionRef: review.source.sessionRef };
    }
    const fresh = buildReview(campaign, target, options);
    for (const field of ["source", "target", "grounding"]) if (review.snapshot[field] !== fresh.snapshot[field]) throw new Error(`${field === "source" ? "Source session material" : field === "target" ? "Target preparation or play status" : "Active campaign threads"} changed during review. Refresh the review before applying.`);
    return fresh;
  }

  function validateReview(campaign, targetSession, review) {
    try { freshReview(campaign, targetSession, review); return { valid: true, error: "" }; }
    catch (error) { return { valid: false, error: error.message }; }
  }

  function editedRow(candidate, edits, targetRef) {
    const allowed = { scenes: ["title", "kind", "minutes", "detail", "question"], revelations: ["text"], clocks: ["label", "value", "max"], tasks: ["text"], spotlights: ["character", "opportunity"], pinned: [] };
    const value = clone(candidate.after);
    for (const field of allowed[candidate.collection]) if (object(edits) && Object.hasOwn(edits, field)) value[field] = edits[field];
    const normalized = PREP.normalizePrep({ id: "continuity-selection", sessionRef: targetRef, [candidate.collection]: [value] })[candidate.collection][0];
    const meaningful = normalized && ({ scenes: text(normalized.title), revelations: text(normalized.text), clocks: text(normalized.label), tasks: text(normalized.text), spotlights: text(normalized.character) && text(normalized.opportunity), pinned: text(normalized.name) && text(normalized.type) })[candidate.collection];
    if (!meaningful) throw new Error(`Complete the selected ${candidate.collection} entry before applying it.`);
    if (candidate.collection !== "pinned") normalized.id = PREP.createId(`carried-${candidate.collection}`);
    normalized.provenance = clone(candidate.provenance);
    return normalized;
  }

  function applyReview(campaign, targetSession, review, selections) {
    const fresh = freshReview(campaign, targetSession, review);
    const selected = rows(selections).filter(selection => selection.accepted === true);
    if (!selected.length) throw new Error("Select and accept at least one continuity entry before applying.");
    if (new Set(selected.map(selection => selection.id)).size !== selected.length) throw new Error("Each continuity entry can be selected only once.");
    const prepared = selected.map(selection => {
      const candidate = fresh.candidates.find(item => item.id === selection.id);
      const reviewed = review.candidates.filter(item => item.id === selection.id);
      if (!candidate || reviewed.length !== 1) throw new Error("A selected continuity entry is no longer available. Refresh the review.");
      return { candidate, row: editedRow(candidate, selection.after ?? reviewed[0].after, fresh.target.sessionRef) };
    });
    const next = clone(campaign);
    const target = PREP.findSession(next, fresh.target.sessionRef);
    WORKFLOW.ensureWorkflow(next);
    const prep = PREP.ensurePrep(next, target);
    const keys = existingKeys(prep), added = [], skipped = [];
    for (const { candidate, row } of prepared) {
      if (keys.has(candidate.provenance.key) || candidate.collection === "pinned" && rows(prep.pinned).some(item => samePinnedRecord(next, item, row))) {
        skipped.push({ id: candidate.id, reason: "This original entry is already present in the target preparation." });
        continue;
      }
      prep[candidate.collection].push(row);
      keys.add(candidate.provenance.key);
      added.push(candidate.id);
    }
    delete prep.continuityReview;
    prep.updatedAt = new Date().toISOString();
    return { campaign: next, prepId: prep.id, added, skipped };
  }

  return { sourceSessions, buildReview, validateReview, applyReview, normalizeProvenance };
});
