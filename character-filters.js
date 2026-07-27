(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignCharacterFilters = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function roleGroup(role) {
    const prefix = String(role || "").trim().split(/[·|—-]/, 1)[0].trim().toUpperCase();
    return prefix === "PC" ? "PC" : "NPC";
  }

  function matchesCharacterFilter(character, filter) {
    if (filter === "All") return true;
    if (filter === "PC" || filter === "NPC") return roleGroup(character?.role) === filter;
    return false;
  }

  function sheetSearchText(character, actor) {
    return [
      character?.name,
      character?.role,
      character?.description,
      actor?.name,
      actor?.type,
      ...(actor?.traits || []),
      ...(actor?.stats || []).flatMap(stat => [stat.label, stat.value]),
      ...(actor?.items || []).map(item => item.name)
    ].filter(Boolean).join(" ").toLocaleLowerCase();
  }

  function matchesSheetFilter(character, actor, options = {}) {
    const filter = options.filter || "All";
    if (filter === "PC" || filter === "NPC") {
      if (roleGroup(character?.role) !== filter) return false;
    } else if (filter === "Linked" && !actor) {
      return false;
    } else if (filter === "Unlinked" && actor) {
      return false;
    }
    const level = String(options.level || "any");
    if (level !== "any" && String(actor?.level) !== level) return false;
    const query = String(options.query || "").trim().toLocaleLowerCase();
    return !query || sheetSearchText(character, actor).includes(query);
  }

  return { matchesCharacterFilter, matchesSheetFilter, roleGroup, sheetSearchText };
});
