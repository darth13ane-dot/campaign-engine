const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const packet = require("../player-packet.js");
const prep = require("../session-prep.js");
const workflow = require("../session-workflow.js");
const persistence = require("../workspace-persistence.js");
const merge = require("../archivist-merge.js");

function campaign(system = "wfrp4e") {
  return {
    id: "campaign-1", title: "SECRET_CAMPAIGN", source: "manual", system,
    sessions: [
      { localId: "next-session", title: "SECRET_NEXT_SESSION", number: 8, upcoming: true, knowledge: "gm", recap: "SECRET_NEXT_RECAP", directions: ["SECRET_DIRECTION"] },
      { archivistId: "past-session", title: "The crossing", number: 7, knowledge: "players", recap: "The company crossed the river.", directions: ["SECRET_DIRECTION"], liveNotes: "SECRET_LIVE_NOTE" }
    ],
    characters: [
      { localId: "vale", name: "Vale", knowledge: "players", description: "A ferryman in a blue coat.", role: "SECRET_ROLE", faction: "SECRET_FACTION", tags: ["SECRET_TAG"], stats: { secret: "SECRET_STAT" }, statBlock: "SECRET_STAT_BLOCK", relationships: ["SECRET_RELATIONSHIP"] },
      { localId: "villain", name: "SECRET_VILLAIN", knowledge: "gm", description: "SECRET_DESCRIPTION" }
    ],
    quests: [{ id: "road-quest", title: "The open road", knowledge: "players", detail: "Find the missing convoy.", reward: "SECRET_REWARD", notes: "SECRET_QUEST_NOTES" }],
    locations: [{ archivistId: "east-bank", title: "East bank", knowledge: "players", detail: "The old road reaches the river.", faction: "SECRET_LOCATION_FACTION" }],
    journal: [{ localId: "notice", title: "The notice", knowledge: "players", permission: "Player safe", body: "Travelers wanted at first light.", summary: "SECRET_SUMMARY" }],
    arcs: [{ localId: "arc", title: "SECRET_ARC", knowledge: "players", detail: "SECRET_ARC_DETAIL" }],
    connections: [{ detail: "SECRET_CONNECTION" }],
    sessionWorkflow: { schemaVersion: 2, preps: { hidden: { id: "hidden", opening: "SECRET_PREP" } }, desks: {}, reconciliations: {}, playerPackets: {} }
  };
}

function manualPacket(value, text = "Meet at the eastern gate.") {
  const result = packet.createPacket(value, value.sessions[0]);
  result.sections.push(packet.createManualSection({ heading: "Briefing", body: text }));
  return result;
}

function approve(value, draft) {
  return packet.approvePacket(value, draft, packet.previewPacket(value, draft).fingerprint);
}

function freeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test("source approval fingerprints remain compatible with v1.10.0", () => {
  const value = { journal: [{ localId: "notice", title: "Town notice", knowledge: "players", body: "Meet [[Character: Vale]] at the ferry." }], characters: [{ archivistId: "vale", name: "Vale", knowledge: "players", description: "The ferryman." }] };
  const source = packet.createSourceSection(value, { type: "journal", localId: "notice" });
  assert.equal(source.sourceFingerprint, "8b342fdde9bbc22cd1ba808c6d0c6a38ee901cfe5e49ab9f538874c6a2924a08");
});

