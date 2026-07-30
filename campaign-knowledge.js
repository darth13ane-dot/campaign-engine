(function initializeCampaignKnowledge(root, factory) {
  const tools = factory();
  if (typeof module === "object" && module.exports) module.exports = tools;
  if (root) root.CampaignKnowledge = tools;
})(typeof globalThis === "object" ? globalThis : this, function createCampaignKnowledge() {
  const GM_ONLY = "gm";
  const PLAYERS_KNOW = "players";
  const RECORD_COLLECTIONS = ["sessions", "characters", "quests", "locations", "journal"];

  function normalizeKnowledge(value, fallback = GM_ONLY) {
    if (value === true) return PLAYERS_KNOW;
    const text = String(value || "").trim().toLocaleLowerCase();
    if (["players", "player", "player safe", "player known", "public", "shared", "read"].includes(text)) return PLAYERS_KNOW;
    if (["gm", "gm only", "private", "secret", "hidden"].includes(text)) return GM_ONLY;
    return fallback === PLAYERS_KNOW ? PLAYERS_KNOW : GM_ONLY;
  }

  function recordKnowledge(record = {}, collection = "") {
    if (record.knowledge != null) return normalizeKnowledge(record.knowledge);
    if (record.playerKnown != null) return normalizeKnowledge(record.playerKnown);
    if (record.public != null) return normalizeKnowledge(record.public);
    if (collection === "journal" || record.permission != null) return normalizeKnowledge(record.permission);
    return GM_ONLY;
  }

  function permissionFor(value) {
    return normalizeKnowledge(value) === PLAYERS_KNOW ? "Player safe" : "GM only";
  }

  function labelFor(value) {
    return normalizeKnowledge(value) === PLAYERS_KNOW ? "Players know" : "GM only";
  }

  function normalizeRecord(record, collection = "") {
    if (!record || typeof record !== "object") return record;
    record.knowledge = recordKnowledge(record, collection);
    if (collection === "journal") record.permission = permissionFor(record.knowledge);
    return record;
  }

  function normalizeCampaign(campaign) {
    if (!campaign || typeof campaign !== "object") return campaign;
    RECORD_COLLECTIONS.forEach(collection => {
      if (!Array.isArray(campaign[collection])) campaign[collection] = [];
      campaign[collection].forEach(record => normalizeRecord(record, collection));
    });
    return campaign;
  }

  function setRecordKnowledge(record, value, collection = "") {
    if (!record || typeof record !== "object") return GM_ONLY;
    record.knowledge = normalizeKnowledge(value);
    if (collection === "journal") record.permission = permissionFor(record.knowledge);
    return record.knowledge;
  }

  function isVisible(record, mode = GM_ONLY, collection = "") {
    return normalizeKnowledge(mode) !== PLAYERS_KNOW || recordKnowledge(record, collection) === PLAYERS_KNOW;
  }

  function parseAssistantEnvelope(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const message = String(value.message || value.response || value.answer || "").trim();
      const candidates = value.actions || value.drafts || value.proposals;
      return { message, actions: Array.isArray(candidates) ? candidates.filter(item => item && typeof item === "object") : [] };
    }
    const text = String(value || "").trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    const candidate = fenced || text.match(/\{[\s\S]*\}/)?.[0];
    if (!candidate) return { message: text, actions: [] };
    try {
      return parseAssistantEnvelope(JSON.parse(candidate.trim()));
    } catch {
      return { message: text, actions: [] };
    }
  }

  return {
    GM_ONLY,
    PLAYERS_KNOW,
    RECORD_COLLECTIONS,
    normalizeKnowledge,
    recordKnowledge,
    permissionFor,
    labelFor,
    normalizeRecord,
    normalizeCampaign,
    setRecordKnowledge,
    isVisible,
    parseAssistantEnvelope
  };
});
