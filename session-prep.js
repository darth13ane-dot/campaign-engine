(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./prep-sources.js") : root.CampaignPrepSources);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignSessionPrep = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (SOURCES) {
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
    // A session can own several separately reviewed player packets.
    linked.push(...Object.values(campaign?.sessionWorkflow?.playerPackets || {}).filter(packet => object(packet) && findLinkedSessionItem(campaign, session, [packet]) === packet));
    const reference = ensureSessionReference(session);
    for (const item of linked) item.sessionRef = { ...reference };
    return reference;
  }

  function recordReference(value) {
    if (value?.type === "reference") return { ...SOURCES.reference(value), ...provenanceFields(value) };
    const reference = { type: text(value?.type, 40), name: text(value?.name || value?.title, 200) };
    for (const field of identityFields) if (text(value?.[field], 160)) reference[field] = text(value[field], 160);
    return { ...reference, ...provenanceFields(value) };
  }

  function normalizeProvenance(value) {
    if (!object(value) || !text(value.key, 1500)) return null;
    const result = { key: text(value.key, 1500), sourceCollection: text(value.sourceCollection, 60), sourceRowId: text(value.sourceRowId, 200) };
    if (text(value.sourceDeskId, 160)) result.sourceDeskId = text(value.sourceDeskId, 160);
    if (object(value.sourceSessionRef)) result.sourceSessionRef = sessionReference(value.sourceSessionRef);
    if (object(value.recordRef)) {
      if (value.recordRef.type === "reference") result.recordRef = SOURCES.reference(value.recordRef);
      else {
        result.recordRef = { type: text(value.recordRef.type, 40), name: text(value.recordRef.name, 200) };
        for (const field of identityFields) if (text(value.recordRef[field], 160)) result.recordRef[field] = text(value.recordRef[field], 160);
      }
    }
    if (text(value.label, 500)) result.label = text(value.label, 500);
    if (value.sourceCollection === "notes") {
      result.sourceNotes = rows(value.sourceNotes).slice(0, 12).map(note => ({ label: text(note.label, 240), text: text(note.text, 1000), ...(object(note.ref) ? { ref: note.ref.type === "reference" ? SOURCES.reference(note.ref) : { type: text(note.ref.type, 40), ...sessionReference(note.ref) } } : {}) }));
      result.additions = text(value.additions, 2000);
    }
    return result;
  }

  function referenceKey(value) {
    if (value?.type === "reference") return SOURCES.key(value);
    const ref = recordReference(value), field = identityFields.find(field => ref[field]);
    return `${ref.type}:${field ? `${field}:${ref[field]}` : `name:${ref.name}`}`;
  }

  function normalizeReferences(value) {
    const seen = new Set();
    return rows(value).map(recordReference).filter(ref => {
      if (!["character", "quest", "location", "journal", "session", "arc", "reference"].includes(ref.type) || !ref.name) return false;
      const key = referenceKey(ref);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sceneReferenceFields(value) {
    const references = normalizeReferences(value?.references);
    return references.length ? { references } : {};
  }

  function provenanceFields(value) {
    const provenance = normalizeProvenance(value?.provenance);
    return provenance ? { provenance } : {};
  }

  function promptFields(value, allowed) {
    const prompts = Object.fromEntries(allowed.filter(key => typeof value?.prompts?.[key] === "string" && text(value.prompts[key], 6000)).map(key => [key, text(value.prompts[key], 6000)]));
    return Object.keys(prompts).length ? { prompts } : {};
  }

  function normalizePrep(value, key) {
    if (!object(value)) return null;
    const prepId = text(value.id || key, 160) || createId();
    const rowId = (row, kind, index) => text(row.id, 160) || `${prepId}-${kind}-${index}`;
    return {
      id: prepId,
      sessionRef: sessionReference(value.sessionRef || { name: value.sessionTitle }),
      opening: text(value.opening),
      ...(Array.isArray(value.openingProvenance) ? { openingProvenance: value.openingProvenance.map(normalizeProvenance).filter(Boolean) } : {}),
      ...promptFields(value, ["opening"]),
      ...(object(value.continuityReview) ? { continuityReview: JSON.parse(JSON.stringify(value.continuityReview)) } : {}),
      ...(object(value.templateReview) ? { templateReview: JSON.parse(JSON.stringify(value.templateReview)) } : {}),
      ...(object(value.notesWorkbench) ? { notesWorkbench: JSON.parse(JSON.stringify(value.notesWorkbench)) } : {}),
      durationMinutes: integer(value.durationMinutes, 180, 15, 1440),
      scenes: rows(value.scenes).map((scene, index) => ({ id: rowId(scene, "scene", index), title: text(scene.title, 240), kind: ["scene", "social", "exploration", "combat", "pressure"].includes(scene.kind) ? scene.kind : "scene", minutes: integer(scene.minutes, 30, 0, 1440), detail: text(scene.detail), question: text(scene.question, 4000), ...promptFields(scene, ["title", "detail", "question"]), ...provenanceFields(scene), ...sceneReferenceFields(scene) })),
      pinned: rows(value.pinned).map(recordReference).filter(entry => entry.type && entry.name),
      revelations: rows(value.revelations).map((item, index) => ({ id: rowId(item, "revelation", index), text: text(item.text, 4000), checked: Boolean(item.checked), ...promptFields(item, ["text"]), ...provenanceFields(item) })),
      clocks: rows(value.clocks).map((clock, index) => {
        const max = integer(clock.max, 4, 1, 20);
        return { id: rowId(clock, "clock", index), label: text(clock.label, 160), max, value: integer(clock.value, 0, 0, max), ...promptFields(clock, ["label"]), ...provenanceFields(clock) };
      }),
      spotlights: rows(value.spotlights).map((item, index) => ({ id: rowId(item, "spotlight", index), character: text(item.character, 200), opportunity: text(item.opportunity, 4000), ...promptFields(item, ["character", "opportunity"]), ...provenanceFields(item) })),
      tasks: rows(value.tasks).map((item, index) => ({ id: rowId(item, "task", index), text: text(item.text, 1000), done: Boolean(item.done), ...promptFields(item, ["text"]), ...provenanceFields(item) }))
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
    const references = [...rows(prep?.pinned), ...scenes.flatMap(scene => rows(scene.references))];
    const namedScenes = scenes.filter(scene => text(scene.title));
    const durationMinutes = integer(prep?.durationMinutes, 180, 15, 1440);
    const plannedMinutes = scenes.reduce((sum, scene) => sum + integer(scene.minutes, 30, 0, 1440), 0);
    const checks = [
      { id: "opening", label: "Opening situation written", done: Boolean(text(prep?.opening)) },
      { id: "scenes", label: "Scenes include a situation and choice", done: namedScenes.length > 0 && scenes.every(scene => text(scene.title) && text(scene.detail) && text(scene.question)) },
      { id: "timing", label: "Scene timings fit the session", done: namedScenes.length > 0 && scenes.every(scene => text(scene.title) && Number(scene.minutes) > 0) && plannedMinutes <= durationMinutes },
      { id: "spotlights", label: "Player spotlights described", done: rows(prep?.spotlights).length > 0 && rows(prep?.spotlights).every(item => text(item.character) && text(item.opportunity)) },
      { id: "records", label: "Key campaign records at hand", done: references.length > 0 && references.every(item => text(item.type) && text(item.name) && (!campaign || resolvePinnedRecord(campaign, item))) },
      { id: "tasks", label: "No outstanding prep tasks", done: tasks.every(item => text(item.text) && item.done === true) }
    ].map(check => ({ ...check, done: Boolean(check.done) }));
    const nextSteps = [];
    const add = (id, label, action, target) => nextSteps.push({ id, label, action, target });
    const field = (collection, index, key) => ({ type: "field", collection, index, field: key });
    if (!text(prep?.opening)) add("opening", "Set the opening situation", "Write what puts the session in motion.", field(null, 0, "opening"));
    if (!scenes.length) add("scenes", "Prepare the first situation", "Add a scene, its pressure, and a player choice.", { type: "add", collection: "scenes" });
    scenes.forEach((scene, index) => {
      const label = `Scene ${index + 1}${text(scene.title) ? ` · ${text(scene.title, 100)}` : ""}`;
      const missing = [["title", "title"], ["detail", "situation"], ["question", "player choice"]].filter(([key]) => !text(scene[key]));
      if (missing.length) add(`scene-${index}`, label, `Add ${missing.map(([, name]) => name).join(", ")}.`, field("scenes", index, missing[0][0]));
      if (!(Number(scene.minutes) > 0)) add(`time-${index}`, label, "Estimate the time this situation may need.", field("scenes", index, "minutes"));
    });
    if (plannedMinutes > durationMinutes) add("budget", `${plannedMinutes - durationMinutes} minutes over the session budget`, "Review the session length and scene estimates.", field(null, 0, "durationMinutes"));
    if (!references.length) add("references", "Keep useful campaign material at hand", "Find a record or PDF page to pin.", { type: "pins" });
    const reviewReferences = (values, sceneIndex = null) => rows(values).forEach((ref, index) => {
      if (text(ref.type) && text(ref.name) && (!campaign || resolvePinnedRecord(campaign, ref))) return;
      add(`reference-${sceneIndex ?? "pin"}-${index}`, `Unavailable · ${text(ref.name, 100) || "Unnamed reference"}`,
        sceneIndex == null ? "Review this pinned reference; keep it or choose a replacement." : `Review the reference in scene ${sceneIndex + 1}; keep it or link a replacement.`,
        sceneIndex == null ? { type: "pin", index } : { type: "scene-reference", index: sceneIndex });
    });
    reviewReferences(prep?.pinned);
    scenes.forEach((scene, index) => reviewReferences(scene.references, index));
    const spotlights = rows(prep?.spotlights);
    if (!spotlights.length) add("spotlights", "Consider a character spotlight", "Choose a character and an opportunity for this session.", { type: "add", collection: "spotlights" });
    spotlights.forEach((item, index) => {
      if (!text(item.character) || !text(item.opportunity)) add(`spotlight-${index}`, `Spotlight ${index + 1}${text(item.character) ? ` · ${text(item.character, 100)}` : ""}`, "Name the character and describe their opportunity.", field("spotlights", index, text(item.character) ? "opportunity" : "character"));
    });
    for (const [collection, key, label] of [["revelations", "text", "Revelation"], ["clocks", "label", "Clock"]]) rows(prep?.[collection]).forEach((item, index) => {
      if (!text(item[key])) add(`${collection}-${index}`, `${label} ${index + 1} needs a description`, "Develop this entry or remove it from the plan.", field(collection, index, key));
    });
    tasks.forEach((task, index) => {
      if (!text(task.text) || task.done !== true) add(`task-${index}`, text(task.text, 100) || `Prep task ${index + 1} needs a description`, text(task.text) ? "Review the task and mark it complete when ready." : "Describe the work or remove this task.", field("tasks", index, text(task.text) ? "done" : "text"));
    });
    const draft = prep?.notesWorkbench?.schemaVersion === 1 ? prep.notesWorkbench.draft : null;
    if (rows(draft?.rows).length) add("notes-draft", `${draft.rows.length} ${draft.rows.length === 1 ? "piece remains" : "pieces remain"} in your notes draft`, "Review the pieces you still want to use.", { type: "notes" });
    return { checks, complete: checks.filter(check => check.done).length, total: checks.length, plannedMinutes, durationMinutes, nextSteps };
  }

  function resolvePinnedRecord(campaign, reference) {
    if (reference?.type === "reference") return SOURCES.resolve(campaign, reference);
    const collection = { character: "characters", characters: "characters", quest: "quests", quests: "quests", location: "locations", locations: "locations", journal: "journal", session: "sessions", arc: "arcs" }[reference?.type];
    const records = rows(campaign?.[collection]);
    const exact = records.filter(record => referencesMatch(reference, record));
    if (exact.length) return exact.length === 1 ? exact[0] : null;
    const legacy = records.filter(record => referencesMatch(reference, record, { allowLegacyName: true }));
    return legacy.length === 1 ? legacy[0] : null;
  }

  function sameRecordReference(campaign, left, right) {
    if (left?.type !== right?.type) return false;
    const record = resolvePinnedRecord(campaign, left);
    return Boolean(record) && (left.type === "reference" ? referenceKey(left) === referenceKey(right) : record === resolvePinnedRecord(campaign, right));
  }

  function describeProvenance(campaign, value) {
    const provenance = normalizeProvenance(value);
    if (!provenance) return null;
    if (provenance.sourceCollection === "notes") {
      const notes = provenance.sourceNotes || [];
      const missing = notes.some(note => note.ref && !resolvePinnedRecord(campaign, note.ref));
      return { label: notes.map(note => note.label).join("; ") || "Selected notes", context: notes.map(note => `${note.label}: “${note.text}”`).join("\n\n") + (provenance.additions ? `\n\nSuggested additions reviewed by the GM: ${provenance.additions}` : "") + (missing ? "\n\nAn original source is unavailable; these excerpts were retained with the prepared piece." : ""), missing, record: null, recordRef: null, session: null, desk: null };
    }
    const record = provenance.recordRef ? resolvePinnedRecord(campaign, provenance.recordRef) : null;
    const recordKinds = { character: "Character", quest: "Quest", location: "World entry", journal: "Journal", session: "Session", arc: "Story arc" };
    const recordLabel = provenance.recordRef ? `${recordKinds[provenance.recordRef.type] || "Campaign record"} · ${text(record?.name || record?.title || provenance.recordRef.name || "Unnamed record", 200)}` : "";
    if (!provenance.sourceDeskId && !provenance.sourceSessionRef) {
      return {
        label: recordLabel || provenance.label || "Earlier preparation",
        context: record ? provenance.label || "Carried forward from this campaign record." : "The source record is no longer available. This carried material remains in your plan.",
        missing: !record, session: null, desk: null, record, recordRef: provenance.recordRef || null
      };
    }
    const session = provenance.sourceSessionRef ? findSession(campaign, provenance.sourceSessionRef) : null;
    const matchingDesks = Object.values(campaign?.sessionWorkflow?.desks || {}).filter(desk => object(desk) && desk.id === provenance.sourceDeskId);
    const savedDesk = matchingDesks.length === 1 ? matchingDesks[0] : null;
    const deskSession = savedDesk ? findSession(campaign, savedDesk.sessionRef) : null;
    const deskMatches = savedDesk && (!provenance.sourceSessionRef
      || referencesMatch(provenance.sourceSessionRef, savedDesk.sessionRef)
      || (session && deskSession === session));
    const desk = deskMatches && ["ended", "completed"].includes(savedDesk.status) ? savedDesk : null;
    const resolvedSession = session || (!provenance.sourceSessionRef ? deskSession : null);
    const name = text(resolvedSession?.title || resolvedSession?.name || provenance.sourceSessionRef?.name || (deskMatches && savedDesk.sessionRef?.name) || "Earlier session", 200);
    const sourceKinds = { beats: "a scene in the ended session log", scenes: "an earlier prepared scene", directions: "a saved possible direction", revelations: "an earlier clue or revelation", clocks: "an earlier clock or counter", spotlights: "an earlier character spotlight", tasks: "an earlier preparation task", pinned: "an earlier pinned campaign reference" };
    const notices = [`Carried forward from ${sourceKinds[provenance.sourceCollection] || "this session's preparation or recorded play"}.`];
    if (!resolvedSession) notices.push("The source session record is no longer available.");
    if (provenance.sourceDeskId && !desk) notices.push(deskMatches ? "The source session log is available after that session has ended." : "The source session log is no longer available.");
    if (provenance.recordRef && !record) notices.push("The linked source record is no longer available.");
    return {
      label: name, context: notices.join(" "),
      missing: !resolvedSession || Boolean(provenance.sourceDeskId && !desk) || Boolean(provenance.recordRef && !record),
      session: resolvedSession, desk, record, recordRef: provenance.recordRef || null
    };
  }

  // Packets keep complete selected text; input limits belong to the prep editor.
  function packetText(value) {
    if (Array.isArray(value)) return value.map(packetText).filter(Boolean).map(item => "- " + item.replace(/\n/g, "\n  ")).join("\n");
    if (object(value)) return Object.entries(value).map(([key, item]) => {
      const content = packetText(item);
      return content ? key + ":" + (item && typeof item === "object" ? "\n  " + content.replace(/\n/g, "\n  ") : " " + content) : "";
    }).filter(Boolean).join("\n");
    return String(value ?? "").replace(/\r\n?/g, "\n").trim();
  }
  function packetSections(campaign, session, value) {
    const prep = normalizePrep(value || { sessionRef: sessionReference(session) });
    const sections = [];
    const section = (id, title, level = 2) => { const item = { id, title, level, blocks: [] }; sections.push(item); return item.blocks; };
    const prose = (blocks, content, type = "text") => { if (packetText(content)) blocks.push({ type, text: packetText(content) }); };
    const attribution = item => {
      const source = describeProvenance(campaign, item.provenance);
      return source ? "From " + source.label + (source.missing ? " — source unavailable" : "") + ". " + source.context : "";
    };
    const scenes = prep.scenes.filter(scene => scene.title || scene.detail || scene.question || scene.references?.length);
    const references = normalizeReferences([...prep.pinned, ...scenes.flatMap(scene => scene.references || [])]);
    const records = references.map((reference, index) => ({ reference, record: resolvePinnedRecord(campaign, reference), id: "record-" + (index + 1) }));
    const referenceLink = ref => {
      const linked = records.find(item => referenceKey(item.reference) === referenceKey(ref));
      const record = linked?.record;
      return { text: (record?.name || record?.title || ref.name) + " (" + ref.type + ")" + (record ? "" : " — unavailable"), target: linked?.id };
    };
    const opening = section("opening", "Opening situation");
    prose(opening, prep.opening || "Opening still to prepare.");
    for (const provenance of prep.openingProvenance || []) prose(opening, attribution({ provenance }), "attribution");
    if (packetText(session?.recap)) prose(section("session-notes", "Session plan"), session.recap);
    const directions = (Array.isArray(session?.directions) ? session.directions : []).map(packetText).filter(Boolean);
    if (directions.length) section("directions", "Possible directions").push({ type: "list", items: directions.map(text => ({ text })) });
    const outline = section("scenes", "Flexible scenes");
    if (!scenes.length) prose(outline, "Scenes still to prepare.");
    else outline.push({ type: "list", items: scenes.map((scene, index) => ({ text: (index + 1) + ". " + (scene.title || "Untitled scene") + " · " + scene.minutes + " min", target: "scene-" + (index + 1) })) });
    scenes.forEach((scene, index) => {
      const blocks = section("scene-" + (index + 1), (index + 1) + ". " + (scene.title || "Untitled scene"), 3);
      prose(blocks, scene.kind + " · " + scene.minutes + " minutes", "meta");
      prose(blocks, scene.detail);
      if (scene.question) blocks.push({ type: "field", label: "Meaningful choice", text: scene.question });
      if (scene.references?.length) blocks.push({ type: "references", items: scene.references.map(referenceLink) });
      prose(blocks, attribution(scene), "attribution");
    });
    const list = (id, title, entries) => { if (entries.length) section(id, title).push({ type: "list", items: entries }); };
    list("spotlights", "Player spotlights", prep.spotlights.filter(item => item.character || item.opportunity).map(item => ({ label: item.character || "Choose a character", text: item.opportunity, attribution: attribution(item) })));
    list("revelations", "Clues & revelations", prep.revelations.filter(item => item.text).map(item => ({ text: item.text, attribution: attribution(item) })));
    list("clocks", "Clocks & counters", prep.clocks.filter(clock => clock.label).map(clock => ({ text: clock.label + ": " + clock.value + "/" + clock.max, attribution: attribution(clock) })));
    list("tasks", "Prep tasks", prep.tasks.filter(item => item.text).map(item => ({ text: item.text, checked: item.done, attribution: attribution(item) })));
    const guidance = [];
    if (!prep.opening && prep.prompts?.opening) guidance.push({ label: "Opening", text: prep.prompts.opening });
    for (const [collection, label] of [["scenes", "Scene"], ["spotlights", "Spotlight"], ["revelations", "Revelation"], ["clocks", "Counter"], ["tasks", "Task"]]) {
      prep[collection].forEach((item, index) => {
        for (const [field, prompt] of Object.entries(item.prompts || {})) if (!text(item[field]) && text(prompt)) guidance.push({ label: label + " " + (index + 1) + " · " + field, text: prompt });
      });
    }
    list("prompts", "Planning prompts still to develop", guidance);
    if (records.length) section("records", "Pinned campaign records");
    for (const { reference, record, id } of records) {
      const blocks = section(id, (record?.name || record?.title || reference.name) + " (" + reference.type + ")", 3);
      prose(blocks, attribution(reference), "attribution");
      if (!record) { prose(blocks, "This linked record is unavailable. Review its link in the campaign."); continue; }
      const fields = [["Role", record.role], ["Status", record.status], ["Overview", record.description], ["Details", record.detail], [record.referenceType === "pdf" ? "Extracted PDF text" : "Journal entry", record.body], ["Session notes", record.recap], ["Pressure", record.tension], ["Next step", record.nextStep], ["Voice", record.voice], ["Quirks", record.quirks], ["Relationships", record.relationships], ["Stats", record.statBlock], ["Tags", record.tags], ["Factions", record.factions]];
      for (const [label, content] of fields) if (packetText(content)) blocks.push({ type: "field", label, text: packetText(content) });
    }
    const timing = readiness(prep);
    return {
      title: packetText(session?.title || prep.sessionRef.name) + " — Session Prep",
      metadata: [
        ["Campaign", packetText(campaign?.title || "Campaign")],
        ["System", packetText(campaign?.system || "System neutral")],
        ["Session", packetText(session?.number || prep.sessionRef.number || "Unnumbered") + " · " + packetText(session?.date || "Unscheduled")],
        ["Time", timing.plannedMinutes + " minutes planned / " + timing.durationMinutes + " minutes available"]
      ], sections
    };
  }

  function exportMarkdown(campaign, session, value) {
    const packet = packetSections(campaign, session, value);
    const md = value => packetText(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\\x60*_{}\[\]()#+.!|~-])/g, "\\$1");
    const line = value => md(value).replace(/\n/g, " ");
    const out = ["# " + line(packet.title), "", "**GM ONLY — PRIVATE PREPARATION**", "", ...packet.metadata.map(([label, content]) => label + ": " + line(content))];
    for (const section of packet.sections) {
      out.push("", "#".repeat(section.level) + " " + line(section.title), "");
      for (const block of section.blocks) {
        if (block.type === "list") out.push(...block.items.map(item => "- " + (typeof item.checked === "boolean" ? "[" + (item.checked ? "x" : " ") + "] " : "") + (item.label ? "**" + line(item.label) + ":** " : "") + md(item.text).replace(/\n/g, "\n  ") + (item.attribution ? "\n  " + md(item.attribution).replace(/\n/g, "\n  ") : "")), "");
        else if (block.type === "references") out.push("**At hand:** " + block.items.map(item => line(item.text)).join("; "), "");
        else out.push((block.type === "field" ? "**" + line(block.label) + ":** " : "") + md(block.text), "");
      }
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function exportHTML(campaign, session, value) {
    const packet = packetSections(campaign, session, value);
    const html = value => packetText(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
    const link = item => item.target ? '<a href="#' + html(item.target) + '">' + html(item.text) + "</a>" : html(item.text);
    const blockHTML = block => {
      if (block.type === "references") return '<div class="references"><strong>At hand</strong><ul>' + block.items.map(item => "<li>" + link(item) + "</li>").join("") + "</ul></div>";
      if (block.type === "list") return "<ul>" + block.items.map(item => "<li>" + (typeof item.checked === "boolean" ? '<span class="task-state">' + (item.checked ? "☑" : "☐") + "</span> " : "") + (item.label ? "<strong>" + html(item.label) + ":</strong> " : "") + link(item) + (item.attribution ? '<p class="attribution">' + html(item.attribution) + "</p>" : "") + "</li>").join("") + "</ul>";
      return '<div class="' + (block.type === "attribution" ? "attribution" : block.type === "meta" ? "scene-meta" : block.type === "field" ? "field" : "prose") + '">' + (block.type === "field" ? "<strong>" + html(block.label) + "</strong>" : "") + "<p>" + html(block.text) + "</p></div>";
    };
    const css = "body{margin:0;color:#252b2c;background:#eceeea;font:16px/1.65 Georgia,serif}main{max-width:860px;margin:32px auto;padding:42px 48px;background:#fff}h1,h2,h3,p,li,dd{overflow-wrap:anywhere}h1,h2,h3{line-height:1.25;white-space:pre-wrap}h1{font-size:32px;margin:12px 0 24px}h2{font-size:23px;border-bottom:1px solid #c9d5d1;padding-bottom:9px;margin:36px 0 18px}h3{font-size:19px;margin:26px 0 12px}p{white-space:pre-wrap;margin:0 0 12px}.private{font:700 11px/1.5 Arial,sans-serif;letter-spacing:.13em;color:#78402a}.metadata{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 16px;font:13px/1.65 Arial,sans-serif;margin:0 0 24px}.metadata dt{font-weight:700}.metadata dd{margin:0;white-space:pre-wrap}a{color:#215e57;text-decoration-thickness:1px;text-underline-offset:3px}a:focus-visible{outline:2px solid #215e57;outline-offset:3px}nav{border:1px solid #c9d5d1;padding:14px 18px;font:13px/1.7 Arial,sans-serif}nav ul{display:flex;flex-wrap:wrap;gap:7px 18px;list-style:none;padding:0;margin:7px 0 0}li{white-space:pre-wrap;margin:5px 0}ul{padding-left:22px}.scene-meta{font:700 12px/1.6 Arial,sans-serif;color:#4c6560;margin:0 0 12px}.field>strong{display:block;font:700 12px/1.6 Arial,sans-serif;color:#3f514d;margin:16px 0 5px}.attribution{font:12px/1.7 Arial,sans-serif;color:#4d5b56;border-left:2px solid #b6c7bf;padding-left:12px;margin:14px 0}.attribution p{margin:0}.references{font:13px/1.65 Arial,sans-serif;background:#f3f6f3;padding:12px 16px;margin:16px 0}.references ul{margin:5px 0 0}.task-state{font-family:Arial,sans-serif}.footer{border-top:1px solid #c9d5d1;margin-top:36px;padding-top:12px;font:11px/1.6 Arial,sans-serif;color:#52615b}@media(max-width:620px){body{background:#fff}main{margin:0;padding:24px 20px}h1{font-size:27px}.metadata{grid-template-columns:1fr;gap:0}.metadata dd{margin-bottom:8px}}@media print{body{background:#fff;font-size:11pt;line-height:1.5}main{max-width:none;margin:0;padding:0}nav{display:none}h1{font-size:24pt}h2{font-size:17pt}h3{font-size:14pt}h1,h2,h3,.field>strong{break-after:avoid}p,li{orphans:3;widows:3}a{color:inherit;text-decoration:none}.references{background:none;border:1px solid #bbc6c1}.attribution{font-size:9pt}.metadata{font-size:10pt}@page{margin:17mm}}";
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>' + html(packet.title) + "</title><style>" + css + '</style></head><body><main><header><p class="private">GM ONLY — PRIVATE PREPARATION</p><h1>' + html(packet.title) + '</h1><dl class="metadata">' + packet.metadata.map(([label, content]) => "<dt>" + html(label) + "</dt><dd>" + html(content) + "</dd>").join("") + '</dl></header><nav aria-label="Run sheet contents"><strong>On this sheet</strong><ul>' + packet.sections.filter(section => section.level === 2).map(section => '<li><a href="#' + section.id + '">' + html(section.title) + "</a></li>").join("") + "</ul></nav>" + packet.sections.map(section => '<section id="' + section.id + '"><h' + section.level + ">" + html(section.title) + "</h" + section.level + ">" + section.blocks.map(blockHTML).join("") + "</section>").join("") + '<p class="footer">GM ONLY · Snapshot of session preparation and linked campaign material. Use your browser’s Print command to print or save as PDF.</p></main></body></html>\n';
  }
  return { createId, sessionReference, ensureSessionReference, ensureSessionReferences, referencesMatch, findSession, resolveSession: findSession, findLinkedSessionItem, recordReference, referenceKey, sameRecordReference, sourceRecords: SOURCES.listRecords, normalizeReferences, sceneReferenceFields, normalizeProvenance, provenanceFields, normalizePrep, findPrepForSession, ensurePrep, readiness, resolvePinnedRecord, resolveRecord: resolvePinnedRecord, describeProvenance, exportMarkdown, exportHTML };
});
