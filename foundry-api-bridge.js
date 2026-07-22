(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignFoundryApiBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_URL = "https://api.foundry-mcp.com/v1";
  const DEFAULT_TIMEOUT = 30000;

  function apiBaseUrl(value) {
    const candidate = String(value || DEFAULT_URL).trim() || DEFAULT_URL;
    if (/^wss?:/i.test(candidate)) return DEFAULT_URL;
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("The Foundry public API URL must use http:// or https://.");
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  }

  class FoundryApiClient {
    constructor(options = {}) {
      this.url = apiBaseUrl(options.url);
      this.apiKey = String(options.apiKey || "").trim();
      this.timeout = Math.max(1000, Number(options.timeout) || DEFAULT_TIMEOUT);
      this.fetchImpl = options.fetchImpl || globalThis.fetch;
    }

    async requestEnvelope(path, options = {}) {
      if (!this.apiKey) throw new Error("Add the Foundry API Bridge key first.");
      if (!this.fetchImpl) throw new Error("Network requests are unavailable in this app.");
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), this.timeout) : null;
      try {
        const response = await this.fetchImpl.call(globalThis, `${this.url}${path}`, {
          method: options.method || "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...(options.body === undefined ? {} : { "Content-Type": "application/json" })
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller?.signal
        });
        let payload = null;
        try { payload = await response.json(); } catch { /* The status text below remains useful. */ }
        if (!response.ok) throw new Error(payload?.error || `Foundry public API returned ${response.status}.`);
        return payload || {};
      } catch (error) {
        if (error?.name === "AbortError") throw new Error("Foundry public API request timed out.");
        throw error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async request(path, options = {}) {
      const payload = await this.requestEnvelope(path, options);
      return Object.hasOwn(payload, "data") ? payload.data : payload;
    }
  }

  async function mapConcurrent(values, limit, mapper) {
    const output = new Array(values.length);
    let next = 0;
    async function worker() {
      while (next < values.length) {
        const index = next++;
        output[index] = await mapper(values[index], index);
      }
    }
    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), values.length || 1) }, worker));
    return output;
  }

  async function testConnection(options) {
    return new FoundryApiClient(options).request("/world");
  }

  function actorFilterQuery(filters = {}, offset = 0) {
    const query = new URLSearchParams();
    const textFields = ["name", "folder_id", "folder_name"];
    for (const field of textFields) {
      const value = String(filters[field] || "").trim();
      if (value) query.set(field, value);
    }
    for (const field of ["type", "disposition"]) {
      const values = Array.isArray(filters[field]) ? filters[field] : [filters[field]];
      values.map(value => String(value || "").trim()).filter(Boolean).forEach(value => query.append(field, value));
    }
    if (typeof filters.has_player_owner === "boolean") query.set("has_player_owner", String(filters.has_player_owner));
    if (filters.folder_recursive && (query.has("folder_id") || query.has("folder_name"))) query.set("folder_recursive", "true");
    query.set("limit", "200");
    query.set("offset", String(Math.max(0, Number(offset) || 0)));
    return query.toString();
  }

  async function listAllActorRefs(client, filters = {}) {
    const actors = [];
    let offset = 0;
    do {
      const payload = await client.requestEnvelope(`/actors?${actorFilterQuery(filters, offset)}`);
      const page = Array.isArray(payload.data) ? payload.data : [];
      actors.push(...page);
      if (!payload.pagination?.has_more || page.length === 0) break;
      offset += page.length;
    } while (true);
    return actors;
  }

  async function syncActors(options) {
    const client = new FoundryApiClient(options);
    const world = await client.request("/world");
    const summaries = await listAllActorRefs(client, options.filters);
    const warnings = [];
    const actors = await mapConcurrent(summaries, 4, async summary => {
      try { return await client.request(`/actors/${encodeURIComponent(summary.id)}`); }
      catch (error) {
        warnings.push(`${summary.name || summary.id}: ${error.message}`);
        return summary;
      }
    });
    return { world, actors, warnings };
  }

  function actorCreateParams(actor) {
    return {
      name: actor.name,
      type: actor.type || "npc",
      image: actor.img || actor.image || undefined,
      system: actor.system || {}
    };
  }

  function numericRange(value, index) {
    if (Array.isArray(value) && value.length >= 2) return [Number(value[0]) || index + 1, Number(value[1]) || Number(value[0]) || index + 1];
    const match = String(value || "").match(/(\d+)\s*(?:[-–—]\s*(\d+))?/);
    const start = match ? Number(match[1]) : index + 1;
    return [start, match?.[2] ? Number(match[2]) : start];
  }

  function tableCreateParams(table) {
    return {
      name: table.name,
      formula: table.formula || `1d${Math.max(table.results?.length || 1, 1)}`,
      replacement: table.replacement !== false,
      display_roll: table.displayRoll !== false,
      description: table.flags?.["campaign-engine"]?.summary || "Created by Campaign Engine",
      results: (table.results || []).map((result, index) => ({
        text: result.text,
        range: numericRange(result.range, index),
        weight: Number(result.weight) || 1,
        type: 0
      }))
    };
  }

  async function sendBuilderContent(options, payload) {
    const client = new FoundryApiClient(options);
    const actors = [];
    for (const actor of payload?.actors || []) actors.push(await client.request("/actors", { method: "POST", body: actorCreateParams(actor) }));
    const tables = [];
    for (const table of payload?.tables || []) tables.push(await client.request("/roll-tables", { method: "POST", body: tableCreateParams(table) }));
    return { actors, tables };
  }

  return {
    DEFAULT_URL,
    FoundryApiClient,
    actorFilterQuery,
    actorCreateParams,
    apiBaseUrl,
    listAllActorRefs,
    numericRange,
    sendBuilderContent,
    syncActors,
    tableCreateParams,
    testConnection
  };
});
