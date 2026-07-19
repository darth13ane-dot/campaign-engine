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

  return { matchesCharacterFilter, roleGroup };
});
