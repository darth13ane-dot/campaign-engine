const { spawn } = require("node:child_process");
const { buildCampaignEnginePayload } = require("./archivist-import.cjs");

const DEFAULT_TIMEOUT_MS = 15000;
const MCP_PROTOCOL_VERSION = "2024-11-05";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function splitCommandLine(value = "") {
  const args = [];
  const pattern = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let match;
  while ((match = pattern.exec(String(value)))) args.push(match[1] ?? match[2] ?? match[3]);
  return args;
}

function parseArgs(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  const text = String(value || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // Fall back to a shell-like split for convenience; spawn still receives an argv array.
  }
  return splitCommandLine(text);
}

function parseToolArguments(value) {
  if (isObject(value)) return value;
  const text = String(value || "").trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!isObject(parsed)) throw new Error("Tool arguments must be a JSON object.");
  return parsed;
}

function normalizeBridgeSettings(value = {}, existing = {}) {
  const settings = { ...existing, ...value };
  return {
    command: String(settings.command || "").trim(),
    args: parseArgs(settings.args),
    toolName: String(settings.toolName || "").trim(),
    toolArguments: isObject(settings.toolArguments) ? settings.toolArguments : String(settings.toolArguments || "{}"),
    timeoutMs: Math.max(2000, Math.min(120000, Number(settings.timeoutMs) || DEFAULT_TIMEOUT_MS)),
    lastStatus: String(settings.lastStatus || existing.lastStatus || "Not configured"),
    lastSync: settings.lastSync || existing.lastSync || null
  };
}

function parseMessageBuffer(state, chunk, onMessage) {
  state.buffer = Buffer.concat([state.buffer, chunk]);
  while (state.buffer.length) {
    const contentHeader = state.buffer.slice(0, 15).toString("ascii").toLowerCase() === "content-length";
    if (contentHeader) {
      let delimiter = Buffer.from("\r\n\r\n");
      let headerEnd = state.buffer.indexOf(delimiter);
      if (headerEnd < 0) {
        delimiter = Buffer.from("\n\n");
        headerEnd = state.buffer.indexOf(delimiter);
      }
      if (headerEnd < 0) return;
      const header = state.buffer.slice(0, headerEnd).toString("ascii");
      const length = Number(header.match(/content-length:\s*(\d+)/i)?.[1]);
      if (!Number.isFinite(length)) throw new Error("MCP server sent an invalid Content-Length header.");
      const bodyStart = headerEnd + delimiter.length;
      if (state.buffer.length < bodyStart + length) return;
      const body = state.buffer.slice(bodyStart, bodyStart + length).toString("utf8");
      state.buffer = state.buffer.slice(bodyStart + length);
      onMessage(JSON.parse(body));
      continue;
    }

    const newline = state.buffer.indexOf(10);
    if (newline < 0) return;
    const line = state.buffer.slice(0, newline).toString("utf8").trim();
    state.buffer = state.buffer.slice(newline + 1);
    if (line) onMessage(JSON.parse(line));
  }
}

function serializeMessage(message) {
  return `${JSON.stringify(message)}\n`;
}

