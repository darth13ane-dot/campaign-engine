(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./session-prep.js") : root.CampaignSessionPrep);
  if (common) module.exports = api;
  if (root) root.CampaignSessionTable = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PREP) {
  "use strict";
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const FIELDS = { logText: 8000, sceneTitle: 240, sceneKind: 40, clockLabel: 160, clockMax: 4, revelationText: 1000 };
  const KINDS = ["scene", "beat", "social", "exploration", "combat", "pressure"];
  const string = value => typeof value === "string" ? value : "";
  function normalizeDrafts(value) {
    const result = Object.fromEntries(Object.entries(FIELDS).flatMap(([key, limit]) => typeof value?.[key] === "string" ? [[key, value[key].slice(0, limit)]] : []));
    const sceneRef = normalizeLogScene({ sceneRef: value?.logSceneRef }).sceneRef;
    if (sceneRef) result.logSceneRef = sceneRef;
    return result;
  }
  function requireActive(desk) {
    if (!object(desk) || desk.status !== "active") throw new Error("This session has ended. Its recorded play is available for review.");
  }
  function setDraft(desk, field, value) {
    requireActive(desk);
    if (!Object.hasOwn(FIELDS, field)) throw new Error("This capture field is unavailable.");
    const next = string(value).slice(0, FIELDS[field]);
    if (desk.tableDrafts?.[field] === next) return false;
    const drafts = normalizeDrafts(desk.tableDrafts);
    if (field === "logText") {
      if (!next.trim()) delete drafts.logSceneRef;
      else if (!string(drafts.logText).trim()) {
        const sceneRef = logSceneFields(desk).sceneRef;
        if (sceneRef) drafts.logSceneRef = sceneRef; else delete drafts.logSceneRef;
      }
    }
    desk.tableDrafts = { ...drafts, [field]: next };
    return true;
  }
  function focusedScene(desk, requestedId = desk?.focusedBeatId) {
    const scenes = Array.isArray(desk?.beats) ? desk.beats.filter(object) : [];
    const matching = scenes.filter(scene => scene.id && scene.id === requestedId);
    if (matching.length === 1) return matching[0];
    const counts = new Map();
    for (const scene of scenes) counts.set(scene.id, (counts.get(scene.id) || 0) + 1);
    const unique = scenes.filter(scene => scene.id && counts.get(scene.id) === 1);
    return unique.find(scene => !scene.done) || unique[0] || null;
  }
  function focusScene(desk, id) {
    requireActive(desk);
    if ((desk.beats || []).filter(scene => scene.id === id).length !== 1) throw new Error("This scene is missing or has an ambiguous identity.");
    desk.focusedBeatId = id;
  }
  function logSceneFields(desk) {
    const scene = focusedScene(desk);
    return scene ? { sceneRef: { id: String(scene.id), title: string(scene.title).slice(0, 240) } } : {};
  }
  function normalizeLogScene(value) {
    const ref = value?.sceneRef;
    return object(ref) && string(ref.id) ? { sceneRef: { id: ref.id.slice(0, 160), title: string(ref.title).slice(0, 240) } } : {};
  }
  function commitDraft(desk, kind, now = new Date().toISOString()) {
    requireActive(desk);
    const drafts = normalizeDrafts(desk.tableDrafts);
    const key = { log: "logText", scene: "sceneTitle", clock: "clockLabel", revelation: "revelationText" }[kind];
    if (!key) throw new Error("Choose a supported table capture.");
    const value = string(drafts[key]).trim();
    if (!value) throw new Error("Write the note or title before adding it.");
    const id = PREP.createId(`table-${kind}`);
    let row, collection;
    if (kind === "log") { row = { id, at: now, text: value, ...(drafts.logSceneRef ? { sceneRef: { ...drafts.logSceneRef } } : {}) }; collection = "log"; delete drafts.logSceneRef; }
    if (kind === "scene") { row = { id, title: value, kind: KINDS.includes(drafts.sceneKind) ? drafts.sceneKind : "scene", minutes: 30, detail: "", question: "", done: false }; collection = "beats"; }
    if (kind === "clock") { row = { id, label: value, value: 0, max: Math.max(1, Math.min(20, Math.round(Number(drafts.clockMax) || 4))) }; collection = "clocks"; }
    if (kind === "revelation") { row = { id, text: value, checked: false }; collection = "revelations"; }
    (desk[collection] ||= []).push(row);
    desk.tableDrafts = { ...drafts, [key]: "" };
    return row;
  }
  function references(campaign, desk, scene = focusedScene(desk)) {
    return PREP.normalizeReferences([...(scene?.references || []), ...(desk?.pinned || [])]).map(ref => ({ ref, record: PREP.resolvePinnedRecord(campaign, ref), scene: (scene?.references || []).some(value => PREP.referenceKey(value) === PREP.referenceKey(ref)) }));
  }
  function addSceneReference(campaign, scene, ref) {
    const record = PREP.resolvePinnedRecord(campaign, ref);
    if (!scene || !record || !["archivistId", "localId", "id"].some(key => ref?.[key])) throw new Error("Choose an available campaign record with a stable identity.");
    const references = PREP.normalizeReferences(scene.references);
    if (references.some(value => value.type === ref.type && PREP.resolvePinnedRecord(campaign, value) === record)) return false;
    const normalized = PREP.normalizeReferences([ref]);
    if (!normalized.length) throw new Error("This reference type is unavailable.");
    scene.references = [...references, ...normalized];
    return true;
  }
  function removeSceneReference(scene, key) {
    if (!scene) return false;
    const previous = scene.references || [];
    scene.references = previous.filter(ref => PREP.referenceKey(ref) !== key);
    return scene.references.length !== previous.length;
  }
  return { FIELDS, normalizeDrafts, requireActive, setDraft, focusedScene, focusScene, logSceneFields, normalizeLogScene, commitDraft, references, addSceneReference, removeSceneReference };
});
