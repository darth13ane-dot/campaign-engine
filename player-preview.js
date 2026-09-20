(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./player-packet.js") : root.CampaignPlayerPacket, common ? require("./session-prep.js") : root.CampaignSessionPrep);
  if (common) module.exports = api;
  if (root) root.CampaignPlayerPreview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PACKETS, PREP) {
  "use strict";
  const definitions = { characters: "character", quests: "quest", locations: "location", journal: "journal", sessions: "session" };
  function projectCampaign(campaign) {
    const projector = PACKETS.createProjector(campaign);
    const text = value => projector.redactText(String(value ?? "")).text;
    const result = { id: campaign.id, title: text(campaign.title), system: text(campaign.system), genre: text(campaign.genre), summary: "", connections: [], arcs: [], documents: [], builders: [], checklist: [] };
    for (const [collection, type] of Object.entries(definitions)) {
      result[collection] = (campaign[collection] || []).flatMap(record => {
        const reference = PREP.recordReference({ ...record, type, name: record.name || record.title });
        const projected = projector.projectRecord(reference);
        if (!projected) return [];
        const identity = Object.fromEntries(["archivistId", "localId", "id"].filter(key => record[key]).map(key => [key, record[key]]));
        const base = { ...identity, knowledge: "players", tags: [] };
        if (collection === "characters") return [{ ...base, name: projected.heading, description: projected.body, role: /^PC(?:\s|·|$)/i.test(record.role || "") ? "PC" : "NPC", factions: [] }];
        if (collection === "sessions") return [{ ...base, title: projected.heading, recap: projected.body, number: Number.isFinite(Number(record.number)) ? Number(record.number) : null, date: text(record.date), upcoming: Boolean(record.upcoming) }];
        if (collection === "journal") return [{ ...base, title: projected.heading, body: projected.body, permission: "Player safe" }];
        return [{ ...base, title: projected.heading, detail: projected.body, ...(collection === "quests" ? { status: ["Active", "Blocked", "Done", "Failed"].includes(record.status) ? record.status : "Active" } : {}) }];
      });
    }
    return result;
  }
  return { projectCampaign };
});