test("one-pass projections preserve identity ambiguity, Unicode labels and recursive redaction rules", () => {
  const value = campaign();
  value.journal.push({ id: "unicode", title: "Cafe\u0301", body: "A shared sign", knowledge: "players" });
  value.journal.push({ id: "duplicate", localId: "notice", title: "Collision", body: "HIDDEN_COLLISION", knowledge: "gm" });
  value.locations.push({ archivistId: "east-bank", title: "Second bank", detail: "HIDDEN_DUPLICATE", knowledge: "players" });
  value.journal.push({ title: "Legacy", body: "Read [[Journal: Café]]. [[Journal: SECRET_MISSING]]", permission: "Player safe" });
  value.journal.push({ id: "cycle", title: "Cycle [[Journal: Cycle [[Journal: x]]]]", knowledge: "players" });
  const before = structuredClone(value), projector = packet.createProjector(value);
  const references = [
    { type: "characters", localId: "vale" }, { type: "character", localId: "villain" },
    { type: "world", archivistId: "east-bank" }, { type: "journal", localId: "notice" },
    { type: "journal", name: "CAFÉ" }, { type: "journal", name: "Legacy" },
    { type: "journal", id: "unicode", localId: "wrong" }, { type: "__proto__", name: "Legacy" },
    { type: "sessions", archivistId: "past-session" }
  ];
  for (const ref of references) assert.deepEqual(projector.projectRecord(ref), packet.projectRecord(value, ref));
  for (const text of ["Read [[Journal: Café]].", "[[Journal: SECRET_MISSING", "[[Journal: [[SECRET_NESTED]] suffix]]", "[[World: East bank]]", "[[Journal: Legacy]]"]) {
    assert.deepEqual(projector.redactText(text), packet.redactText(value, text));
    assert.doesNotMatch(projector.redactText(text).text, /SECRET_|HIDDEN_/);
  }
  assert.deepEqual(value, before);
  value.journal.find(record => record.id === "unicode").knowledge = "gm";
  value.journal.push({ id: "replacement", title: "Legacy", body: "Private duplicate", knowledge: "gm" });
  const changed = packet.createProjector(value);
  assert.equal(changed.projectRecord({ type: "journal", name: "Legacy" }), null);
  assert.equal(changed.redactText("[[Journal: Café]]").text, "[Unshared reference]");
});

test("packets begin empty with neutral titles and do not select or mutate campaign material", () => {
  for (const system of ["wfrp4e", "pf2e", "dnd5e", "custom-system"]) {
    const value = campaign(system), before = structuredClone(value);
    const result = packet.ensurePacket(value, value.sessions[0]);
    assert.equal(result.title, "Session 8 · Player packet");
    assert.deepEqual(result.sections, []);
    assert.equal(result.approval, undefined);
    assert.equal(packet.ensurePacket(value, value.sessions[0]), result);
    assert.deepEqual(value.sessions, before.sessions);
    for (const key of ["characters", "quests", "locations", "journal", "arcs", "connections"]) assert.deepEqual(value[key], before[key]);
    assert.deepEqual(value.sessionWorkflow.preps, before.sessionWorkflow.preps);
    assert.deepEqual(value.sessionWorkflow.desks, {});
    assert.equal(packet.validatePacket(value, result).empty, true);
    assert.throws(() => packet.previewHTML(value, result), /Add packet text/);
    assert.throws(() => packet.exportMarkdown(value, result), /Add packet text/);
  }
  const value = campaign(); delete value.sessions[0].number;
  assert.equal(packet.createPacket(value, value.sessions[0]).title, "Player packet");
});

test("multiple packets remain separately addressable after session rename, duplicate names, and target removal", () => {
  const value = campaign(), target = value.sessions[0];
  const first = manualPacket(value), second = packet.createPacket(value, target, { title: "Letter to the company" });
  first.createdAt = "2026-01-01T00:00:00Z"; second.createdAt = "2026-01-02T00:00:00Z";
  value.sessions.push({ ...target, localId: "other-session" });
  const other = packet.createPacket(value, value.sessions[2]);
  assert.deepEqual(packet.packetsForSession(value, target).map(item => item.id), [second.id, first.id]);
  assert.equal(packet.findPacket(value, target), second);
  assert.equal(packet.ensurePacket(value, target, { packetId: first.id }), first);
  assert.equal(packet.findPacket(value, target, other.id), null);
  assert.throws(() => packet.ensurePacket(value, target, { packetId: other.id }), /unavailable/);
  const signed = approve(value, first);
  prep.ensureSessionReferences(value, target); target.title = "A renamed secret session";
  assert.equal(packet.findPacket(value, target, first.id), first);
  assert.equal(packet.validatePacket(value, signed).approved, true);
  value.sessions[0] = { ...target, localId: "replacement-session" };
  assert.equal(packet.validatePacket(value, signed).valid, false);
  assert.throws(() => packet.exportHTML(value, signed), /session is missing/);
});

