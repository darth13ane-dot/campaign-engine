(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignFoundryApiBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_URL = "wss://api.foundry-mcp.com/v1/connect";
  const DEFAULT_TIMEOUT = 20000;

  function bridgeUrl(value, apiKey) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("Add the Foundry API Bridge key first.");
    const url = new URL(String(value || DEFAULT_URL).trim() || DEFAULT_URL);
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error("The Foundry API Bridge URL must use ws:// or wss://.");
    url.searchParams.set("apiKey", key);
    return url.toString();
  }

  function requestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `campaign-engine-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  class FoundryApiClient {
    constructor(options = {}) {
      this.url = String(options.url || DEFAULT_URL);
      this.apiKey = String(options.apiKey || "");
      this.timeout = Math.max(1000, Number(options.timeout) || DEFAULT_TIMEOUT);
      this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
      this.socket = null;
      this.pending = new Map();
    }

    connect() {
      if (!this.WebSocketImpl) return Promise.reject(new Error("WebSocket support is unavailable in this app."));
      if (this.socket?.readyState === 1) return Promise.resolve(this);
      return new Promise((resolve, reject) => {
        let settled = false;
        const socket = new this.WebSocketImpl(bridgeUrl(this.url, this.apiKey));
        this.socket = socket;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.close();
          reject(new Error("Foundry API Bridge connection timed out."));
        }, this.timeout);
        socket.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(this);
        };
        socket.onerror = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error("Foundry API Bridge could not open a WebSocket connection."));
        };
        socket.onclose = () => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            reject(new Error("Foundry API Bridge closed before it was ready."));
          }
          this.rejectPending("Foundry API Bridge disconnected.");
        };
        socket.onmessage = event => this.handleMessage(event?.data);
      });
    }

    request(type, params = {}) {
      if (this.socket?.readyState !== 1) return Promise.reject(new Error("Foundry API Bridge is not connected."));
      const id = requestId();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`${type} timed out waiting for Foundry.`));
        }, this.timeout);
        this.pending.set(id, { resolve, reject, timer, type });
        this.socket.send(JSON.stringify({ id, type, params }));
      });
    }

    handleMessage(raw) {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      const pending = this.pending.get(message?.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.success === false) pending.reject(new Error(message.error || `${pending.type} failed in Foundry.`));
      else pending.resolve(message.data);
    }

    rejectPending(message) {
      this.pending.forEach(pending => {
        clearTimeout(pending.timer);
        pending.reject(new Error(message));
      });
      this.pending.clear();
    }

    close() {
      this.rejectPending("Foundry API Bridge connection closed.");
      this.socket?.close();
      this.socket = null;
    }
  }

  async function withClient(options, work) {
    const client = new FoundryApiClient(options);
    await client.connect();
    try { return await work(client); } finally { client.close(); }
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
    return withClient(options, client => client.request("get-world-info", {}));
  }

  async function syncActors(options) {
    return withClient(options, async client => {
      const world = await client.request("get-world-info", {});
      const summaries = await client.request("get-actors", {});
      const warnings = [];
      const actors = await mapConcurrent(Array.isArray(summaries) ? summaries : [], 4, async summary => {
        try { return await client.request("get-actor", { actorId: summary.id }); }
        catch (error) {
          warnings.push(`${summary.name || summary.id}: ${error.message}`);
          return summary;
        }
      });
      return { world, actors, warnings };
    });
  }

  function actorCreateParams(actor) {
    return {
      name: actor.name,
      type: actor.type || "npc",
      img: actor.img || undefined,
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
      displayRoll: table.displayRoll !== false,
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
    return withClient(options, async client => {
      const actors = [];
      for (const actor of payload?.actors || []) actors.push(await client.request("create-actor", actorCreateParams(actor)));
      const tables = [];
      for (const table of payload?.tables || []) tables.push(await client.request("create-roll-table", tableCreateParams(table)));
      return { actors, tables };
    });
  }

  return {
    DEFAULT_URL,
    FoundryApiClient,
    actorCreateParams,
    bridgeUrl,
    numericRange,
    sendBuilderContent,
    syncActors,
    tableCreateParams,
    testConnection
  };
});
