(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignFoundryActorNormalizer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function atPath(value, path) {
    return String(path).split(".").reduce((current, key) => current && current[key] !== undefined ? current[key] : undefined, value);
  }

  function scalar(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "object") return String(value);
    for (const key of ["value", "total", "mod", "max", "current", "modified"]) {
      if (value[key] !== undefined && value[key] !== null && value[key] !== "") return String(value[key]);
    }
    return null;
  }

  function firstValue(value, paths) {
    for (const path of paths) {
      const candidate = scalar(atPath(value, path));
      if (candidate !== null) return candidate;
    }
    return null;
  }

  function firstNumber(value, paths) {
    const candidate = firstValue(value, paths);
    if (candidate === null) return null;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function signed(value) {
    if (value === null || value === undefined || value === "") return null;
    const text = String(value);
    return text.startsWith("+") || text.startsWith("-") ? text : `+${text}`;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function systemIdFor(raw, options) {
    return String(options.systemId || raw.systemId || raw._stats?.systemId || "").trim().toLowerCase();
  }

  function looksLikePf2e(raw, system, systemId) {
    if (systemId === "pf2e") return true;
    return raw.type === "npc" && Boolean(
      atPath(system, "details.level.value") !== undefined
      && atPath(system, "attributes.ac.value") !== undefined
      && atPath(system, "saves.fortitude") !== undefined
      && atPath(system, "saves.reflex") !== undefined
      && atPath(system, "saves.will") !== undefined
    );
  }

  function normalizedSave(system, save) {
    const value = firstValue(system, [
      `saves.${save}.value`,
      `saves.${save}.mod`,
      `saves.${save}.total`
    ]);
    return value === null ? null : {
      label: save[0].toUpperCase() + save.slice(1),
      value: signed(value)
    };
  }

  function normalizeFoundryActor(raw, options = {}) {
    if (!raw || typeof raw !== "object") throw new Error("A Foundry actor record is required.");
    const system = raw.system || raw.data?.data || {};
    const systemId = systemIdFor(raw, options);
    const isPf2e = looksLikePf2e(raw, system, systemId);
    const level = firstNumber(system, ["details.level.value", "details.level", "level.value", "level"]);
    const hp = firstValue(system, ["attributes.hp.value", "attributes.hp.current", "status.wounds.value", "details.hitpoints.value"]);
    const hpMax = firstValue(system, ["attributes.hp.max", "attributes.hp.maximum", "status.wounds.max", "details.hitpoints.max"]);
    const ac = firstValue(system, ["attributes.ac.value", "attributes.ac.total", "status.defence.value", "status.armor.value"]);
    const perception = firstValue(system, ["perception.mod", "perception.value", "attributes.perception.value", "attributes.perception.total"]);
    const movement = firstValue(system, ["attributes.speed.value", "attributes.speed.total", "details.move.value", "status.movement.value"]);
    const saves = ["fortitude", "reflex", "will"].map(save => normalizedSave(system, save)).filter(Boolean);
    const stats = [
      level !== null && { label: "Level", value: String(level) },
      hp !== null && { label: hpMax !== null ? "HP" : "Wounds", value: hpMax !== null ? `${hp} / ${hpMax}` : hp },
      ac !== null && { label: isPf2e ? "AC" : "Defense", value: ac },
      perception !== null && { label: "Perception", value: signed(perception) },
      movement !== null && { label: isPf2e ? "Speed" : "Movement", value: movement },
      ...saves
    ].filter(Boolean);
    const abilities = Object.entries(system.abilities || {}).map(([key, value]) => {
      const score = firstValue(value, ["mod", "value", "total"]);
      return score === null ? null : { label: key.slice(0, 3).toUpperCase(), value: signed(score) };
    }).filter(Boolean).slice(0, 6);
    const traitsSource = atPath(system, "traits.value") ?? atPath(system, "traits.traits.value") ?? [];
    const traits = (Array.isArray(traitsSource) ? traitsSource : [traitsSource]).map(String).map(value => value.trim()).filter(Boolean).slice(0, 12);

    return {
      id: raw._id || raw.id || `actor-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: raw.name || "Unnamed Foundry actor",
      type: raw.type || "actor",
      img: raw.img || raw.image || raw.prototypeToken?.texture?.src || "",
      systemId: isPf2e ? "pf2e" : systemId,
      isPf2e,
      level,
      traits,
      system,
      stats,
      abilities,
      items: (raw.items || []).map(item => ({
        name: item.name || "Unnamed item",
        type: item.type || "item",
        description: cleanText(item.system?.description?.value || item.system?.description || "").slice(0, 200)
      })).filter(item => item.name).slice(0, 24)
    };
  }

  return {
    atPath,
    firstValue,
    looksLikePf2e,
    normalizeFoundryActor,
    signed
  };
});