test("legacy multi-packet session references upgrade together before rename and ambiguous names stay unbound", () => {
  const value = campaign(); delete value.sessions[0].localId;
  const make = id => packet.normalizePacket({ id, sessionRef: { name: value.sessions[0].title, number: 8 }, title: id, sections: [{ id: `${id}-text`, kind: "manual", heading: "", body: "Saved draft" }] });
  value.sessionWorkflow.playerPackets = { one: make("one"), two: make("two") };
  packet.ensurePacket(value, value.sessions[0], { packetId: "one" });
  const stableId = value.sessions[0].localId;
  assert.ok(stableId);
  assert.equal(value.sessionWorkflow.playerPackets.one.sessionRef.localId, stableId);
  assert.equal(value.sessionWorkflow.playerPackets.two.sessionRef.localId, stableId);
  value.sessions[0].title = "Renamed";
  assert.equal(packet.packetsForSession(value, value.sessions[0]).length, 2);
  const duplicate = campaign();
  duplicate.sessions.push({ ...duplicate.sessions[0], localId: "duplicate" });
  duplicate.sessionWorkflow.playerPackets.old = packet.normalizePacket({ id: "old", sessionRef: { name: duplicate.sessions[0].title, number: 8 }, title: "Legacy packet", sections: [] });
  prep.ensureSessionReferences(duplicate, duplicate.sessions[0]);
  assert.equal(duplicate.sessionWorkflow.playerPackets.old.sessionRef.localId, undefined);
  assert.equal(packet.findPacket(duplicate, duplicate.sessions[0], "old"), null);
  assert.equal(packet.validatePacket(duplicate, duplicate.sessionWorkflow.playerPackets.old).valid, false);
});

test("source choices expose only explicit shared records and the five approved public fields", () => {
  const value = freeze(campaign()), before = JSON.stringify(value);
  const choices = packet.sourceChoices(value);
  assert.deepEqual(choices.map(choice => choice.ref.type), ["session", "character", "quest", "location", "journal"]);
  assert.ok(choices.every(choice => choice.selected === false));
  const projections = choices.map(choice => packet.projectRecord(value, choice.ref));
  assert.deepEqual(projections, [
    { heading: "The crossing", body: "The company crossed the river." },
    { heading: "Vale", body: "A ferryman in a blue coat." },
    { heading: "The open road", body: "Find the missing convoy." },
    { heading: "East bank", body: "The old road reaches the river." },
    { heading: "The notice", body: "Travelers wanted at first light." }
  ]);
  assert.doesNotMatch(JSON.stringify(projections), /SECRET_/);
  for (const type of ["arc", "arcs", "connection", "constructor", "__proto__"]) assert.equal(packet.projectRecord(value, { type, name: "SECRET_ARC" }), null);
  assert.equal(JSON.stringify(value), before);
});

test("source permission checks honor explicit knowledge and reject misleading legacy permissions", () => {
  for (const fields of [{}, { knowledge: "gm", public: true }, { knowledge: false, playerKnown: true }, { knowledge: "", permission: "Player safe" }, { permission: "not public" }, { permission: "read forbidden" }]) {
    const value = campaign(); value.journal = [{ localId: "notice", title: "The notice", body: "SECRET_BODY", ...fields }];
    assert.equal(packet.projectRecord(value, { type: "journal", localId: "notice" }), null);
    assert.equal(packet.sourceChoices(value).some(choice => choice.ref.type === "journal"), false);
    assert.throws(() => packet.createSourceSection(value, { type: "journal", localId: "notice" }), /unavailable/);
  }
  const value = campaign(); value.journal[0] = { localId: "notice", title: "The notice", body: "Shared legacy notice", permission: "Player safe" };
  assert.equal(packet.projectRecord(value, { type: "journal", localId: "notice" }).body, "Shared legacy notice");
});

