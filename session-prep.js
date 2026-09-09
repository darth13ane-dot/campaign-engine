(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignSessionPrep = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value, limit = 12000) => String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, limit);
  const rows = value => Array.isArray(value) ? value.filter(object) : [];
  const identityFields = ["archivistId", "localId", "id"];
  const hasIdentity = value => identityFields.some(field => text(value?.[field], 160));
  const createId = (prefix = "prep") => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const integer = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== "" && value != null ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;

  function sessionReference(session) {
    const reference = { name: text(session?.title || session?.name || "Session", 200) };
    for (const field of identityFields) if (text(session?.[field], 160)) reference[field] = text(session[field], 160);
    if (Number(session?.number) > 0) reference.number = Number(session.number);
    return reference;
  }

  function ensureSessionReference(session) {
    if (!object(session)) throw new Error("Choose a session to prepare.");
    if (!hasIdentity(session)) session.localId = createId("local-session");
    return sessionReference(session);
  }

  function referencesMatch(reference, session, { allowLegacyName = false } = {}) {
    if (!object(reference) || !object(session)) return false;
    const target = sessionReference(session);
    const shared = identityFields.filter(field => text(reference[field], 160) && target[field]);
    if (shared.length) return shared.every(field => text(reference[field], 160) === target[field]);
    // Identified references must never attach to a replacement with the same name.
    if (hasIdentity(reference) || !allowLegacyName) return false;
    return text(reference.name || reference.title, 200) === target.name
      && !(Number(reference.number) > 0 && target.number && Number(reference.number) !== target.number);
  }

  function findSession(campaign, reference) {
    const sessions = rows(campaign?.sessions);
    const exact = sessions.filter(session => referencesMatch(reference, session));
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    const legacy = sessions.filter(session => referencesMatch(reference, session, { allowLegacyName: true }));
    return legacy.length === 1 ? legacy[0] : null;
  }

  function findLinkedSessionItem(campaign, session, values) {
    const items = rows(values);
    const exact = items.filter(item => referencesMatch(item.sessionRef, session));
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    const legacy = items.filter(item => {
      if (hasIdentity(item.sessionRef)) return false;
      const resolved = findSession(campaign, item.sessionRef);
      return resolved && (resolved === session || referencesMatch(sessionReference(resolved), session));
    });
    return legacy.length === 1 ? legacy[0] : null;
  }

  function ensureSessionReferences(campaign, session) {
    const linked = ["preps", "desks"].map(collection => findLinkedSessionItem(campaign, session, Object.values(campaign?.sessionWorkflow?.[collection] || {}))).filter(Boolean);
    const reference = ensureSessionReference(session);
    for (const item of linked) item.sessionRef = { ...reference };
    return reference;
  }

  function recordReference(value) {
    const reference = { type: text(value?.type, 40), name: text(value?.name || value?.title, 200) };
    for (const field of identityFields) if (text(value?.[field], 160)) reference[field] = text(value[field], 160);
    return reference;
  }

  function normalizePrep(value, key) {
    if (!object(value)) return null;
    const prepId = text(value.id || key, 160) || createId();
    const rowId = (row, kind, index) => text(row.id, 160) || `${prepId}-${kind}-${index}`;
    return {
      id: prepId,
      sessionRef: sessionReference(value.sessionRef || { name: value.sessionTitle }),
      opening: text(value.opening),
      durationMinutes: integer(value.durationMinutes, 180, 15, 1440),
      scenes: rows(value.scenes).map((scene, index) => ({ id: rowId(scene, "scene", index), title: text(scene.title, 240), kind: ["scene", "social", "exploration", "combat", "pressure"].includes(scene.kind) ? scene.kind : "scene", minutes: integer(scene.minutes, 30, 0, 1440), detail: text(scene.detail), question: text(scene.question, 4000) })),
      pinned: rows(value.pinned).map(recordReference).filter(entry => entry.type && entry.name),
      revelations: rows(value.revelations).map((item, index) => ({ id: rowId(item, "revelation", index), text: text(item.text, 4000), checked: Boolean(item.checked) })),
      clocks: rows(value.clocks).map((clock, index) => {
        const max = integer(clock.max, 4, 1, 20);
        return { id: rowId(clock, "clock", index), label: text(clock.label, 160), max, value: integer(clock.value, 0, 0, max) };
      }),
      spotlights: rows(value.spotlights).map((item, index) => ({ id: rowId(item, "spotlight", index), character: text(item.character, 200), opportunity: text(item.opportunity, 4000) })),
      tasks: rows(value.tasks).map((item, index) => ({ id: rowId(item, "task", index), text: text(item.text, 1000), done: Boolean(item.done) }))
    };
  }

  function findPrepForSession(campaign, session) {
    return findLinkedSessionItem(campaign, session, Object.values(campaign?.sessionWorkflow?.preps || {}));
  }

  function ensurePrep(campaign, session) {
    if (!object(campaign?.sessionWorkflow)) throw new Error("Initialize the session workflow before preparing a session.");
    if (!rows(campaign.sessions).includes(session)) throw new Error("This session is no longer in the active campaign.");
    const existing = findPrepForSession(campaign, session);
    const sessionRef = ensureSessionReferences(campaign, session);
    if (existing) { existing.sessionRef = sessionRef; return existing; }
    if (!object(campaign.sessionWorkflow.preps)) campaign.sessionWorkflow.preps = {};
    const prep = normalizePrep({ id: createId(), sessionRef });
    campaign.sessionWorkflow.preps[prep.id] = prep;
    return prep;
  }

  function readiness(prep, campaign) {
    const scenes = rows(prep?.scenes), tasks = rows(prep?.tasks);
    const namedScenes = scenes.filter(scene => text(scene.title));
    const durationMinutes = integer(prep?.durationMinutes, 180, 15, 1440);
    const plannedMinutes = scenes.reduce((sum, scene) => sum + integer(scene.minutes, 30, 0, 1440), 0);
    const checks = [
      { id: "opening", label: "Opening situation written", done: Boolean(text(prep?.opening)) },
      { id: "scenes", label: "Playable scenes prepared", done: namedScenes.length > 0 && scenes.every(scene => text(scene.title) && (text(scene.detail) || text(scene.question))) },
      { id: "timing", label: "Scene timings fit the session", done: namedScenes.length > 0 && scenes.every(scene => text(scene.title) && Number(scene.minutes) > 0) && plannedMinutes <= durationMinutes },
      { id: "spotlights", label: "Player spotlight prepared", done: rows(prep?.spotlights).some(item => text(item.character) && text(item.opportunity)) },
      { id: "records", label: "Key campaign records pinned", done: rows(prep?.pinned).length > 0 && rows(prep?.pinned).every(item => text(item.type) && text(item.name) && (!campaign || resolvePinnedRecord(campaign, item))) },
      { id: "tasks", label: "No outstanding prep tasks", done: tasks.every(item => text(item.text) && item.done === true) }
    ].map(check => ({ ...check, done: Boolean(check.done) }));
    return { checks, complete: checks.filter(check => check.done).length, total: checks.length, plannedMinutes, durationMinutes };
  }

  function resolvePinnedRecord(campaign, reference) {
    const collection = { character: "characters", characters: "characters", quest: "quests", quests: "quests", location: "locations", locations: "locations", journal: "journal", session: "sessions", arc: "arcs" }[reference?.type];
    const records = rows(campaign?.[collection]);
    const exact = records.filter(record => referencesMatch(reference, record));
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    const legacy = records.filter(record => referencesMatch(reference, record, { allowLegacyName: true }));
    return legacy.length === 1 ? legacy[0] : null;
  }

  function exportMarkdown(campaign, session, value) {
    const prep = normalizePrep(value || { sessionRef: sessionReference(session) });
    const md = value => text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g, "\\$1");
    const line = value => md(value).replace(/\n/g, " ");
    const timing = readiness(prep);
    const out = [`# ${line(session?.title || prep.sessionRef.name)} — Session Prep`, "", "**GM ONLY — PRIVATE PREPARATION**", "", `Campaign: ${line(campaign?.title || "Campaign")}`, `Session: ${line(session?.number || prep.sessionRef.number || "Unnumbered")} · ${line(session?.date || "Unscheduled")}`, `Time: ${timing.plannedMinutes} minutes planned / ${timing.durationMinutes} minutes available`, "", "## Opening situation", "", md(prep.opening) || "Opening still to prepare."];
    if (text(session?.recap)) out.push("", "## Session plan", "", md(session.recap));
    const directions = (Array.isArray(session?.directions) ? session.directions : []).map(direction => text(direction)).filter(Boolean);
    if (directions.length) out.push("", "## Possible directions", "", ...directions.map(direction => `- ${md(direction)}`));
    out.push("", "## Flexible scenes", "");
    const scenes = prep.scenes.filter(scene => scene.title || scene.detail || scene.question);
    if (!scenes.length) out.push("Scenes still to prepare.");
    scenes.forEach((scene, index) => {
      out.push(`### ${index + 1}. ${line(scene.title || "Untitled scene")}`, "", `${line(scene.kind)} · ${scene.minutes} minutes`);
      if (scene.detail) out.push("", md(scene.detail));
      if (scene.question) out.push("", `**Meaningful choice:** ${md(scene.question)}`);
      out.push("");
    });
    const list = (title, entries) => { if (entries.length) out.push("", `## ${title}`, "", ...entries); };
    list("Player spotlights", prep.spotlights.filter(item => item.character || item.opportunity).map(item => `- **${line(item.character || "Choose a character")}:** ${md(item.opportunity)}`));
    list("Clues & revelations", prep.revelations.filter(item => item.text).map(item => `- ${md(item.text)}`));
    list("Clocks & counters", prep.clocks.filter(clock => clock.label).map(clock => `- ${line(clock.label)}: ${clock.value}/${clock.max}`));
    list("Prep tasks", prep.tasks.filter(item => item.text).map(item => `- [${item.done ? "x" : " "}] ${md(item.text)}`));
    if (prep.pinned.length) {
      out.push("", "## Pinned campaign records", "");
      for (const reference of prep.pinned) {
        const record = resolvePinnedRecord(campaign, reference);
        out.push(`### ${line(record?.name || record?.title || reference.name)} (${line(reference.type)})`, "");
        if (!record) { out.push("This linked record is unavailable. Review its link in the campaign.", ""); continue; }
        const fields = [["Role", record.role], ["Status", record.status], ["Notes", record.description || record.detail || record.body || record.recap], ["Pressure", record.tension], ["Next step", record.nextStep], ["Voice", record.voice], ["Quirks", record.quirks], ["Relationships", record.relationships], ["Stats", record.statBlock]];
        for (const [label, content] of fields) if (text(content)) out.push(`**${label}:** ${md(content)}`, "");
      }
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  return { createId, sessionReference, ensureSessionReference, ensureSessionReferences, referencesMatch, findSession, resolveSession: findSession, findLinkedSessionItem, recordReference, normalizePrep, findPrepForSession, ensurePrep, readiness, resolvePinnedRecord, resolveRecord: resolvePinnedRecord, exportMarkdown };
});