async function withMcpClient(settings, operation) {
  const normalized = normalizeBridgeSettings(settings);
  if (!normalized.command) throw new Error("Add the Archivist MCP command first.");

  const child = spawn(normalized.command, normalized.args, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: process.env
  });
  const readState = { buffer: Buffer.alloc(0) };
  const pending = new Map();
  let stderr = "";
  let nextId = 1;
  let settled = false;

  const cleanup = () => {
    settled = true;
    child.stdout.removeAllListeners();
    child.stderr.removeAllListeners();
    child.removeAllListeners();
    if (!child.killed) child.kill();
  };

  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject, method });
    child.stdin.write(serializeMessage({ jsonrpc: "2.0", id, method, params }));
  });
  const notify = (method, params = {}) => {
    child.stdin.write(serializeMessage({ jsonrpc: "2.0", method, params }));
  };

  child.stdout.on("data", chunk => {
    try {
      parseMessageBuffer(readState, chunk, message => {
        if (message.id === undefined) return;
        const pendingRequest = pending.get(message.id);
        if (!pendingRequest) return;
        pending.delete(message.id);
        if (message.error) pendingRequest.reject(new Error(message.error.message || `${pendingRequest.method} failed.`));
        else pendingRequest.resolve(message.result);
      });
    } catch (error) {
      for (const pendingRequest of pending.values()) pendingRequest.reject(error);
      pending.clear();
    }
  });
  child.stderr.on("data", chunk => {
    stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4000);
  });
  child.on("error", error => {
    for (const pendingRequest of pending.values()) pendingRequest.reject(error);
    pending.clear();
  });
  child.on("exit", code => {
    if (settled) return;
    const error = new Error(stderr.trim() || `Archivist MCP process exited with code ${code}.`);
    for (const pendingRequest of pending.values()) pendingRequest.reject(error);
    pending.clear();
  });

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Archivist MCP bridge timed out.")), normalized.timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
      const initialize = await request("initialize", {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "Campaign Engine", version: "1.0.0" }
      });
      notify("notifications/initialized");
      return operation({ request, notify, initialize });
    })(), timeout]);
  } finally {
    clearTimeout(timeoutId);
    cleanup();
  }
}

async function testArchivistBridge(settings) {
  return withMcpClient(settings, async client => {
    let tools = [];
    try {
      tools = (await client.request("tools/list", {}))?.tools || [];
    } catch {
      tools = [];
    }
    return {
      ok: true,
      protocolVersion: client.initialize.protocolVersion || MCP_PROTOCOL_VERSION,
      serverInfo: client.initialize.serverInfo || null,
      tools: tools.map(tool => ({ name: tool.name, description: tool.description || "" }))
    };
  });
}

async function callArchivistTool(settings, overrides = {}) {
  const normalized = normalizeBridgeSettings({ ...settings, ...overrides });
  if (!normalized.toolName) throw new Error("Choose the Archivist MCP import tool first.");
  const toolArguments = parseToolArguments(normalized.toolArguments);
  return withMcpClient(normalized, client => client.request("tools/call", {
    name: normalized.toolName,
    arguments: toolArguments
  }));
}

function resultText(result) {
  if (!Array.isArray(result?.content)) return "";
  return result.content.map(item => item?.text || "").join("\n").trim();
}

function parseJsonText(text) {
  const value = String(text || "").trim();
  if (!value) return null;
  const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : value);
}

function toolResultPayload(result) {
  if (!result) return null;
  if (result.isError) throw new Error(resultText(result) || "The Archivist MCP tool returned an error.");
  if (isObject(result.payload)) return result.payload;
  if (isObject(result.structuredContent)) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const text = resultText(result);
    if (!text) return result;
    try {
      return parseJsonText(text);
    } catch {
      return { text };
    }
  }
  return result;
}

function isCampaignEnginePayload(payload) {
  if (!isObject(payload)) return false;
  if (isObject(payload.workspace)) return isCampaignEnginePayload(payload.workspace);
  return Array.isArray(payload.campaigns)
    || Array.isArray(payload.state?.campaigns)
    || isObject(payload.archivist)
    || isObject(payload.details)
    || isObject(payload.archivistDetails);
}

async function requestToolPayload(client, name, args = {}) {
  const result = await client.request("tools/call", { name, arguments: args });
  return toolResultPayload(result);
}

async function requestAllPages(client, name, args = {}) {
  const rows = [];
  let page = 1;
  let lastPage = 1;
  do {
    const payload = await requestToolPayload(client, name, { ...args, page });
    if (Array.isArray(payload)) {
      rows.push(...payload);
      break;
    }
    const data = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
    rows.push(...data);
    lastPage = Math.max(page, Number(payload?.last_page || payload?.lastPage || 1));
    page += 1;
  } while (page <= lastPage);
  return rows;
}

function importOptions(settings) {
  const options = parseToolArguments(settings.toolArguments);
  const values = Array.isArray(options.campaignIds)
    ? options.campaignIds
    : [options.campaignId || options.campaign_id].filter(Boolean);
  return {
    campaignIds: new Set(values.map(String)),
    includeLinks: options.includeLinks === true
  };
}