test("source selection requires stable unique identity and refuses deleted or colliding identities", () => {
  const value = campaign(), source = value.characters[0];
  const reference = packet.sourceChoices(value).find(choice => choice.ref.type === "character").ref;
  value.characters[0] = { ...source, localId: "replacement" };
  assert.equal(packet.projectRecord(value, reference), null);
  value.characters[0] = source;
  value.characters.push({ ...source, name: "Another title", id: "different-secondary-id" });
  assert.equal(packet.projectRecord(value, reference), null);
  assert.equal(packet.sourceChoices(value).some(choice => choice.ref.type === "character"), false);
  value.characters.pop(); source.archivistId = "archivist-vale";
  assert.equal(packet.projectRecord(value, { ...reference, archivistId: "wrong-archivist-id" }), null);
  const legacy = { title: "Old handout", body: "Saved words", knowledge: "players" }; value.journal.push(legacy);
  assert.equal(packet.projectRecord(value, { type: "journal", name: legacy.title }).body, legacy.body);
  assert.throws(() => packet.createSourceSection(value, { type: "journal", name: legacy.title }), /stable record ID/);
  assert.equal(packet.sourceChoices(value).some(choice => choice.title === legacy.title), false);
  value.journal.push({ ...legacy });
  assert.equal(packet.projectRecord(value, { type: "journal", name: legacy.title }), null);
});

