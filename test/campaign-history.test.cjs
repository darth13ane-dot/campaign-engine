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
