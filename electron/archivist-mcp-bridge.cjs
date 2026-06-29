const { spawn } = require("node:child_process");

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

function toolResultPayload(result) {
  if (!result) return null;
  if (isObject(result.payload)) return result.payload;
  if (isObject(result.structuredContent)) return result.structuredContent;
  if (Array.isArray(result.content)) {
    const text = result.content.map(item => item?.text || "").join("\n").trim();
    if (!text) return result;
    try {
      return JSON.parse(text);
    } catch {
      return { text };
    }
  }
  return result;
}

module.exports = {
  normalizeBridgeSettings,
  parseArgs,
  parseToolArguments,
  splitCommandLine,
  testArchivistBridge,
  callArchivistTool,
  toolResultPayload
};