async function nativeCampaignBundle(client, listedCampaign, availableTools, options) {
  const campaignId = String(listedCampaign.id);
  const args = { campaign_id: campaignId };
  const campaign = await requestToolPayload(client, "get-campaign-tool", args);
  const [characters, sessions, factions, locations, items, quests, journalRows, links] = await Promise.all([
    requestAllPages(client, "list-characters-tool", args),
    requestAllPages(client, "list-sessions-tool", args),
    requestAllPages(client, "list-factions-tool", args),
    requestAllPages(client, "list-locations-tool", args),
    requestAllPages(client, "list-items-tool", args),
    requestAllPages(client, "list-quests-tool", args),
    requestAllPages(client, "list-journals-tool", args),
    options.includeLinks && availableTools.has("list-links-tool")
      ? requestAllPages(client, "list-links-tool", args)
      : []
  ]);
  let journals = journalRows;
  if (availableTools.has("get-journal-tool") && journalRows.length) {
    journals = await Promise.all(journalRows.map(async journal => {
      try {
        return await requestToolPayload(client, "get-journal-tool", { journal_id: journal.id });
      } catch {
        return journal;
      }
    }));
  }
  return {
    campaign: isObject(campaign) ? campaign : listedCampaign,
    characters,
    sessions,
    factions,
    locations,
    items,
    quests,
    journals,
    links
  };
}

function publicTools(tools) {
  return tools.map(tool => ({ name: tool.name, description: tool.description || "" }));
}

async function nativeArchivistPayload(client, settings, availableTools) {
  const required = [
    "list-campaigns-tool",
    "get-campaign-tool",
    "list-characters-tool",
    "list-sessions-tool",
    "list-factions-tool",
    "list-locations-tool",
    "list-items-tool",
    "list-quests-tool",
    "list-journals-tool"
  ];
  const missing = required.filter(name => !availableTools.has(name));
  if (missing.length) throw new Error(`Archivist is missing required sync tools: ${missing.join(", ")}.`);

  const options = importOptions(settings);
  const campaignRows = await requestAllPages(client, "list-campaigns-tool");
  const selected = options.campaignIds.size
    ? campaignRows.filter(item => options.campaignIds.has(String(item.id)))
    : campaignRows;
  if (!selected.length) {
    throw new Error(options.campaignIds.size
      ? "No Archivist campaign matched the configured campaignId."
      : "Archivist returned no campaigns.");
  }
  const bundles = await Promise.all(selected.map(campaign => {
    return nativeCampaignBundle(client, campaign, availableTools, options);
  }));
  return buildCampaignEnginePayload(bundles);
}

async function syncArchivistBridge(settings) {
  const normalized = normalizeBridgeSettings({
    ...settings,
    timeoutMs: Math.max(120000, Number(settings?.timeoutMs) || 0)
  });
  return withMcpClient(normalized, async client => {
    const tools = (await client.request("tools/list", {}))?.tools || [];
    const availableTools = new Set(tools.map(tool => tool.name));
    if (availableTools.has("list-campaigns-tool")) {
      const payload = await nativeArchivistPayload(client, normalized, availableTools);
      return {
        mode: "archivist-native",
        payload,
        campaignCount: payload.state.campaigns.length,
        tools: publicTools(tools)
      };
    }
    if (!normalized.toolName) {
      throw new Error("This MCP server does not advertise Archivist sync tools. Choose a custom Campaign Engine export tool.");
    }
    const result = await client.request("tools/call", {
      name: normalized.toolName,
      arguments: parseToolArguments(normalized.toolArguments)
    });
    const payload = toolResultPayload(result);
    if (!isCampaignEnginePayload(payload)) {
      throw new Error(`The selected tool "${normalized.toolName}" returned a record, not a Campaign Engine campaign export.`);
    }
    return {
      mode: "custom-export",
      payload,
      result,
      campaignCount: payload.state?.campaigns?.length || payload.campaigns?.length || 0,
      tools: publicTools(tools)
    };
  });
}

module.exports = {
  normalizeBridgeSettings,
  parseArgs,
  parseToolArguments,
  splitCommandLine,
  testArchivistBridge,
  callArchivistTool,
  toolResultPayload,
  isCampaignEnginePayload,
  syncArchivistBridge
};
