(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./session-prep.js") : root.CampaignSessionPrep, common ? require("./prep-template-starters.js") : root.CampaignPrepTemplateStarters);
  if (common) module.exports = api;
  if (root) root.CampaignPrepTemplates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PREP, STARTERS) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const COLLECTIONS = ["scenes", "revelations", "clocks", "spotlights", "tasks"];
  const FIELDS = { scenes: ["title", "detail", "question"], revelations: ["text"], clocks: ["label"], spotlights: ["character", "opportunity"], tasks: ["text"] };
  const KINDS = ["scene", "social", "exploration", "combat", "pressure"];
  const IDS = ["archivistId", "localId", "id"];
  const normalizedLibraries = new WeakSet();
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const rows = value => Array.isArray(value) ? value.filter(object) : [];
  const text = (value, limit = 12000) => ["string", "number", "boolean"].includes(typeof value) ? String(value).replace(/\r\n?/g, "\n").trim().slice(0, limit) : "";
  const clone = value => structuredClone(value);
  const integer = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== "" && value != null ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;
  const stable = reference => IDS.some(field => text(reference?.[field], 160));
  const promptFields = (value, fields) => Object.fromEntries(fields.filter(field => text(value?.[field], 4000)).map(field => [field, text(value[field], 4000)]));
  function checkSchema(value, noun) {
    if (object(value) && value.schemaVersion != null && value.schemaVersion !== SCHEMA_VERSION) throw new Error(`This ${noun} uses an unsupported schema version. Its saved data has been preserved.`);
  }

  function normalizeTemplate(value, key) {
    if (!object(value)) return null;
    checkSchema(value, "prep template");
    const template = {
      schemaVersion: SCHEMA_VERSION, id: text(value.id || key, 160) || PREP.createId("template"),
      name: text(value.name, 160) || "Untitled template", summary: text(value.summary, 1000),
      durationMinutes: integer(value.durationMinutes, 180, 15, 1440), openingPrompt: text(value.openingPrompt, 4000)
    };
    for (const collection of COLLECTIONS) template[collection] = rows(value[collection]).map(row => ({
      ...(collection === "scenes" ? { kind: KINDS.includes(row.kind) ? row.kind : "scene", minutes: integer(row.minutes, 30, 0, 1440) } : {}),
      ...(collection === "clocks" ? { max: integer(row.max, 4, 1, 20) } : {}),
      ...(row.optional === true ? { optional: true } : {}), prompts: promptFields(row.prompts, FIELDS[collection])
    }));
    return template;
  }
  function builtins() {
    return rows(STARTERS).map(template => ({ ...normalizeTemplate(template), builtin: true }));
  }
  function normalizeLibrary(value) {
    checkSchema(value, "prep template library");
    const items = Object.entries(object(value?.templates) ? value.templates : {}).map(([key, template]) => normalizeTemplate(template, key)).filter(Boolean);
    const reserved = new Set([...builtins().map(template => template.id), ...items.map(template => template.id)]), templates = {};
    const builtinIds = new Set(builtins().map(template => template.id));
    let recovered = 0;
    for (const template of items) {
      if (Object.hasOwn(templates, template.id) || builtinIds.has(template.id)) {
        const prefix = template.id.slice(0, 130);
        do { template.id = `${prefix}-copy-${++recovered}`; } while (reserved.has(template.id));
        reserved.add(template.id);
      }
      Object.defineProperty(templates, template.id, { value: template, enumerable: true, writable: true, configurable: true });
    }
    const library = { schemaVersion: SCHEMA_VERSION, templates };
    normalizedLibraries.add(library);
    return library;
  }
  function ensureLibrary(state) {
    if (!object(state)) throw new Error("Open a workspace before using prep templates.");
    checkSchema(state.prepTemplates, "prep template library");
    if (!object(state.prepTemplates) || !normalizedLibraries.has(state.prepTemplates)) state.prepTemplates = normalizeLibrary(state.prepTemplates);
    return state.prepTemplates;
  }
  function requireLibrary(library) {
    checkSchema(library, "prep template library");
    if (!object(library) || library.schemaVersion !== SCHEMA_VERSION || !object(library.templates)) throw new Error("Initialize the workspace template library before saving changes.");
  }
  function listTemplates(library) {
    requireLibrary(library);
    return [...builtins(), ...Object.values(library.templates).map(value => normalizeTemplate(value)).filter(Boolean).map(template => ({ ...template, builtin: false }))];
  }
  function createTemplate(values = {}) {
    return normalizeTemplate({ ...values, schemaVersion: SCHEMA_VERSION, id: PREP.createId("template") });
  }
  function saveTemplate(library, value) {
    requireLibrary(library);
    const template = normalizeTemplate(value);
    if (!template) throw new Error("Choose a template to save.");
    if (builtins().some(builtin => builtin.id === template.id)) throw new Error("Duplicate a built-in template before saving your changes.");
    Object.defineProperty(library.templates, template.id, { value: template, enumerable: true, writable: true, configurable: true });
    return template;
  }
  function deleteTemplate(library, id) {
    requireLibrary(library);
    if (!Object.hasOwn(library.templates, id)) return false;
    delete library.templates[id];
    return true;
  }
  function duplicateTemplate(value, options = {}) {
    const template = normalizeTemplate(value);
    if (!template) throw new Error("Choose a template to duplicate.");
    return createTemplate({ ...template, name: options.name == null ? `${template.name} copy` : options.name });
  }

  const GENERIC = {
    opening: "What immediate situation starts play, and what can the characters choose to do?",
    scenes: { title: "Name this scene's situation.", detail: "Who wants what here? Prepare the situation, useful details, and stakes.", question: "What meaningful choice or discovery can change the situation?" },
    revelations: { text: "What useful truth can the characters discover, and where might it surface?" },
    clocks: { label: "What pressure or progress does this counter track?" },
    spotlights: { character: "Choose a character for this opportunity.", opportunity: "How can this character's goals or abilities matter in this session?" },
    tasks: { text: "What concrete preparation remains before the session?" }
  };
  function captureStructure(prep, options = {}) {
    if (!object(prep)) throw new Error("Choose a session preparation to capture.");
    const structure = { name: options.name == null ? "Saved prep structure" : options.name, summary: options.summary || "", durationMinutes: integer(prep.durationMinutes, 180, 15, 1440), openingPrompt: GENERIC.opening };
    for (const collection of COLLECTIONS) structure[collection] = rows(prep[collection]).map(row => ({
      ...(collection === "scenes" ? { kind: KINDS.includes(row.kind) ? row.kind : "scene", minutes: integer(row.minutes, 30, 0, 1440) } : {}),
      ...(collection === "clocks" ? { max: integer(row.max, 4, 1, 20) } : {}),
      prompts: { ...GENERIC[collection] }
    }));
    return createTemplate(structure);
  }

  function material(value, key = "") {
    if (Array.isArray(value)) return value.map(item => material(item));
    if (!object(value)) return value;
    const reference = key === "sessionRef" && stable(value);
    return Object.fromEntries(Object.keys(value).sort().filter(field => !["templateReview", "continuityReview", "updatedAt"].includes(field) && !(reference && ["name", "number"].includes(field))).map(field => [field, material(value[field], field)]));
  }
  const fingerprint = value => JSON.stringify(material(value));
  function resolveTarget(campaign, session) {
    if (!object(campaign) || !object(session)) throw new Error("Choose a session to prepare with this template.");
    const reference = PREP.sessionReference(session), target = PREP.findSession(campaign, reference);
    if (!target || !stable(reference)) throw new Error("The template's target session is missing or its identity is ambiguous. Open its session prep again.");
    const prep = PREP.findPrepForSession(campaign, target);
    if (!prep) throw new Error("Open session prep before reviewing a template.");
    const desks = Object.values(campaign.sessionWorkflow?.desks || {}).filter(desk => object(desk) && PREP.findSession(campaign, desk.sessionRef) === target).map(desk => ({ id: desk.id, status: desk.status }));
    return { target, prep, desks };
  }
  function emptyRow(collection, slot) {
    return {
      ...Object.fromEntries(FIELDS[collection].map(field => [field, ""])), prompts: clone(slot.prompts),
      ...(collection === "scenes" ? { kind: slot.kind, minutes: slot.minutes } : {}),
      ...(collection === "clocks" ? { max: slot.max, value: 0 } : {}),
      ...(collection === "revelations" ? { checked: false } : {}),
      ...(collection === "tasks" ? { done: false } : {})
    };
  }
  function buildReview(campaign, session, sourceTemplate) {
    const { target, prep, desks } = resolveTarget(campaign, session), template = normalizeTemplate(sourceTemplate);
    if (!template) throw new Error("Choose a prep template to review.");
    const candidates = template.openingPrompt ? [{ id: "opening", collection: "opening", selected: true, after: { opening: "", prompts: { opening: template.openingPrompt } } }] : [];
    for (const collection of COLLECTIONS) template[collection].forEach((slot, index) => candidates.push({ id: `${collection}:${index}`, collection, selected: slot.optional !== true, after: emptyRow(collection, slot) }));
    return {
      schemaVersion: SCHEMA_VERSION, id: PREP.createId("template-review"), campaignId: String(campaign.id),
      template: { id: template.id, name: template.name, durationMinutes: template.durationMinutes },
      target: { sessionRef: PREP.sessionReference(target), prepId: prep.id, hasLiveDesk: desks.length > 0, before: { opening: text(prep.opening), durationMinutes: prep.durationMinutes, counts: Object.fromEntries(COLLECTIONS.map(collection => [collection, rows(prep[collection]).length])) } },
      snapshot: { template: fingerprint(template), target: fingerprint({ prep, desks }) }, useDuration: false, rows: candidates
    };
  }
  function freshReview(campaign, session, template, review) {
    if (!object(review) || review.schemaVersion !== SCHEMA_VERSION || !object(review.target) || !object(review.snapshot) || !Array.isArray(review.rows)) throw new Error("This template review is invalid. Refresh it before applying.");
    if (review.campaignId !== String(campaign?.id)) throw new Error("This template review belongs to a different campaign.");
    const { target, prep } = resolveTarget(campaign, session);
    if (PREP.findSession(campaign, review.target.sessionRef) !== target || review.target.prepId !== prep.id) throw new Error("The reviewed session preparation is missing or has changed identity.");
    const fresh = buildReview(campaign, target, template);
    if (fresh.snapshot.template !== review.snapshot.template) throw new Error("The source template changed. Refresh the review before applying.");
    if (fresh.snapshot.target !== review.snapshot.target) throw new Error("The session preparation or live status changed. Refresh the review before applying.");
    const seen = new Set();
    for (const row of review.rows) {
      if (!object(row) || seen.has(row.id) || !fresh.rows.some(candidate => candidate.id === row.id && candidate.collection === row.collection)) throw new Error("A template review row is unavailable or duplicated. Refresh the review.");
      seen.add(row.id);
    }
    return { fresh, prep };
  }
  function validateReview(campaign, session, template, review) {
    try { freshReview(campaign, session, template, review); return { valid: true, error: "" }; }
    catch (error) { return { valid: false, error: error.message }; }
  }
  function normalizeAfter(collection, value, original) {
    const after = object(value) ? value : original;
    if (collection === "opening") return { opening: text(after.opening), prompts: promptFields(after.prompts || original.prompts, ["opening"]) };
    const limits = { scenes: { title: 240, detail: 12000, question: 4000 }, revelations: { text: 4000 }, clocks: { label: 160 }, spotlights: { character: 200, opportunity: 4000 }, tasks: { text: 1000 } };
    const result = Object.fromEntries(FIELDS[collection].map(field => [field, text(after[field], limits[collection][field])]));
    result.id = PREP.createId(`template-${collection}`);
    result.prompts = promptFields(after.prompts || original.prompts, FIELDS[collection]);
    if (collection === "scenes") { result.kind = KINDS.includes(after.kind) ? after.kind : original.kind; result.minutes = integer(after.minutes, original.minutes, 0, 1440); }
    if (collection === "clocks") { result.max = integer(after.max, original.max, 1, 20); result.value = 0; }
    if (collection === "revelations") result.checked = false;
    if (collection === "tasks") result.done = false;
    return result;
  }
  function appendParagraph(existing, added) {
    const first = typeof existing === "string" ? existing : "", last = text(added);
    return first ? `${first}${last ? `\n\n${last}` : ""}` : last;
  }
  function applyReview(campaign, session, template, review) {
    const { fresh, prep } = freshReview(campaign, session, template, review);
    if (!prep.templateReview || prep.templateReview.id !== review.id) throw new Error("This template review is no longer saved for the session. Open a fresh review before applying.");
    const selected = review.rows.filter(row => row.selected === true);
    if (!selected.length && review.useDuration !== true) throw new Error("Select template entries or its session duration before applying.");
    const additions = selected.map(row => ({ id: row.id, collection: row.collection, after: normalizeAfter(row.collection, row.after, fresh.rows.find(candidate => candidate.id === row.id).after) }));
    const next = clone(prep);
    for (const addition of additions) {
      if (addition.collection === "opening") {
        if (addition.after.opening) next.opening = appendParagraph(next.opening, addition.after.opening);
        if (addition.after.prompts.opening) next.prompts = { ...next.prompts, opening: appendParagraph(next.prompts?.opening, addition.after.prompts.opening) };
      } else {
        if (!Array.isArray(next[addition.collection])) next[addition.collection] = [];
        next[addition.collection].push(addition.after);
      }
    }
    if (review.useDuration === true) next.durationMinutes = fresh.template.durationMinutes;
    delete next.templateReview;
    // Keep the existing prep object referenced by its editor; only its own
    // fields change. Canon, live desk state and the source template are untouched.
    Object.assign(prep, next);
    delete prep.templateReview;
    return { prep, added: additions.map(addition => addition.id) };
  }
  function promptProgress(prep) {
    let total = 0, remaining = 0;
    const count = (item, fields) => {
      for (const field of fields) if (text(item?.prompts?.[field])) { total++; if (!text(item?.[field])) remaining++; }
    };
    count(prep, ["opening"]);
    for (const collection of COLLECTIONS) rows(prep?.[collection]).forEach(row => count(row, FIELDS[collection]));
    return { remaining, total, completed: total - remaining };
  }

  return { SCHEMA_VERSION, normalizeTemplate, normalizeLibrary, ensureLibrary, builtins, listTemplates, createTemplate, saveTemplate, deleteTemplate, duplicateTemplate, captureStructure, buildReview, validateReview, applyReview, promptProgress };
});
