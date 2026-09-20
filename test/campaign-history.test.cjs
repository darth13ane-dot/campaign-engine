const test = require("node:test");
const assert = require("node:assert/strict");
const history = require("../campaign-history.js");
const fixture = () => ({ id: "campaign", characters: [{ name: "Vale", description: "Old" }], quests: [{ title: "Find the key", status: "Active" }] });
test("records stable identities and restores a renamed individual record", () => {
  const campaign = fixture(), tracker = history.createTracker(); tracker.reset([campaign]);
  const id = campaign.characters[0].localId;
  campaign.characters[0].name = "Captain Vale"; tracker.capture([campaign], "Rename");
  assert.equal(campaign.history[0].changes.length, 1); assert.equal(campaign.characters[0].localId, id);
  history.undo(campaign, campaign.history[0].id); assert.equal(campaign.characters[0].name, "Vale");
  assert.throws(() => history.undo(campaign, campaign.history[0].id), /no longer/);
});
test("undoes a consequence batch atomically and rejects stale changes", () => {
  const campaign = fixture(), tracker = history.createTracker(); tracker.reset([campaign]);
  campaign.characters[0].description = "Confessed"; campaign.quests[0].status = "Done"; tracker.capture([campaign], "Session consequences");
  const entry = campaign.history[0]; campaign.quests[0].status = "Failed";
  assert.throws(() => history.undo(campaign, entry.id), /changed again/); assert.equal(campaign.characters[0].description, "Confessed");
  campaign.quests[0].status = "Done"; history.undo(campaign, entry.id);
  assert.equal(campaign.characters[0].description, "Old"); assert.equal(campaign.quests[0].status, "Active");
});
test("captures added records and keeps history unchanged for scratchpad-only saves", () => {
  const campaign = fixture(), tracker = history.createTracker(); tracker.reset([campaign]);
  campaign.sessionWorkflow = { scratch: "Typing" }; tracker.capture([campaign]); assert.equal(campaign.history, undefined);
  campaign.characters.push({ name: "New NPC" }); tracker.capture([campaign]);
  const copy = JSON.parse(JSON.stringify(campaign)); history.undo(copy, copy.history[0].id); assert.equal(copy.characters.length, 1);
});

test("history captures nested in-place edits, removals and additions across inactive campaigns without retaining live references", () => {
  const campaigns = [fixture(), { ...fixture(), id: "inactive" }], tracker = history.createTracker();
  campaigns[1].characters[0].custom = { nested: ["before", { value: 1 }], unknown: true };
  tracker.reset(campaigns);
  const before = campaigns.map(history.snapshot);
  campaigns[0].quests.splice(0, 1);
  campaigns[0].characters.push({ name: "Added", custom: { values: [1, 2] } });
  campaigns[1].characters[0].custom.nested[1].value = 2;
  campaigns[1].characters[0].name = "Renamed";
  const expected = campaigns.map((campaign, i) => history.diff(before[i], history.snapshot(campaign)));
  tracker.capture(campaigns, "Cross-campaign changes");
  campaigns.forEach((campaign, i) => assert.deepEqual(campaign.history[0].changes, expected[i]));
  const entry = campaigns[1].history[0];
  campaigns[1].characters[0].custom.nested[1].value = 3;
  assert.equal(entry.changes[0].after.custom.nested[1].value, 2);
  assert.equal(entry.changes[0].before.custom.nested[1].value, 1);
  tracker.capture(campaigns, "Later nested edit");
  assert.equal(campaigns[0].history.length, 1);
  history.undo(campaigns[1], campaigns[1].history[0].id);
  history.undo(campaigns[1], entry.id);
  assert.equal(campaigns[1].characters[0].name, "Vale");
  assert.equal(campaigns[1].characters[0].custom.nested[1].value, 1);
});

test("removed campaigns and workspace resets discard old baselines without manufacturing imported history", () => {
  const campaign = fixture(), tracker = history.createTracker();
  tracker.reset([campaign]); tracker.capture([]);
  const replacement = { ...fixture(), characters: [{ localId: campaign.characters[0].localId, name: "Replacement" }] };
  tracker.capture([replacement]);
  assert.equal(replacement.history, undefined);
  replacement.characters[0].name = "Fresh import"; tracker.reset([replacement]); tracker.capture([replacement]);
  assert.equal(replacement.history, undefined);
  replacement.characters[0].name = "Local edit"; tracker.capture([replacement]);
  assert.equal(replacement.history[0].changes[0].before.name, "Fresh import");
});
