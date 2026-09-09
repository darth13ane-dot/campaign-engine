(function (root, factory) {
  const common = typeof module === "object" && module.exports;
  const api = factory(common ? require("./session-prep.js") : root.CampaignSessionPrep, common ? require("./campaign-knowledge.js") : root.CampaignKnowledge);
  if (common) module.exports = api;
  if (root) root.CampaignPlayerPacket = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (PREP, KNOWLEDGE) {
  "use strict";

  const TYPES = { session: { collection: "sessions", body: "recap" }, character: { collection: "characters", body: "description" }, quest: { collection: "quests", body: "detail" }, location: { collection: "locations", body: "detail" }, journal: { collection: "journal", body: "body" } };
  const ALIASES = { session: "session", sessions: "session", character: "character", characters: "character", quest: "quest", quests: "quest", location: "location", locations: "location", world: "location", journal: "journal", journals: "journal" };
  const IDS = ["archivistId", "localId", "id"];
  const REDACTED = "[Unshared reference]";
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const rows = value => Array.isArray(value) ? value.filter(object) : [];
  const plain = value => ["string", "number", "boolean"].includes(typeof value) ? String(value).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "") : "";
  const short = (value, length = 160) => plain(value).trim().slice(0, length);
  const nameKey = value => plain(value).normalize("NFC").trim().toLowerCase();
  const typeFor = value => Object.hasOwn(ALIASES, nameKey(value)) ? ALIASES[nameKey(value)] : null;
  const stable = value => IDS.some(field => short(value?.[field]));
  const canonical = value => JSON.stringify(sortKeys(value));
  function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    return object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])])) : value;
  }

  // Synchronous SHA-256 keeps preview validation available in browser render
  // paths without retaining raw source text inside persisted fingerprints.
  function digest(value) {
    const bytes = new TextEncoder().encode(String(value));
    const length = Math.ceil((bytes.length + 9) / 64) * 64;
    const data = new Uint8Array(length); data.set(bytes); data[bytes.length] = 128;
    const view = new DataView(data.buffer), bits = bytes.length * 8;
    view.setUint32(length - 8, Math.floor(bits / 4294967296)); view.setUint32(length - 4, bits >>> 0);
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const k = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const rotate = (word, count) => word >>> count | word << 32 - count;
    const w = new Uint32Array(64);
    for (let block = 0; block < length; block += 64) {
      for (let index = 0; index < 16; index++) w[index] = view.getUint32(block + index * 4);
      for (let index = 16; index < 64; index++) {
        const x = w[index - 15], y = w[index - 2];
        w[index] = w[index - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ x >>> 3) + w[index - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ y >>> 10);
      }
      let [a, b, c, d, e, f, g, j] = h;
      for (let index = 0; index < 64; index++) {
        const t1 = (j + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + k[index] + w[index]) >>> 0;
        const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c)) >>> 0;
        j = g; g = f; f = e; e = d + t1 >>> 0; d = c; c = b; b = a; a = t1 + t2 >>> 0;
      }
      [a, b, c, d, e, f, g, j].forEach((value, index) => h[index] = h[index] + value >>> 0);
    }
    return h.map(word => word.toString(16).padStart(8, "0")).join("");
  }

  function sourceReference(type, record) {
    const reference = { type, name: plain(type === "character" ? record.name : record.title) };
    for (const field of IDS) if (short(record[field])) reference[field] = short(record[field]);
    return reference;
  }
  function normalizeSourceRef(value) {
    const type = typeFor(value?.type || value?.collection);
    if (!type) return null;
    const reference = { type, name: plain(value.name || value.title) };
    for (const field of IDS) if (short(value[field])) reference[field] = short(value[field]);
    return reference;
  }
  function resolveSource(campaign, value) {
    const reference = normalizeSourceRef(value);
    if (!reference) return null;
    const definition = TYPES[reference.type], records = rows(campaign?.[definition.collection]);
    const key = IDS.find(field => reference[field]);
    const matches = records.filter(record => key ? short(record[key]) === reference[key] : nameKey(reference.type === "character" ? record.name : record.title) === nameKey(reference.name));
    if (matches.length !== 1) return null;
    const record = matches[0];
    if (key && IDS.some(field => reference[field] && short(record[field]) !== reference[field])) return null;
    if (KNOWLEDGE.recordKnowledge(record, definition.collection) !== KNOWLEDGE.PLAYERS_KNOW) return null;
    return { record, reference: sourceReference(reference.type, record), definition };
  }

  function analyzeText(campaign, value, depth = 0) {
    const input = plain(value), dependencies = [];
    let output = "", index = 0;
    while (index < input.length) {
      const start = input.indexOf("[[", index);
      if (start < 0) { output += input.slice(index); break; }
      output += input.slice(index, start);
      let cursor = start + 2, nesting = 1, nested = false;
      while (cursor < input.length && nesting) {
        if (input.slice(cursor, cursor + 2) === "[[") { nesting++; nested = true; cursor += 2; }
        else if (input.slice(cursor, cursor + 2) === "]]") { nesting--; cursor += 2; }
        else cursor++;
      }
      const token = input.slice(start + 2, nesting ? input.length : cursor - 2).trim();
      let replacement = REDACTED;
      if (!nesting && !nested && depth < 5) {
        const colon = token.indexOf(":"), type = colon < 0 ? "journal" : typeFor(token.slice(0, colon));
        const name = (colon < 0 ? token : token.slice(colon + 1)).trim();
        if (type && name) {
          const definition = TYPES[type];
          const matches = rows(campaign?.[definition.collection]).filter(record => nameKey(type === "character" ? record.name : record.title) === nameKey(name));
          const record = matches.length === 1 ? matches[0] : null;
          const reference = record ? sourceReference(type, record) : { type, name };
          const resolved = record && resolveSource(campaign, reference);
          dependencies.push({ reference, matches: matches.length, knowledge: record ? KNOWLEDGE.recordKnowledge(record, definition.collection) : "missing" });
          if (resolved) {
            const label = analyzeText(campaign, reference.name, depth + 1);
            replacement = label.text;
            dependencies.push(...label.dependencies);
          }
        }
      }
      output += replacement;
      index = nesting ? input.length : cursor;
    }
    return { text: output, redactions: output.split(REDACTED).length - 1, dependencies };
  }
  function redactText(campaign, value) {
    const result = analyzeText(campaign, value);
    return { text: result.text, redactions: result.redactions };
  }
  function sourceProjection(campaign, reference) {
    const source = resolveSource(campaign, reference);
    if (!source) return null;
    const heading = analyzeText(campaign, source.reference.name);
    const body = analyzeText(campaign, plain(source.record[source.definition.body]));
    return { ...source, heading: heading.text, body: body.text, redactions: heading.redactions + body.redactions, fingerprint: digest(canonical({ reference: source.reference, knowledge: KNOWLEDGE.recordKnowledge(source.record, source.definition.collection), heading: source.reference.name, body: plain(source.record[source.definition.body]), dependencies: [...heading.dependencies, ...body.dependencies] })) };
  }
  function projectRecord(campaign, reference) {
    const projected = sourceProjection(campaign, reference);
    return projected ? { heading: projected.heading, body: projected.body } : null;
  }

  function neutralTitle(session) {
    const number = Number(session?.number);
    return Number.isSafeInteger(number) && number > 0 ? `Session ${number} · Player packet` : "Player packet";
  }
  function normalizePacket(value, key) {
    if (!object(value)) return null;
    const id = short(value.id || key) || PREP.createId("packet");
    return {
      schemaVersion: 1, id, sessionRef: PREP.sessionReference(value.sessionRef || {}), title: plain(value.title), createdAt: short(value.createdAt, 80),
      sections: rows(value.sections).map((section, index) => ({ id: short(section.id) || `${id}-section-${index}`, kind: ["manual", "source"].includes(section.kind) ? section.kind : "invalid", heading: plain(section.heading), body: plain(section.body), ...(section.kind === "source" ? { sourceRef: normalizeSourceRef(section.sourceRef), sourceFingerprint: short(section.sourceFingerprint, 64) } : {}) })),
      ...(object(value.approval) && /^[a-f0-9]{64}$/.test(value.approval.fingerprint) ? { approval: { fingerprint: value.approval.fingerprint, approvedAt: short(value.approval.approvedAt, 80) } } : {})
    };
  }
  function resolveSession(campaign, session) {
    const result = PREP.findSession(campaign, PREP.sessionReference(session));
    if (!result) throw new Error("The packet's session is missing or its identity is ambiguous.");
    return result;
  }
  function packetsForSession(campaign, session) {
    const target = resolveSession(campaign, session);
    const all = rows(Object.values(campaign.sessionWorkflow?.playerPackets || {}));
    return all.filter(packet => short(packet.id) && all.filter(other => other.id === packet.id).length === 1 && PREP.findSession(campaign, packet.sessionRef) === target).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || all.indexOf(b) - all.indexOf(a));
  }
  function findPacket(campaign, session, packetId) {
    const packets = packetsForSession(campaign, session);
    return packetId == null ? packets[0] || null : packets.find(packet => packet.id === packetId) || null;
  }
  function createPacket(campaign, session, options = {}) {
    if (!object(campaign?.sessionWorkflow)) throw new Error("Initialize the session workflow before creating a player packet.");
    const target = resolveSession(campaign, session);
    const reference = PREP.ensureSessionReferences(campaign, target);
    if (!object(campaign.sessionWorkflow.playerPackets)) campaign.sessionWorkflow.playerPackets = {};
    const packet = normalizePacket({ id: PREP.createId("packet"), sessionRef: reference, title: options.title == null ? neutralTitle(target) : plain(options.title), createdAt: new Date().toISOString(), sections: [] });
    campaign.sessionWorkflow.playerPackets[packet.id] = packet;
    return packet;
  }
  function ensurePacket(campaign, session, options = {}) {
    const existing = findPacket(campaign, session, options.packetId);
    if (existing) { existing.sessionRef = PREP.ensureSessionReferences(campaign, resolveSession(campaign, session)); return existing; }
    if (options.packetId != null) throw new Error("This player packet is unavailable for the selected session.");
    return createPacket(campaign, session);
  }

  function sourceChoices(campaign) {
    return Object.entries(TYPES).flatMap(([type, definition]) => rows(campaign[definition.collection]).map(record => {
      const ref = sourceReference(type, record);
      if (!stable(ref)) return null;
      const projection = sourceProjection(campaign, ref);
      if (!projection) return null;
      return { key: canonical(ref), ref, title: projection.heading, excerpt: projection.body.slice(0, 220), selected: false };
    }).filter(Boolean));
  }
  function createManualSection(values = {}) {
    return { id: PREP.createId("packet-section"), kind: "manual", heading: plain(values.heading), body: plain(values.body) };
  }
  function createSourceSection(campaign, reference) {
    const source = sourceProjection(campaign, reference);
    if (!source) throw new Error("This source is unavailable, ambiguous, or no longer shared with players.");
    if (!stable(source.reference)) throw new Error("Save the campaign before selecting this source so it has a stable record ID.");
    return { id: PREP.createId("packet-section"), kind: "source", heading: source.heading, body: source.body, sourceRef: source.reference, sourceFingerprint: source.fingerprint };
  }
  function refreshSourceSection(campaign, section) {
    if (section?.kind !== "source") throw new Error("Choose a source section to refresh.");
    const refreshed = createSourceSection(campaign, section.sourceRef);
    return { ...refreshed, id: short(section.id) || refreshed.id };
  }

  function inspectPacket(campaign, value) {
    const packet = normalizePacket(value), errors = [];
    const error = (code, message, sectionId) => errors.push({ code, message, ...(sectionId ? { sectionId } : {}) });
    if (!packet || value?.schemaVersion !== 1) return { valid: false, approved: false, empty: true, errors: [{ code: "invalid", message: "This player packet is invalid." }], redactions: 0, fingerprint: null, projection: null };
    const target = PREP.findSession(campaign, packet.sessionRef);
    if (!target) error("session", "The packet's session is missing or its identity is ambiguous.");
    const seen = new Set(), sections = [], sourceStates = [];
    const heading = analyzeText(campaign, packet.title || neutralTitle(target));
    const linkedReferences = [...heading.dependencies];
    let redactions = heading.redactions;
    for (const section of packet.sections) {
      if (seen.has(section.id)) error("section-identity", "Two packet sections share an identity. Remove the duplicate before previewing.", section.id);
      seen.add(section.id);
      if (!["manual", "source"].includes(section.kind)) { error("section", "A packet section has an unsupported type.", section.id); continue; }
      if (section.kind === "source") {
        const source = sourceProjection(campaign, section.sourceRef);
        if (!source || !stable(section.sourceRef)) { error("source-unavailable", "A selected source is unavailable, ambiguous, or no longer shared. Remove it or select a currently shared source.", section.id); continue; }
        if (source.fingerprint !== section.sourceFingerprint) { error("source-changed", "A selected source or its linked references changed. Refresh or remove that section before previewing.", section.id); continue; }
        sourceStates.push({ id: section.id, fingerprint: source.fingerprint });
      }
      const title = analyzeText(campaign, section.heading), body = analyzeText(campaign, section.body);
      linkedReferences.push(...title.dependencies, ...body.dependencies);
      redactions += title.redactions + body.redactions;
      if (title.text.trim() || body.text.trim()) sections.push({ heading: title.text, body: body.text });
    }
    const empty = !sections.some(section => section.body.trim());
    if (empty) error("empty", "Add packet text before previewing or exporting.");
    const projection = { title: heading.text, sections };
    const reference = target ? PREP.sessionReference(target) : packet.sessionRef;
    const identity = Object.fromEntries(IDS.filter(field => reference[field]).map(field => [field, reference[field]]));
    const signature = errors.length ? null : digest(canonical({ packetId: packet.id, session: identity, title: packet.title, sections: packet.sections, sourceStates, linkedReferences, projection }));
    return { valid: errors.length === 0, approved: Boolean(signature && packet.approval?.fingerprint === signature), empty, errors, redactions, fingerprint: signature, projection: errors.length ? null : projection };
  }
  function validatePacket(campaign, packet) {
    const { projection, ...result } = inspectPacket(campaign, packet);
    return result;
  }
  function previewPacket(campaign, packet) {
    const checked = inspectPacket(campaign, packet);
    if (!checked.valid) throw new Error(checked.errors[0].message);
    return { ...checked.projection, fingerprint: checked.fingerprint, redactions: checked.redactions };
  }
  function approvePacket(campaign, packet, previewFingerprint) {
    const preview = previewPacket(campaign, packet);
    if (!previewFingerprint || previewFingerprint !== preview.fingerprint) throw new Error("This packet changed after preview. Open a fresh preview before approving.");
    const approved = normalizePacket(packet);
    approved.approval = { fingerprint: preview.fingerprint, approvedAt: new Date().toISOString() };
    return approved;
  }
  function approvedProjection(campaign, packet) {
    const checked = inspectPacket(campaign, packet);
    if (!checked.valid) throw new Error(checked.errors[0].message);
    if (!checked.approved) throw new Error("Preview and approve this exact player packet before exporting.");
    return checked.projection;
  }
  const htmlText = value => plain(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const markdownText = value => plain(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_{}\[\]()#+.!|~:=\/@-])/g, "\\$1");
  function renderHTML(projection) {
    return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${htmlText(projection.title)}</title><style>body{font:17px/1.65 Georgia,serif;color:#20232a;background:#fff;margin:0}main{max-width:760px;margin:0 auto;padding:48px 28px}h1{font-size:2rem;line-height:1.2;border-bottom:2px solid #313843;padding-bottom:20px;margin:0 0 36px}h2{font-size:1.25rem;line-height:1.35;margin:0 0 12px}section{margin:0 0 32px}p,h1,h2{white-space:pre-wrap;overflow-wrap:anywhere}p{margin:0}@media print{main{max-width:none;padding:0}h1,h2{break-after:avoid}p{orphans:3;widows:3}@page{margin:18mm}}</style></head><body><main><h1>${htmlText(projection.title)}</h1>${projection.sections.map(section => `<section>${section.heading ? `<h2>${htmlText(section.heading)}</h2>` : ""}<p>${htmlText(section.body)}</p></section>`).join("")}</main></body></html>\n`;
  }
  function previewHTML(campaign, packet) { return renderHTML(previewPacket(campaign, packet)); }
  function exportHTML(campaign, packet) { return renderHTML(approvedProjection(campaign, packet)); }
  function exportMarkdown(campaign, packet) {
    const projection = approvedProjection(campaign, packet);
    return [`# ${markdownText(projection.title).replace(/\n/g, " ")}`, ...projection.sections.map(section => `${section.heading ? `## ${markdownText(section.heading).replace(/\n/g, " ")}\n\n` : ""}${markdownText(section.body)}`)].join("\n\n").trim() + "\n";
  }

  return { normalizePacket, packetsForSession, findPacket, ensurePacket, createPacket, sourceChoices, createManualSection, createSourceSection, refreshSourceSection, projectRecord, redactText, validatePacket, previewPacket, approvePacket, previewHTML, exportHTML, exportMarkdown, renderHTML, digest };
});