test("wiki references reveal only unique shared labels and redact entire hidden or malformed tokens", () => {
  const value = campaign();
  value.locations.push({ localId: "bank-hidden", title: "East bank", knowledge: "gm", detail: "SECRET_DUPLICATE" });
  const input = "Visit [[Character: Vale]] and [[The notice]]. Avoid [[Character: SECRET_VILLAIN]], [[Location: East bank]], [[Journal: SECRET_MISSING]], [[Arc: SECRET_ARC]], and [[Unknown: SECRET_UNKNOWN]].";
  const result = packet.redactText(value, input);
  assert.match(result.text, /^Visit Vale and The notice\./);
  assert.equal(result.redactions, 5);
  assert.doesNotMatch(result.text, /SECRET_|East bank|\[\[/);
  for (const malformed of ["[[Character: SECRET_VILLAIN", "[[Character: [[Journal: SECRET_NESTED]] SECRET_TAIL]]", "[[[[SECRET_NESTED]]]]"]) {
    assert.deepEqual(packet.redactText(value, malformed), { text: "[Unshared reference]", redactions: 1 });
  }
  value.journal[0].title = "Notice [[Character: SECRET_VILLAIN]]";
  const projection = packet.projectRecord(value, { type: "journal", localId: "notice" });
  assert.equal(projection.heading, "Notice [Unshared reference]");
  assert.equal(packet.redactText(value, { body: "SECRET_OBJECT" }).text, "");
});

test("source copies are explicitly chosen, editable, and approved without changing their records", () => {
  const value = campaign(), before = structuredClone(value.characters);
  const result = manualPacket(value);
  const section = packet.createSourceSection(value, { type: "character", localId: "vale" });
  result.sections.push(section);
  section.heading = "Our guide"; section.body = "Ask the ferryman for passage.";
  const preview = packet.previewPacket(value, result);
  assert.deepEqual(preview.sections[1], { heading: "Our guide", body: "Ask the ferryman for passage." });
  assert.equal(packet.validatePacket(value, result).approved, false);
  assert.throws(() => packet.exportHTML(value, result), /approve this exact/);
  const approved = packet.approvePacket(value, result, preview.fingerprint);
  assert.equal(result.approval, undefined);
  assert.equal(packet.validatePacket(value, approved).approved, true);
  assert.equal(packet.exportHTML(value, approved), packet.previewHTML(value, result));
  assert.match(packet.exportMarkdown(value, approved), /Ask the ferryman for passage/);
  assert.deepEqual(value.characters, before);
  const refreshed = packet.refreshSourceSection(value, section);
  assert.equal(refreshed.id, section.id);
  assert.equal(refreshed.body, before[0].description);
  assert.equal(section.body, "Ask the ferryman for passage.");
});

test("live source changes, removal, permission revocation, and collisions block all preview and export", () => {
  const changes = [
    value => value.characters[0].name = "Renamed ferryman",
    value => value.characters[0].description = "A changed description",
    value => value.characters[0].knowledge = "gm",
    value => value.characters.splice(0, 1),
    value => value.characters[0] = { ...value.characters[0], localId: "new-vale" },
    value => value.characters.push({ ...value.characters[0], name: "A colliding record" })
  ];
  for (const change of changes) {
    const value = campaign(), result = manualPacket(value);
    result.sections.push(packet.createSourceSection(value, { type: "character", localId: "vale" }));
    const approved = approve(value, result); change(value);
    const status = packet.validatePacket(value, approved);
    assert.equal(status.valid, false); assert.equal(status.approved, false);
    assert.ok(status.errors.some(error => error.code.startsWith("source-")));
    assert.throws(() => packet.previewPacket(value, approved), /source/i);
    assert.throws(() => packet.previewHTML(value, approved), /source/i);
    assert.throws(() => packet.exportHTML(value, approved), /source/i);
    assert.throws(() => packet.exportMarkdown(value, approved), /source/i);
    approved.sections.pop();
    assert.equal(packet.validatePacket(value, approved).valid, true);
    assert.equal(packet.validatePacket(value, approved).approved, false);
  }
});

test("source refresh explicitly replaces copied edits and requires a new approval while private fields stay irrelevant", () => {
  const value = campaign(), result = manualPacket(value);
  result.sections.push(packet.createSourceSection(value, { type: "character", localId: "vale" }));
  result.sections[1].body = "Adapted copy";
  const approved = approve(value, result);
  value.characters[0].stats.secret = "A new private stat"; value.characters[0].tags.push("secret change");
  value.sessions[0].directions = ["A new hidden direction"];
  assert.equal(packet.validatePacket(value, approved).approved, true);
  value.characters[0].description = "Now wearing a red coat.";
  assert.equal(packet.validatePacket(value, approved).valid, false);
  approved.sections[1] = packet.refreshSourceSection(value, approved.sections[1]);
  assert.equal(approved.sections[1].body, "Now wearing a red coat.");
  assert.equal(packet.validatePacket(value, approved).valid, true);
  assert.equal(packet.validatePacket(value, approved).approved, false);
  assert.equal(packet.validatePacket(value, approve(value, approved)).approved, true);
});

test("source and manual links bind approval to permission and stable identity even when rendered labels stay identical", () => {
  for (const field of ["title", "heading", "body"]) {
    const value = campaign(), result = manualPacket(value, "Shared instructions");
    if (field === "title") result.title = "Letter for [[Character: Vale]]";
    else result.sections[0][field] = "Meet [[Character: Vale]]";
    const approved = approve(value, result), before = packet.previewPacket(value, approved);
    value.characters[0].localId = "different-vale";
    const after = packet.previewPacket(value, approved);
    assert.deepEqual({ title: after.title, sections: after.sections }, { title: before.title, sections: before.sections });
    assert.notEqual(after.fingerprint, before.fingerprint);
    assert.equal(packet.validatePacket(value, approved).approved, false);
    value.characters[0].knowledge = "gm";
    assert.doesNotMatch(JSON.stringify(packet.previewPacket(value, approved)), /\bVale\b/);
  }
  const value = campaign(), result = manualPacket(value);
  value.journal[0].body = "Meet [[Character: Vale]].";
  result.sections.push(packet.createSourceSection(value, { type: "journal", localId: "notice" }));
  assert.equal(result.sections[1].body, "Meet Vale.");
  const approved = approve(value, result);
  value.characters[0].localId = "new-vale";
  assert.equal(packet.validatePacket(value, approved).valid, false);
  approved.sections[1] = packet.refreshSourceSection(value, approved.sections[1]);
  value.characters[0].knowledge = "gm";
  assert.equal(packet.validatePacket(value, approved).valid, false);
  approved.sections[1] = packet.refreshSourceSection(value, approved.sections[1]);
  assert.equal(approved.sections[1].body, "Meet [Unshared reference].");
  const privateLink = approve(value, manualPacket(value, "Avoid [[Character: SECRET_VILLAIN]]."));
  const original = packet.previewPacket(value, privateLink);
  value.characters[1].localId = "replacement-private-record";
  const replacement = packet.previewPacket(value, privateLink);
  assert.deepEqual(replacement.sections, original.sections);
  assert.notEqual(replacement.fingerprint, original.fingerprint);
  assert.equal(packet.validatePacket(value, privateLink).approved, false);
});

test("approval binds exact title, edits, order, and the preview snapshot and survives restoration of the same snapshot", () => {
  const value = campaign(), result = manualPacket(value);
  result.sections.push(packet.createManualSection({ heading: "Letter", body: "Bring the blue seal." }));
  const approved = approve(value, result), fingerprint = approved.approval.fingerprint;
  const undo = structuredClone(approved);
  for (const change of [draft => draft.title += " changed", draft => draft.sections[0].body += " changed", draft => draft.sections.reverse(), draft => draft.sections.push(packet.createManualSection({ body: "New section" }))]) {
    const edited = structuredClone(approved); change(edited);
    assert.equal(packet.validatePacket(value, edited).approved, false);
    assert.throws(() => packet.approvePacket(value, edited, fingerprint), /changed after preview/);
    assert.throws(() => packet.exportMarkdown(value, edited), /approve this exact/);
  }
  assert.equal(packet.validatePacket(value, undo).approved, true);
  assert.equal(packet.validatePacket(value, packet.normalizePacket(JSON.parse(JSON.stringify(approved)))).approved, true);
});

test("player output contains only approved projected content, with markup and URL text inert", () => {
  const value = campaign(), result = packet.createPacket(value, value.sessions[0]);
  result.sections.push(...packet.sourceChoices(value).map(choice => packet.createSourceSection(value, choice.ref)));
  result.sections.push(packet.createManualSection({ heading: '</h2><img src="https://host.test/track">', body: '<script>alert("x")</script>\n![Image](https://host.test/image)\n[Link](javascript:alert(1))\nhttps://host.test/path user@host.test\n# heading\n- item\n```html\n<iframe src=//host.test>\n```\n[[Character: SECRET_VILLAIN]]' }));
  const approved = approve(value, result), projection = packet.previewPacket(value, approved);
  const html = packet.exportHTML(value, approved), markdown = packet.exportMarkdown(value, approved);
  for (const text of [JSON.stringify(projection), html, markdown]) assert.doesNotMatch(text, /SECRET_/);
  assert.equal(html, packet.previewHTML(value, approved));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img src=&quot;https:\/\/host\.test\/track&quot;&gt;/);
  assert.doesNotMatch(html, /<(?:script|img|iframe|a|link|object|embed)\b/i);
  assert.match(html, /default-src 'none'/);
  assert.match(markdown, /&lt;script&gt;/);
  assert.ok(markdown.includes('\\!\\[Image\\]\\(https\\:\\/\\/host\\.test\\/image\\)'));
  assert.ok(markdown.includes("user\\@host\\.test"));
  assert.ok(markdown.includes("\\`\\`\\`html"));
  assert.equal(projection.redactions, 1);
  assert.deepEqual(Object.keys(projection).sort(), ["fingerprint", "redactions", "sections", "title"]);
  assert.ok(projection.sections.every(section => Object.keys(section).sort().join() === "body,heading"));
});

test("invalid and empty imported drafts cannot silently pass approval or export", () => {
  const value = campaign(), result = manualPacket(value);
  for (const invalid of [null, {}, { ...result, schemaVersion: 99 }, { ...result, sections: [{ id: "x", kind: "alien", body: "Unsafe" }] }, { ...result, sections: [result.sections[0], result.sections[0]] }, { ...result, sections: [{ id: "x", kind: "source", body: "Unsafe", sourceRef: { type: "arc", id: "arc" }, sourceFingerprint: "forged" }] }]) {
    assert.equal(packet.validatePacket(value, invalid).valid, false);
    assert.throws(() => packet.exportHTML(value, invalid));
  }
  result.sections[0].body = " \n ";
  assert.equal(packet.validatePacket(value, result).empty, true);
  assert.throws(() => packet.approvePacket(value, result, "forged"), /Add packet text/);
  const normalized = packet.normalizePacket({ ...result, injected: "SECRET_INJECTED", approval: { fingerprint: "forged", injected: "SECRET_INJECTED" }, sections: [{ id: "blank", kind: "manual", heading: "", body: "", hidden: "SECRET_INJECTED" }] });
  assert.equal(normalized.sections.length, 1);
  assert.equal(normalized.approval, undefined);
  assert.doesNotMatch(JSON.stringify(normalized), /SECRET_INJECTED/);
});

test("approved multi-packet drafts survive JSON, workflow normalization, persistence, and unrelated Archivist refresh", () => {
  const value = campaign(); value.source = "archivist"; value.archivistId = "remote-campaign";
  const first = manualPacket(value), second = packet.createPacket(value, value.sessions[0], { title: "Letter" });
  first.sections.push(packet.createSourceSection(value, { type: "journal", localId: "notice" }));
  first.sections.push(packet.createManualSection());
  second.sections.push(packet.createManualSection({ heading: "To our friends", body: "Return with the blue seal." }));
  for (const draft of [first, second]) value.sessionWorkflow.playerPackets[draft.id] = approve(value, draft);
  const saved = JSON.parse(JSON.stringify(value));
  saved.sessionWorkflow = workflow.normalizeWorkflow(saved.sessionWorkflow);
  assert.deepEqual(saved.sessionWorkflow.playerPackets, value.sessionWorkflow.playerPackets);
  const restored = persistence.initialState({ campaigns: [saved], activeCampaignId: saved.id }, [], {}).campaigns[0];
  assert.equal(packet.packetsForSession(restored, restored.sessions[0]).length, 2);
  for (const draft of packet.packetsForSession(restored, restored.sessions[0])) assert.equal(packet.validatePacket(restored, draft).approved, true);
  const incoming = structuredClone(value); incoming.title = "Renamed remote campaign"; delete incoming.sessionWorkflow;
  const merged = merge.mergeCampaigns([restored], [incoming]).campaigns[0];
  assert.deepEqual(merged.sessionWorkflow.playerPackets, restored.sessionWorkflow.playerPackets);
  for (const draft of packet.packetsForSession(merged, merged.sessions[0])) assert.equal(packet.validatePacket(merged, draft).approved, true);
  const checked = freeze(merged), before = JSON.stringify(checked);
  packet.previewPacket(checked, checked.sessionWorkflow.playerPackets[first.id]);
  packet.exportHTML(checked, checked.sessionWorkflow.playerPackets[first.id]);
  packet.exportMarkdown(checked, checked.sessionWorkflow.playerPackets[first.id]);
  assert.equal(JSON.stringify(checked), before);
});

test("schema2 startup normalizes malformed packet drafts once while repeated ensures retain editor references", () => {
  const value = campaign(), plan = value.sessionWorkflow.preps.hidden, desks = value.sessionWorkflow.desks;
  value.sessionWorkflow.playerPackets = {
    imported: { id: "imported", sessionRef: prep.sessionReference(value.sessions[0]), title: "Saved packet" },
    ignored: null
  };
  const existingWorkflow = value.sessionWorkflow;
  workflow.normalizeCampaign(value);
  const map = value.sessionWorkflow.playerPackets, imported = map.imported;
  assert.equal(value.sessionWorkflow, existingWorkflow);
  assert.deepEqual(imported.sections, []);
  assert.equal(imported.schemaVersion, 1);
  assert.equal(map.ignored, undefined);
  assert.equal(value.sessionWorkflow.preps.hidden, plan);
  assert.equal(value.sessionWorkflow.desks, desks);
  assert.equal(packet.ensurePacket(value, value.sessions[0], { packetId: "imported" }), imported);
  const section = packet.createManualSection({ heading: "Draft", body: "Keep typing here." });
  imported.sections.push(section);
  for (let index = 0; index < 3; index++) {
    assert.equal(workflow.ensureWorkflow(value), existingWorkflow);
    assert.equal(value.sessionWorkflow.playerPackets, map);
    assert.equal(value.sessionWorkflow.playerPackets.imported, imported);
    assert.equal(value.sessionWorkflow.playerPackets.imported.sections[0], section);
  }
  section.body = "Typing remains connected to saved state.";
  assert.equal(packet.previewPacket(value, map.imported).sections[0].body, section.body);
  const restored = JSON.parse(JSON.stringify(value));
  delete restored.sessionWorkflow.playerPackets.imported.sections;
  workflow.ensureWorkflow(restored);
  assert.deepEqual(restored.sessionWorkflow.playerPackets.imported.sections, []);
  const normalized = workflow.normalizeWorkflow(restored.sessionWorkflow);
  restored.sessionWorkflow = normalized;
  const normalizedMap = normalized.playerPackets;
  workflow.ensureWorkflow(restored);
  assert.equal(restored.sessionWorkflow.playerPackets, normalizedMap);
});

test("duplicate imported packet IDs recover every document and require fresh approval for each ambiguous copy", () => {
  const value = campaign(), original = manualPacket(value);
  original.sections.push(packet.createSourceSection(value, { type: "journal", localId: "notice" }));
  const first = approve(value, original), second = structuredClone(first);
  second.title = "Another saved letter"; second.sections[0].body = "A separately edited copy.";
  const signedSecond = approve(value, second);
  const third = { ...structuredClone(first), id: `${first.id}-recovered-1`, title: "Reserved recovery identity" };
  const rawMap = { first, second: signedSecond, third }, before = structuredClone(rawMap);
  for (const normalized of [workflow.normalizeWorkflow({ ...value.sessionWorkflow, playerPackets: rawMap }), (() => {
    const restored = { ...value, sessionWorkflow: { ...value.sessionWorkflow, playerPackets: JSON.parse(JSON.stringify(rawMap)) } };
    workflow.normalizeCampaign(restored);
    return restored.sessionWorkflow;
  })()]) {
    const entries = Object.values(normalized.playerPackets), restored = { ...value, sessionWorkflow: normalized };
    assert.equal(entries.length, 3);
    assert.equal(new Set(entries.map(item => item.id)).size, 3);
    const retained = entries.find(item => item.id === first.id), recovered = entries.find(item => item.title === second.title);
    assert.equal(retained.approval, undefined);
    assert.equal(packet.validatePacket(restored, retained).approved, false);
    assert.notEqual(recovered.id, first.id);
    assert.notEqual(recovered.id, third.id);
    assert.equal(recovered.approval, undefined);
    assert.deepEqual(recovered.sections, signedSecond.sections);
    assert.deepEqual(recovered.sessionRef, signedSecond.sessionRef);
    assert.equal(packet.validatePacket(restored, recovered).valid, true);
    assert.equal(packet.validatePacket(restored, recovered).approved, false);
    assert.throws(() => packet.exportHTML(restored, recovered), /approve this exact/);
    assert.equal(packet.validatePacket(restored, approve(restored, recovered)).approved, true);
    assert.equal(packet.packetsForSession(restored, restored.sessions[0]).length, 3);
    assert.deepEqual(workflow.normalizeWorkflow(normalized).playerPackets, normalized.playerPackets);
  }
  assert.deepEqual(rawMap, before);
});

test("browser UMD uses only prep and knowledge dependencies and produces the same approval fingerprints", () => {
  const context = vm.createContext({ TextEncoder, structuredClone, crypto: crypto.webcrypto });
  for (const file of ["session-prep.js", "campaign-knowledge.js", "player-packet.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  assert.equal(context.CampaignSessionWorkflow, undefined);
  const value = campaign(), result = manualPacket(value, "Café — 界 🜂");
  const browser = context.CampaignPlayerPacket;
  assert.equal(browser.previewPacket(value, result).fingerprint, packet.previewPacket(value, result).fingerprint);
  assert.equal(browser.previewHTML(value, result), packet.previewHTML(value, result));
  for (const text of ["", "abc", "界🜂", "x".repeat(1000)]) assert.equal(packet.digest(text), crypto.createHash("sha256").update(text).digest("hex"));
});
