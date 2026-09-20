const test = require("node:test");
const assert = require("node:assert/strict");
const sources = require("../prep-sources.js");
const prep = require("../session-prep.js");
const notes = require("../prep-notes.js");
const table = require("../session-table.js");
const workflow = require("../session-workflow.js");
const continuity = require("../prep-continuity.js");
const preview = require("../player-preview.js");
function fixture() {
  const campaign = { id: "river", title: "River road", system: "Custom", sessions: [{ localId: "next", title: "The crossing", number: 1, upcoming: true }], characters: [], quests: [], locations: [], journal: [], arcs: [], documents: [
    { id: "guide-a", title: "River guide", contextEnabled: false, pageTexts: [{ page: 2, text: "The ferryman will carry travelers in exchange for a favor." }, { page: 3, text: "UNSELECTED_PRIVATE_PAGE The night watch closes the bridge." }, { page: 4, text: "" }] },
    { id: "guide-b", title: "River guide", pageTexts: [{ page: 2, text: "OTHER_BOOK_PRIVATE A different edition describes the bridge." }] },
    { id: "legacy", title: "Old travel notes", text: "A ferry stopped here long ago." }
  ] };
  workflow.ensureWorkflow(campaign);
  const session = campaign.sessions[0], plan = prep.ensurePrep(campaign, session);
  const ref = sources.listRecords(campaign).find(item => item.ref.id === "guide-a" && item.ref.page === 2).ref;
  return { campaign, session, plan, ref };
}
function drafted(f) {
  const book = notes.ensureWorkbench(f.campaign, f.session), source = notes.addSource(f.campaign, f.session, f.ref);
  book.draft = notes.createDraft(f.campaign, f.session);
  const row = notes.newRow("scenes", source);
  row.after = { title: "The ferryman's bargain", detail: "The ferryman asks for a favor before crossing.", question: "Accept the favor or seek another route?", kind: "social", minutes: 30 };
  book.draft.rows.push(row);
  return { book, source, row };
}
test("PDF source selection searches page text and retains exact book and page identities", () => {
  const f = fixture(), matches = notes.listRecords(f.campaign, "ferryman");
  assert.equal(matches.length, 1); assert.equal(matches[0].ref.id, "guide-a"); assert.equal(matches[0].ref.page, 2);
  assert.match(matches[0].ref.name, /PDF page 2/);
  assert.equal(sources.listRecords(f.campaign).length, 5);
  assert.equal(sources.listRecords(f.campaign, "long ago")[0].ref.page, null);
  f.campaign.documents[0].pageTexts.push({ page: 10, text: "Later journey notes." });
  assert.deepEqual(notes.listRecords(f.campaign, "River guide").map(item => item.ref.page), [2, 2, 3, 4, 10]);
});
test("several pages of one book remain distinct through reference normalization", () => {
  const f = fixture(), second = { ...f.ref, page: 3 };
  const refs = prep.normalizeReferences([f.ref, second, f.ref]);
  assert.equal(refs.length, 2); assert.notEqual(prep.referenceKey(refs[0]), prep.referenceKey(refs[1]));
  const scene = { id: "scene" };
  assert.equal(table.addSceneReference(f.campaign, scene, f.ref), true);
  assert.equal(table.addSceneReference(f.campaign, scene, f.ref), false);
  assert.equal(table.addSceneReference(f.campaign, scene, second), true);
  assert.equal(scene.references.length, 2);
});
test("missing, malformed and ambiguous source identities never fall back to another book or page", () => {
  const f = fixture();
  for (const page of [undefined, 0, -1, 2.5, "2", Infinity, null]) assert.equal(prep.resolvePinnedRecord(f.campaign, { ...f.ref, page }), null);
  f.campaign.documents[0].pageTexts.push({ page: 2, text: "AMBIGUOUS" });
  assert.equal(prep.resolvePinnedRecord(f.campaign, f.ref), null);
  assert(!sources.listRecords(f.campaign).some(item => item.ref.id === "guide-a" && item.ref.page === 2));
  f.campaign.documents[0].pageTexts.pop();
  const invalid = prep.recordReference({ ...f.ref, id: "guide-a".padEnd(170, "x") });
  assert.equal(prep.resolvePinnedRecord(f.campaign, invalid), null);
  f.campaign.documents.push({ ...f.campaign.documents[0] });
  assert.equal(prep.resolvePinnedRecord(f.campaign, f.ref), null);
  assert(!sources.listRecords(f.campaign).some(item => item.ref.id === "guide-a"));
  f.campaign.documents = f.campaign.documents.filter(document => document.id !== "guide-a");
  assert.equal(prep.resolvePinnedRecord(f.campaign, f.ref), null);
  assert.equal(prep.normalizeReferences([f.ref])[0].id, "guide-a");
});
test("legacy extraction links state that page numbers are unavailable and never become numbered pages", () => {
  const f = fixture(), legacy = sources.listRecords(f.campaign).find(item => item.ref.id === "legacy").ref;
  assert.match(prep.resolvePinnedRecord(f.campaign, legacy).title, /page unavailable/);
  assert.equal(prep.recordReference(legacy).page, null);
  f.campaign.documents.find(document => document.id === "legacy").pageTexts = [{ page: 1, text: "A new extraction" }];
  assert.equal(prep.resolvePinnedRecord(f.campaign, legacy), null);
  f.campaign.documents.find(document => document.id === "legacy").pageTexts = {};
  assert.equal(prep.resolvePinnedRecord(f.campaign, legacy), null);
});
test("source requests contain only selected page excerpts, with duplicate-page protection", () => {
  const f = fixture(), { book, source } = drafted(f);
  assert.throws(() => notes.addSource(f.campaign, f.session, f.ref), /already/);
  assert.doesNotThrow(() => notes.addSource(f.campaign, f.session, { ...f.ref, page: 3 }));
  book.sources.pop();
  source.text = "in exchange for a favor";
  const messages = JSON.stringify(notes.requestMessages(f.campaign, f.session));
  assert.match(messages, /in exchange for a favor/); assert.match(messages, /PDF page 2/);
  assert.doesNotMatch(messages, /UNSELECTED_PRIVATE_PAGE|OTHER_BOOK_PRIVATE|carry travelers/);
  assert.equal(f.campaign.documents[0].contextEnabled, false);
});
test("changed selected pages require review while other pages leave the saved draft valid", () => {
  const f = fixture(), { source } = drafted(f);
  f.campaign.documents[0].pageTexts[1].text += " A bell sounds.";
  assert.equal(notes.validateDraft(f.campaign, f.session).valid, true);
  f.campaign.documents[0].pageTexts[0].text = "The ferry has stopped running.";
  assert.equal(notes.validateDraft(f.campaign, f.session).valid, false);
  assert.match(source.text, /exchange for a favor/);
  notes.refreshSource(f.campaign, source); notes.rebaseDraft(f.campaign, f.session);
  assert.equal(source.ref.page, 2);
  assert.match(notes.validateDraft(f.campaign, f.session).error, /citation/);
});
test("approval retains page citations, deduplicates pins and preserves source documents", () => {
  const f = fixture(), before = structuredClone(f.campaign.documents), { source } = drafted(f);
  f.plan.pinned.push(structuredClone(f.ref));
  notes.rebaseDraft(f.campaign, f.session);
  notes.applyDraft(f.campaign, f.session);
  assert.equal(f.plan.pinned.length, 1); assert.equal(f.plan.notesWorkbench.draft, null);
  const restored = prep.normalizePrep(JSON.parse(JSON.stringify(f.plan)));
  assert.equal(restored.scenes[0].references[0].page, 2);
  assert.equal(restored.scenes[0].provenance.sourceNotes[0].ref.page, 2);
  assert.equal(restored.scenes[0].provenance.sourceNotes[0].text, source.text);
  const desk = workflow.startDesk(f.campaign, f.session);
  assert.equal(desk.beats[0].references[0].page, 2);
  const packet = prep.exportMarkdown(f.campaign, f.session, restored);
  assert.match(packet, /PDF page 2/); assert.match(packet, /exchange for a favor/);
  assert.doesNotMatch(packet, /UNSELECTED_PRIVATE_PAGE|OTHER_BOOK_PRIVATE/);
  assert.deepEqual(f.campaign.documents, before);
  assert.doesNotMatch(JSON.stringify(preview.projectCampaign(f.campaign)), /guide-a|exchange for a favor/);
});
test("renamed books resolve by identity and missing links remain in GM packets", () => {
  const f = fixture(); drafted(f); notes.applyDraft(f.campaign, f.session);
  f.campaign.documents[0].title = "Crossings and ferries";
  assert.match(prep.resolvePinnedRecord(f.campaign, f.ref).title, /Crossings and ferries/);
  f.campaign.documents.shift();
  assert.match(prep.exportMarkdown(f.campaign, f.session, f.plan), /unavailable/);
  assert.doesNotMatch(prep.exportMarkdown(f.campaign, f.session, f.plan), /OTHER_BOOK_PRIVATE/);
});
test("carry-forward preserves and independently deduplicates several pinned pages of one book", () => {
  const f = fixture(); f.plan.pinned.push(f.ref, { ...f.ref, page: 3, name: "River guide · PDF page 3" });
  f.plan.scenes.push({ id: "crossing", title: "The crossing", references: [f.ref] });
  const desk = workflow.startDesk(f.campaign, f.session); workflow.endDesk(f.campaign, desk.id);
  const target = { localId: "after", title: "After the crossing", number: 2, upcoming: true }; f.campaign.sessions.push(target); prep.ensurePrep(f.campaign, target);
  const review = continuity.buildReview(f.campaign, target, { sourceDeskId: desk.id });
  const pins = review.candidates.filter(row => row.collection === "pinned"); assert.equal(pins.length, 2); assert.notEqual(pins[0].provenance.key, pins[1].provenance.key);
  const result = continuity.applyReview(f.campaign, target, review, review.candidates.map(row => ({ id: row.id, accepted: true })));
  const nextSession = prep.findSession(result.campaign, prep.sessionReference(target)), next = prep.findPrepForSession(result.campaign, nextSession);
  assert.deepEqual(next.pinned.map(pin => pin.page).sort(), [2, 3]); assert.equal(next.scenes[0].references[0].page, 2);
  const repeated = continuity.buildReview(result.campaign, nextSession, { sourceDeskId: desk.id });
  assert(repeated.candidates.filter(row => row.collection === "pinned").every(row => row.duplicate));
});
test("empty extracted pages stay available as references and cannot become blank draft sources", () => {
  const f = fixture(), ref = { ...f.ref, page: 4 };
  assert.equal(prep.resolvePinnedRecord(f.campaign, ref).body, "");
  notes.addSource(f.campaign, f.session, ref);
  assert.throws(() => notes.createDraft(f.campaign, f.session), /Write or select/);
});
