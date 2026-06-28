(function initializeCampaignSystemRegistry(root, factory) {
  const registry = factory();
  if (typeof module === "object" && module.exports) module.exports = registry;
  if (root) root.CampaignSystemRegistry = registry;
})(typeof globalThis === "object" ? globalThis : this, function createCampaignSystemRegistry() {
  const definitions = new Map();

  function normalizeId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function register(definition) {
    if (!definition || typeof definition !== "object") throw new Error("A campaign-system definition is required.");
    const id = normalizeId(definition.id);
    const name = String(definition.name || "").trim();
    if (!id || !name) throw new Error("Campaign systems require stable id and name values.");
    if (definitions.has(id)) throw new Error(`Campaign system "${id}" is already registered.`);

    const normalized = Object.freeze({
      accent: "",
      sheetFields: [],
      characterFields: [],
      monsterFields: [],
      links: [],
      ...definition,
      id,
      name
    });
    definitions.set(id, normalized);
    return normalized;
  }

  function all() {
    return [...definitions.values()];
  }

  function get(value) {
    const wanted = String(value || "").trim().toLowerCase();
    return definitions.get(normalizeId(value))
      || all().find(definition => definition.name.toLowerCase() === wanted)
      || definitions.get("custom")
      || null;
  }

  function idFor(value) {
    return get(value)?.id || normalizeId(value) || "custom";
  }

  function viewsFor(campaign) {
    const enabledIds = new Set(
      (campaign?.systems || [])
        .filter(system => system?.enabled)
        .map(system => system.id || idFor(system.name))
    );
    return all()
      .filter(definition => enabledIds.has(definition.id) && definition.view)
      .map(definition => ({ system: definition, ...definition.view }));
  }

  return Object.freeze({ register, all, get, idFor, viewsFor, normalizeId });
});
