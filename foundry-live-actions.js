(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignFoundryLiveActions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONDITION_ACTIONS = new Set(["increase", "decrease", "set", "remove"]);
  const SAVES = new Set(["fortitude", "reflex", "will"]);

  function required(value, label) {
    const text = String(value || "").trim();
    if (!text) throw new Error(`${label} is required.`);
    return text;
  }

  function actorPayload(actorId, extra = {}) {
    return { actor_id: required(actorId, "Foundry actor"), ...extra };
  }

  function listFrom(value, key) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.[key])) return value[key];
    if (Array.isArray(value?.results)) return value.results;
    return [];
  }

  function createClient(options) {
    const Client = options?.FoundryApiClient || globalThis.CampaignFoundryApiBridge?.FoundryApiClient;
    if (!Client) throw new Error("Foundry API Bridge support did not load.");
    return new Client(options);
  }

  async function listStrikes(options, actorId) {
    const value = await createClient(options).request("/pf2e/strikes/list", { method: "POST", body: actorPayload(actorId), retrySafe: true });
    return listFrom(value, "strikes");
  }

  async function rollStrike(options, input = {}) {
    const body = actorPayload(input.actorId, {
      slug: required(input.slug, "Strike"),
      map_increase: Math.max(0, Math.min(2, Number(input.mapIncrease) || 0)),
      show_in_chat: input.showInChat !== false
    });
    return createClient(options).request("/pf2e/strikes/roll", { method: "POST", body });
  }

  async function rollStrikeDamage(options, input = {}) {
    const body = actorPayload(input.actorId, {
      slug: required(input.slug, "Strike"),
      critical: Boolean(input.critical),
      show_in_chat: input.showInChat !== false
    });
    return createClient(options).request("/pf2e/strikes/roll-damage", { method: "POST", body });
  }

  async function rollSkill(options, input = {}) {
    const skill = required(input.skill, "PF2e skill").toLowerCase();
    return createClient(options).request("/pf2e/roll-skill", { method: "POST", body: actorPayload(input.actorId, { skill, show_in_chat: input.showInChat !== false }) });
  }

  async function rollSave(options, input = {}) {
    const save = required(input.save, "PF2e save").toLowerCase();
    if (!SAVES.has(save)) throw new Error("PF2e save must be Fortitude, Reflex, or Will.");
    return createClient(options).request("/pf2e/roll-save", { method: "POST", body: actorPayload(input.actorId, { save, show_in_chat: input.showInChat !== false }) });
  }

  async function rollPerception(options, input = {}) {
    return createClient(options).request("/pf2e/roll-perception", { method: "POST", body: actorPayload(input.actorId, { show_in_chat: input.showInChat !== false }) });
  }

  async function getConditions(options, actorId) {
    const value = await createClient(options).request("/pf2e/conditions/get", { method: "POST", body: actorPayload(actorId), retrySafe: true });
    return listFrom(value, "conditions");
  }

  async function changeCondition(options, input = {}) {
    const action = required(input.action, "Condition action").toLowerCase();
    if (!CONDITION_ACTIONS.has(action)) throw new Error("Unsupported PF2e condition action.");
    const extra = { slug: required(input.slug, "Condition").toLowerCase() };
    if (action === "set") extra.value = Math.max(1, Math.min(99, Number(input.value) || 1));
    return createClient(options).request(`/pf2e/conditions/${action}`, { method: "POST", body: actorPayload(input.actorId, extra) });
  }

  async function listRollTables(options) {
    const value = await createClient(options).request("/roll-tables");
    return listFrom(value, "tables");
  }

  async function rollTable(options, input = {}) {
    const id = encodeURIComponent(required(input.tableId, "Roll table"));
    return createClient(options).request(`/roll-tables/${id}/roll`, { method: "POST", body: { display_chat: input.displayChat !== false } });
  }

  async function publishJournal(options, input = {}) {
    const client = createClient(options);
    const journal = await client.request("/journals", {
      method: "POST",
      body: {
        name: required(input.name, "Journal title"),
        content: required(input.content, "Journal content"),
        page_type: "text"
      }
    });
    if (!input.showToPlayers) return { journal, shown: false };
    const journalId = journal?.id || journal?._id;
    if (!journalId) {
      const error = new Error("The journal was created, but the bridge did not return its ID for player display.");
      error.partial = { journal, shown: false };
      throw error;
    }
    try {
      const shown = await client.request(`/journals/${encodeURIComponent(journalId)}/show`, { method: "POST", body: { force: true } });
      return { journal, shown };
    } catch (error) {
      error.partial = { journal, shown: false };
      throw error;
    }
  }

  async function refreshLiveOptions(options, actorId) {
    const requests = [
      ["strikes", "Strikes", () => listStrikes(options, actorId)],
      ["conditions", "conditions", () => getConditions(options, actorId)],
      ["tables", "roll tables", () => listRollTables(options)]
    ];
    const settled = await Promise.allSettled(requests.map(([, , request]) => request()));
    const result = { strikes: null, conditions: null, tables: null, warnings: [] };
    settled.forEach((entry, index) => {
      const [key, label] = requests[index];
      if (entry.status === "fulfilled") result[key] = entry.value;
      else result.warnings.push({
        source: label,
        message: entry.reason?.message || "unavailable",
        status: Number(entry.reason?.status) || null,
        code: String(entry.reason?.code || ""),
        requestId: String(entry.reason?.requestId || "")
      });
    });
    return result;
  }

  function resolveReadyStrike(strikes, slug) {
    const target = required(slug, "Strike");
    const strike = (Array.isArray(strikes) ? strikes : []).find(item => String(item?.slug || item?.id || item?.name) === target);
    if (!strike) throw new Error("Refresh this actor's Strikes before rolling.");
    if (strike.ready === false) throw new Error(`${strike.label || strike.name || target} is not ready in Foundry.`);
    return strike;
  }

  function resultText(value) {
    if (Array.isArray(value?.results)) {
      const matches = value.results.map(item => String(item?.text || item?.name || item?.document_id || item?.documentId || "").trim()).filter(Boolean);
      const total = value.roll?.total != null ? `roll ${value.roll.total}` : "roll completed";
      return matches.length ? `${total}: ${matches.join("; ")}` : total;
    }
    const result = value?.result || value?.roll || value;
    if (result?.total != null) {
      const critical = result.is_critical === true || result.isCritical === true || value?.is_critical === true || value?.isCritical === true;
      const fumble = result.is_fumble === true || result.isFumble === true || value?.is_fumble === true || value?.isFumble === true;
      const degree = critical ? " · critical success" : fumble ? " · critical failure" : "";
      return `total ${result.total}${degree}`;
    }
    if (result?.text) return String(result.text);
    if (result?.name) return String(result.name);
    return "completed";
  }

  function appendActionLog(foundry, desk, input = {}) {
    if (!foundry || typeof foundry !== "object") throw new Error("Foundry state is required.");
    if (!foundry.live || typeof foundry.live !== "object") foundry.live = {};
    if (!Array.isArray(foundry.live.history)) foundry.live.history = [];
    const at = String(input.at || new Date().toISOString());
    const label = required(input.label, "Action label");
    const status = required(input.status, "Action status");
    const detail = String(input.detail || "").slice(0, 1000);
    const entry = { id: String(input.id || `foundry-action-${Date.now()}-${Math.random().toString(16).slice(2)}`), at, label, status, detail };
    foundry.live.history.unshift(entry);
    foundry.live.history = foundry.live.history.slice(0, 50);
    if (desk?.status === "active" && Array.isArray(desk.log)) desk.log.push({ id: entry.id, at, text: `Foundry ${status}: ${label}${detail ? ` · ${detail}` : ""}` });
    return entry;
  }

  return {
    CONDITION_ACTIONS,
    appendActionLog,
    changeCondition,
    getConditions,
    listRollTables,
    listStrikes,
    publishJournal,
    refreshLiveOptions,
    resolveReadyStrike,
    resultText,
    rollPerception,
    rollSave,
    rollSkill,
    rollStrike,
    rollStrikeDamage,
    rollTable
  };
});
