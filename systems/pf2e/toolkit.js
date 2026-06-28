/* Pathfinder 2e owns its state, rules data, views, and event handlers here. */
let pf2eTab = "encounters";
let pf2eEncounterDraft = null;
let pf2eTreasureRoll = null;
let pf2eStatSearchState = null;
let pf2eCreationMode = "monster";

/* Pathfinder 2e prep tools use the encounter XP and treasure-by-level guidance
   directly, while keeping the campaign's actual creature and item choices local. */
const PF2E_ENCOUNTER_DIFFICULTIES = [
  { id: "trivial", label: "Trivial", perPc: 10, award: 40, note: "A small cost in resources, usually not a serious threat." },
  { id: "low", label: "Low", perPc: 15, award: 60, note: "A routine obstacle with a little pressure." },
  { id: "moderate", label: "Moderate", perPc: 20, award: 80, note: "A meaningful challenge that asks the party to engage." },
  { id: "severe", label: "Severe", perPc: 30, award: 120, note: "A serious fight that can drain resources or turn dangerous." },
  { id: "extreme", label: "Extreme", perPc: 40, award: 160, note: "A high-risk encounter best used deliberately." }
];

const PF2E_CREATURE_XP = { "-4": 10, "-3": 15, "-2": 20, "-1": 30, "0": 40, "1": 60, "2": 80, "3": 120, "4": 160, "5": 240 };
const PF2E_TREASURE_CURRENCY = { 1: 15, 2: 30, 3: 45, 4: 70, 5: 100, 6: 150, 7: 200, 8: 300, 9: 500, 10: 660, 11: 1000, 12: 1500, 13: 2200, 14: 3000, 15: 4500, 16: 6000, 17: 10000, 18: 15000, 19: 24000, 20: 35000 };
const PF2E_TREASURE_THEMES = [
  "A useful consumable hidden among ordinary travel supplies.",
  "Coin and trade goods marked with the defeated faction's sigil.",
  "A level-appropriate permanent item tied to this location's history.",
  "A ritual component or crafting material with a buyer already looking for it.",
  "A hoard split across several easy-to-miss containers.",
  "A rare-but-not-unique curiosity that points toward a new lead.",
  "A service, favor, or recovered document that can replace part of the coin value.",
  "A consumable cache built for the exact danger nearby."
];

/* GM Core creature and item benchmarks. These are intentionally presented as
   editable design guidance rather than a pass/fail rules validator. */
const PF2E_CREATURE_LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);
const PF2E_CREATURE_TABLES = {
  ac: {
    extreme: pf2eNumericTable("18 19 19 21 22 24 25 27 28 30 31 33 34 36 37 39 40 42 43 45 46 48 49 51 52 54"),
    high: pf2eNumericTable("15 16 16 18 19 21 22 24 25 27 28 30 31 33 34 36 37 39 40 42 43 45 46 48 49 51"),
    moderate: pf2eNumericTable("14 15 15 17 18 20 21 23 24 26 27 29 30 32 33 35 36 38 39 41 42 44 45 47 48 50"),
    low: pf2eNumericTable("12 13 13 15 16 18 19 21 22 24 25 27 28 30 31 33 34 36 37 39 40 42 43 45 46 48")
  },
  modifier: {
    extreme: pf2eNumericTable("9 10 11 12 14 15 17 18 20 21 23 24 26 27 29 30 32 33 35 36 38 39 41 43 44 46"),
    high: pf2eNumericTable("8 9 10 11 12 14 15 17 18 19 21 22 24 25 26 28 29 30 32 33 35 36 38 39 40 42"),
    moderate: pf2eNumericTable("5 6 7 8 9 11 12 14 15 16 18 19 21 22 23 25 26 28 29 30 32 33 35 36 37 38"),
    low: pf2eNumericTable("2 3 4 5 6 8 9 11 12 13 15 16 18 19 20 22 23 25 26 27 29 30 32 33 34 36"),
    terrible: pf2eNumericTable("0 1 2 3 4 6 7 8 10 11 12 14 15 16 18 19 20 22 23 24 26 27 28 30 31 32")
  },
  attack: {
    extreme: pf2eNumericTable("10 10 11 13 14 16 17 19 20 22 23 25 27 28 29 31 32 34 35 37 38 40 41 43 44 46"),
    high: pf2eNumericTable("8 8 9 11 12 14 15 17 18 20 21 23 24 26 27 29 30 32 33 35 36 38 39 41 42 44"),
    moderate: pf2eNumericTable("6 6 7 9 10 12 13 15 16 18 19 21 22 24 25 27 28 30 31 33 34 36 37 39 40 42"),
    low: pf2eNumericTable("4 4 5 7 8 9 11 12 13 15 16 17 19 20 21 23 24 25 27 28 29 31 32 33 35 36")
  },
  hp: {
    high: pf2eTextTable("9|17–20|24–26|36–40|53–59|72–78|91–97|115–123|140–148|165–173|190–198|215–223|240–248|265–273|290–298|315–323|340–348|365–373|390–398|415–423|440–448|465–473|495–505|532–544|569–581|617–633"),
    moderate: pf2eTextTable("7–8|14–16|19–21|28–32|42–48|57–63|72–78|91–99|111–119|131–139|151–159|171–179|191–199|211–219|231–239|251–259|271–279|291–299|311–319|331–339|351–359|371–379|395–405|424–436|454–466|492–508"),
    low: pf2eTextTable("5–6|11–13|14–16|21–25|31–37|42–48|53–59|67–75|82–90|97–105|112–120|127–135|142–150|157–165|172–180|187–195|202–210|217–225|232–240|247–255|262–270|277–285|295–305|317–329|339–351|367–383")
  },
  damage: {
    extreme: pf2eTextTable("1d6+1|1d6+3|1d8+4|1d12+4|1d12+8|2d10+7|2d12+7|2d12+10|2d12+12|2d12+15|2d12+17|2d12+20|2d12+22|3d12+19|3d12+21|3d12+24|3d12+26|3d12+29|3d12+31|3d12+34|4d12+29|4d12+32|4d12+34|4d12+37|4d12+39|4d12+42"),
    high: pf2eTextTable("1d4+1|1d6+2|1d6+3|1d10+4|1d10+6|2d8+5|2d8+7|2d8+9|2d10+9|2d10+11|2d10+13|2d12+13|2d12+15|3d10+14|3d10+16|3d10+18|3d12+17|3d12+18|3d12+19|3d12+20|4d10+20|4d10+22|4d10+24|4d10+26|4d12+24|4d12+26"),
    moderate: pf2eTextTable("1d4|1d4+2|1d6+2|1d8+4|1d8+6|2d6+5|2d6+6|2d6+8|2d8+8|2d8+9|2d8+11|2d10+11|2d10+12|3d8+12|3d8+14|3d8+15|3d10+14|3d10+15|3d10+16|3d10+17|4d8+17|4d8+19|4d8+20|4d8+22|4d10+20|4d10+22"),
    low: pf2eTextTable("1d4|1d4+1|1d4+2|1d6+3|1d6+5|2d4+4|2d4+6|2d4+7|2d6+6|2d6+8|2d6+9|2d6+10|2d8+10|3d6+10|3d6+11|3d6+13|3d6+14|3d6+15|3d6+16|3d6+17|4d6+14|4d6+15|4d6+17|4d6+18|4d6+19|4d6+21")
  }
};

const PF2E_CREATURE_PROFILES = {
  brute: { label: "Brute", ac: "moderate", perception: "low", fortitude: "high", reflex: "low", will: "low", hp: "high", attack: "high", damage: "high", speed: 25, note: "Durable and forceful, with clear weak defenses and fewer tactical tricks." },
  soldier: { label: "Soldier", ac: "extreme", perception: "moderate", fortitude: "high", reflex: "moderate", will: "moderate", hp: "moderate", attack: "high", damage: "high", speed: 25, note: "Hard to hit and reliable in melee. Avoid pairing extreme AC with high HP." },
  skirmisher: { label: "Skirmisher", ac: "high", perception: "moderate", fortitude: "low", reflex: "high", will: "moderate", hp: "moderate", attack: "high", damage: "moderate", speed: 35, note: "Mobile and accurate, with a vulnerable Fortitude save." },
  sniper: { label: "Sniper", ac: "moderate", perception: "high", fortitude: "low", reflex: "high", will: "moderate", hp: "low", attack: "high", damage: "high", speed: 25, note: "A dangerous ranged opener that folds when pinned down." },
  spellcaster: { label: "Spellcaster", ac: "low", perception: "high", fortitude: "low", reflex: "moderate", will: "high", hp: "low", attack: "low", damage: "low", speed: 25, note: "Low physical benchmarks leave room for high spell DCs and encounter-shaping magic." },
  "magical-striker": { label: "Magical striker", ac: "moderate", perception: "moderate", fortitude: "moderate", reflex: "high", will: "high", hp: "moderate", attack: "high", damage: "high", speed: 25, note: "Strong Strikes with a focused suite of innate or supplemental spells." },
  "skill-paragon": { label: "Skill paragon", ac: "moderate", perception: "high", fortitude: "low", reflex: "high", will: "high", hp: "moderate", attack: "moderate", damage: "moderate", speed: 25, note: "Excels through skills and one signature tactical ability rather than raw offense." }
};

const PF2E_ITEM_DCS = [15, 16, 17, 18, 19, 20, 23, 24, 25, 27, 28, 29, 30, 31, 34, 35, 37, 38, 41, 43];
const PF2E_PERMANENT_PRICES = pf2eTextTable("10–20 gp|25–35 gp|45–60 gp|75–100 gp|125–160 gp|200–250 gp|300–360 gp|415–500 gp|575–700 gp|820–1,000 gp|1,160–1,400 gp|1,640–2,000 gp|2,400–3,000 gp|3,600–4,500 gp|5,300–6,500 gp|7,900–10,000 gp|12,000–15,000 gp|18,600–24,000 gp|30,400–40,000 gp|52,000–70,000 gp");
const PF2E_CONSUMABLE_PRICES = pf2eTextTable("3–4 gp|5–7 gp|8–12 gp|13–20 gp|21–30 gp|31–50 gp|51–70 gp|71–100 gp|101–150 gp|151–200 gp|201–300 gp|301–400 gp|401–600 gp|601–900 gp|901–1,300 gp|1,301–2,000 gp|2,001–3,000 gp|3,001–5,000 gp|5,001–8,000 gp|8,001–14,000 gp");
const PF2E_ITEM_TYPES = ["Weapon", "Armor", "Shield", "Held item", "Worn item", "Consumable", "Alchemical item", "Rune", "Staff", "Wand", "Other"];
const PF2E_RELIC_ASPECTS = ["Air", "Artistry", "Beast", "Celestial", "Death", "Earth", "Fiend", "Fire", "Life", "Metal", "Mind", "Plant", "Shadow", "Water", "Wood"];
const PF2E_RELIC_GIFTS = [
  { level: 1, type: "Minor", gp: 20 },
  { level: 5, type: "Minor", gp: 160 },
  { level: 9, type: "Major", gp: 700 },
  { level: 13, type: "Major", gp: 3000 },
  { level: 17, type: "Grand", gp: 15000 }
];

const PF2E_PUBLIC_STAT_SOURCE = {
  label: "PF2e for Foundry public compendium JSON",
  treeUrl: "https://api.github.com/repos/foundryvtt/pf2e/git/trees/v14-dev?recursive=1",
  rawBase: "https://raw.githubusercontent.com/foundryvtt/pf2e/v14-dev/",
  blobBase: "https://github.com/foundryvtt/pf2e/blob/v14-dev/",
  repoUrl: "https://github.com/foundryvtt/pf2e/tree/v14-dev/packs/pf2e"
};

const PF2E_PUBLIC_CORE_PACKS = new Set([
  "pathfinder-monster-core",
  "pathfinder-monster-core-2",
  "pathfinder-npc-core",
  "pathfinder-bestiary",
  "pathfinder-bestiary-2",
  "pathfinder-bestiary-3",
  "npc-gallery"
]);

const PF2E_PUBLIC_SOURCE_FILTERS = [
  { id: "core", label: "Core creature packs", note: "Monster Core, NPC Core, legacy Bestiaries, and NPC Gallery" },
  { id: "remaster", label: "Remaster only", note: "Monster Core, Monster Core 2, and NPC Core" },
  { id: "all", label: "All public creature packs", note: "Includes adventure and Pathfinder Society bestiary packs" }
];

function pf2eData(campaign = activeCampaign()) {
  ensureCampaignPlanning(campaign);
  if (!campaign.systemData.pf2e || typeof campaign.systemData.pf2e !== "object") {
    campaign.systemData.pf2e = {};
  }
  const data = campaign.systemData.pf2e;
  if (!Array.isArray(data.encounters)) data.encounters = [];
  if (!Array.isArray(data.treasurePlans)) data.treasurePlans = [];
  if (!Array.isArray(data.statBlocks)) data.statBlocks = [];
  if (!Array.isArray(data.creations)) data.creations = [];
  return data;
}

function hasPf2eEnabled(campaign = activeCampaign()) {
  return enabledSystems(campaign).some(system => system.id === "pf2e");
}

function pf2eNumber(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function pf2eNumericTable(value) {
  return String(value).trim().split(/\s+/).map(Number);
}

function pf2eTextTable(value) {
  return String(value).split("|");
}

function pf2eStatState() {
  if (!pf2eStatSearchState) {
    pf2eStatSearchState = {
      query: "",
      level: "any",
      source: "core",
      status: "idle",
      error: "",
      results: [],
      index: null,
      truncated: false,
      details: {},
      pendingPath: ""
    };
  }
  return pf2eStatSearchState;
}

function pf2eTitleCase(value) {
  return String(value || "").split(/[-_\s]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function pf2ePublicPack(path) {
  return String(path || "").split("/")[2] || "";
}

function pf2ePublicPackLabel(pack) {
  const labels = {
    "pathfinder-monster-core": "Monster Core",
    "pathfinder-monster-core-2": "Monster Core 2",
    "pathfinder-npc-core": "NPC Core",
    "pathfinder-bestiary": "Bestiary",
    "pathfinder-bestiary-2": "Bestiary 2",
    "pathfinder-bestiary-3": "Bestiary 3",
    "npc-gallery": "NPC Gallery"
  };
  return labels[pack] || pf2eTitleCase(pack.replace(/^pathfinder-/, ""));
}

function pf2ePublicStatCandidate(path) {
  const pack = pf2ePublicPack(path);
  if (!String(path || "").startsWith("packs/pf2e/") || !String(path || "").endsWith(".json")) return false;
  if (/ability-glossary|effects|features|actions|spells|equipment|journals|rollable|boons|curses|macros|vehicles|deities|ancestr|background|heritage/i.test(pack)) return false;
  return /bestiary|monster-core|npc-core|npc-gallery/i.test(pack);
}

function pf2ePublicSourceMatches(pack, source) {
  if (source === "all") return true;
  if (source === "remaster") return ["pathfinder-monster-core", "pathfinder-monster-core-2", "pathfinder-npc-core"].includes(pack);
  return PF2E_PUBLIC_CORE_PACKS.has(pack);
}

function pf2ePublicEntry(path) {
  const file = String(path || "").split("/").pop() || "";
  const slug = file.replace(/\.json$/i, "");
  const pack = pf2ePublicPack(path);
  return {
    path,
    slug,
    name: pf2eTitleCase(slug),
    pack,
    packLabel: pf2ePublicPackLabel(pack),
    sourceUrl: PF2E_PUBLIC_STAT_SOURCE.blobBase + path
  };
}

function pf2ePlainText(value) {
  return String(value || "")
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1")
    .replace(/@(?:Check|Damage|Template|Localize|Compendium|UUID)\[[^\]]+\](?:\{([^}]+)\})?/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pf2eArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.value)) return value.value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function pf2eFirstNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const match = String(value ?? "").match(/-?\d+/);
    if (match) return Number(match[0]);
  }
  return null;
}

function pf2eFirstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value?.value === "string" && value.value.trim()) return value.value.trim();
  }
  return "";
}

function pf2eDamageSummary(item) {
  const rolls = item?.system?.damageRolls;
  if (!rolls || typeof rolls !== "object") return "";
  return Object.values(rolls).map(roll => [roll.damage, roll.damageType].filter(Boolean).join(" ")).filter(Boolean).join(", ");
}

function pf2eNormalizePublicStatBlock(raw, path) {
  if (!raw || typeof raw !== "object") throw new Error("The public source did not return a usable stat block.");
  const system = raw.system || {};
  const attributes = system.attributes || {};
  const details = system.details || {};
  const level = pf2eFirstNumber(details.level?.value, details.level, system.level?.value, system.level);
  if (level === null || raw.type !== "npc") throw new Error("That public file is not a PF2e creature stat block.");
  const traits = pf2eArray(system.traits?.value).map(String).slice(0, 10);
  const items = Array.isArray(raw.items) ? raw.items : [];
  const attacks = items.filter(item => item.type === "melee" || item.type === "weapon").slice(0, 4).map(item => {
    const damage = pf2eDamageSummary(item);
    return { name: item.name || "Strike", detail: damage };
  });
  const abilities = items.filter(item => ["action", "feat"].includes(item.type)).slice(0, 5).map(item => ({
    name: item.name || "Ability",
    detail: pf2ePlainText(item.system?.description?.value).slice(0, 180)
  }));
  const source = pf2ePublicEntry(path);
  return {
    id: "public-" + source.slug,
    sourceId: path,
    name: String(raw.name || source.name).trim(),
    level,
    source: PF2E_PUBLIC_STAT_SOURCE.label,
    sourcePack: source.packLabel,
    sourceUrl: source.sourceUrl,
    traits,
    size: pf2eFirstText(system.traits?.size?.value, system.traits?.size),
    ac: pf2eFirstNumber(attributes.ac?.value, attributes.ac?.mod),
    hp: pf2eFirstNumber(attributes.hp?.value, attributes.hp?.max),
    perception: pf2eFirstNumber(system.perception?.mod, system.perception?.value),
    saves: {
      fortitude: pf2eFirstNumber(system.saves?.fortitude?.value, system.saves?.fortitude?.mod),
      reflex: pf2eFirstNumber(system.saves?.reflex?.value, system.saves?.reflex?.mod),
      will: pf2eFirstNumber(system.saves?.will?.value, system.saves?.will?.mod)
    },
    speed: pf2eFirstText(attributes.speed?.value, attributes.speed?.total),
    languages: pf2eArray(details.languages).slice(0, 6),
    attacks,
    abilities,
    summary: pf2ePlainText(details.publicNotes || details.blurb || raw.system?.details?.description || "").slice(0, 220)
  };
}

async function pf2eLoadPublicStatIndex() {
  const state = pf2eStatState();
  if (Array.isArray(state.index)) return state.index;
  state.status = "loading";
  state.error = "";
  render();
  const response = await fetch(PF2E_PUBLIC_STAT_SOURCE.treeUrl, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error("Public index returned " + response.status + ".");
  const payload = await response.json();
  state.truncated = Boolean(payload.truncated);
  state.index = (payload.tree || [])
    .filter(entry => entry.type === "blob" && pf2ePublicStatCandidate(entry.path))
    .map(entry => pf2ePublicEntry(entry.path));
  return state.index;
}

function pf2eFilteredPublicEntries(index, state) {
  const tokens = String(state.query || "").toLowerCase().split(/\s+/).filter(Boolean);
  return index.filter(entry => {
    if (!pf2ePublicSourceMatches(entry.pack, state.source)) return false;
    const cached = state.details[entry.path];
    const haystack = [entry.name, entry.slug, entry.packLabel, cached?.name, cached?.traits?.join(" ")].filter(Boolean).join(" ").toLowerCase();
    return tokens.every(token => haystack.includes(token));
  });
}

async function pf2eLoadPublicStatBlock(path) {
  const state = pf2eStatState();
  if (state.details[path]) return state.details[path];
  const response = await fetch(PF2E_PUBLIC_STAT_SOURCE.rawBase + path);
  if (!response.ok) throw new Error("Public stat block returned " + response.status + ".");
  const block = pf2eNormalizePublicStatBlock(await response.json(), path);
  state.details[path] = block;
  return block;
}

async function pf2eRunPublicStatSearch(form) {
  const state = pf2eStatState();
  const data = new FormData(form);
  state.query = String(data.get("query") || "").trim();
  state.level = String(data.get("level") || "any");
  state.source = String(data.get("source") || "core");
  state.error = "";
  if (state.query.length < 2) {
    state.results = [];
    state.status = "idle";
    render();
    showToast("Search by at least two letters of a creature name.");
    return;
  }
  try {
    state.status = "searching";
    render();
    const index = await pf2eLoadPublicStatIndex();
    state.status = "searching";
    const preliminary = pf2eFilteredPublicEntries(index, state).slice(0, state.level === "any" ? 18 : 36);
    await Promise.all(preliminary.slice(0, 18).map(entry => pf2eLoadPublicStatBlock(entry.path).catch(() => null)));
    const level = state.level === "any" ? null : Number(state.level);
    state.results = preliminary
      .filter(entry => level === null || state.details[entry.path]?.level === level)
      .slice(0, 18);
    state.status = "ready";
    render();
  } catch (error) {
    state.status = "error";
    state.error = error.message || "The public stat-block source could not be reached.";
    render();
    showToast("Public stat-block search failed: " + state.error);
  }
}

function pf2eCreatureFromStatBlock(block) {
  return {
    name: block.name,
    level: pf2eNumber(block.level, 0, -1, 25),
    adjustment: "standard",
    source: block.source || "Public stat block",
    sourceId: block.sourceId || block.id,
    sourceUrl: block.sourceUrl,
    sourcePack: block.sourcePack,
    traits: (block.traits || []).slice(0, 6),
    ac: block.ac,
    hp: block.hp
  };
}

async function pf2eAddPublicStatToEncounter(path) {
  const state = pf2eStatState();
  state.pendingPath = path;
  render();
  try {
    const block = await pf2eLoadPublicStatBlock(path);
    pf2eDraft().creatures.push(pf2eCreatureFromStatBlock(block));
    pf2eTab = "encounters";
    state.pendingPath = "";
    render();
    showToast(block.name + " added to the encounter.");
  } catch (error) {
    state.pendingPath = "";
    render();
    showToast("Could not add that stat block: " + (error.message || "Unknown import error."));
  }
}

async function pf2eSavePublicStatBlock(path) {
  const state = pf2eStatState();
  state.pendingPath = path;
  render();
  try {
    const block = await pf2eLoadPublicStatBlock(path);
    const library = pf2eData().statBlocks;
    const existing = library.find(item => item.sourceId === block.sourceId);
    if (existing) Object.assign(existing, block, { id: existing.id, importedAt: existing.importedAt || Date.now() });
    else library.unshift({ ...structuredClone(block), id: featureId("pf2e-stat"), importedAt: Date.now() });
    saveState();
    state.pendingPath = "";
    render();
    showToast(block.name + " saved to the stat-block library.");
  } catch (error) {
    state.pendingPath = "";
    render();
    showToast("Could not save that stat block: " + (error.message || "Unknown import error."));
  }
}

function pf2eAddSavedStatToEncounter(id) {
  const block = pf2eData().statBlocks.find(item => item.id === id);
  if (!block) return;
  pf2eDraft().creatures.push(pf2eCreatureFromStatBlock(block));
  pf2eTab = "encounters";
  render();
  showToast(block.name + " added to the encounter.");
}

function pf2eDefaultEncounter(campaign = activeCampaign()) {
  return {
    title: "",
    partyLevel: 1,
    partySize: Math.max(1, Number(campaign.players) || 4),
    difficulty: "moderate",
    creatures: []
  };
}

function pf2eDraft(campaign = activeCampaign()) {
  if (!pf2eEncounterDraft) pf2eEncounterDraft = pf2eDefaultEncounter(campaign);
  return pf2eEncounterDraft;
}

function pf2eDifficulty(id) {
  return PF2E_ENCOUNTER_DIFFICULTIES.find(difficulty => difficulty.id === id) || PF2E_ENCOUNTER_DIFFICULTIES[2];
}

function pf2eCreatureEffectiveLevel(creature) {
  const adjustment = creature.adjustment === "elite" ? 1 : creature.adjustment === "weak" ? -1 : 0;
  return pf2eNumber(creature.level, 0, -1, 25) + adjustment;
}

function pf2eCreatureXp(partyLevel, creature) {
  const difference = pf2eCreatureEffectiveLevel(creature) - partyLevel;
  if (difference <= -5) return 0;
  return PF2E_CREATURE_XP[Math.min(5, difference)] || 0;
}

function pf2eEncounterSummary(draft) {
  const difficulty = pf2eDifficulty(draft.difficulty);
  const partySize = pf2eNumber(draft.partySize, 4, 1, 10);
  const partyLevel = pf2eNumber(draft.partyLevel, 1, 1, 20);
  const total = (draft.creatures || []).reduce((sum, creature) => sum + pf2eCreatureXp(partyLevel, creature), 0);
  const budget = difficulty.perPc * partySize;
  const fourPcEquivalent = Math.round(total * 4 / partySize);
  const bands = PF2E_ENCOUNTER_DIFFICULTIES;
  let measured = total < 10 ? "Below trivial" : bands[bands.length - 1].label;
  for (let index = 0; index < bands.length; index += 1) {
    const current = bands[index];
    const next = bands[index + 1];
    if (!next || fourPcEquivalent < (current.award + next.award) / 2) {
      measured = current.label;
      break;
    }
  }
  const delta = total - budget;
  const tolerance = Math.max(5, Math.ceil(difficulty.perPc * partySize * .12));
  const status = Math.abs(delta) <= tolerance ? "On target" : delta < 0 ? "Under budget" : "Over budget";
  return { difficulty, partySize, partyLevel, total, budget, fourPcEquivalent, measured, delta, tolerance, status };
}

function pf2eCreatureLine(creature, index, partyLevel) {
  const effective = pf2eCreatureEffectiveLevel(creature);
  const adjustment = creature.adjustment === "elite" ? "Elite" : creature.adjustment === "weak" ? "Weak" : "Standard";
  const xp = pf2eCreatureXp(partyLevel, creature);
  const difference = effective - partyLevel;
  const warning = difference > 4 ? " <small>Above the usual +4 encounter range</small>" : "";
  const imported = [creature.sourcePack, creature.ac ? "AC " + creature.ac : "", creature.hp ? "HP " + creature.hp : "", ...(creature.traits || []).slice(0, 3)].filter(Boolean);
  const source = creature.sourceUrl ? " <a class=\"pf2e-source-link\" href=\"" + esc(creature.sourceUrl) + "\" target=\"_blank\" rel=\"noreferrer\">Source ↗</a>" : "";
  return "<li><span class=\"pf2e-creature-mark\">" + esc(String(index + 1).padStart(2, "0")) + "</span><div><strong>" + esc(creature.name || "Unnamed creature") + "</strong><small>Level " + esc(effective) + " · " + esc(adjustment) + (imported.length ? " · " + esc(imported.join(" · ")) : "") + warning + source + "</small></div><b>" + xp + " XP</b><button class=\"quiet-button\" type=\"button\" data-remove-pf2e-creature=\"" + index + "\">Remove</button></li>";
}

function pf2eEncounterBuilder(campaign) {
  const draft = pf2eDraft(campaign);
  const summary = pf2eEncounterSummary(draft);
  const targetOptions = PF2E_ENCOUNTER_DIFFICULTIES.map(difficulty => "<option value=\"" + difficulty.id + "\"" + (difficulty.id === draft.difficulty ? " selected" : "") + ">" + difficulty.label + " · " + (difficulty.perPc * summary.partySize) + " XP budget</option>").join("");
  const creatureRows = draft.creatures.length ? "<ol class=\"pf2e-creature-list\">" + draft.creatures.map((creature, index) => pf2eCreatureLine(creature, index, summary.partyLevel)).join("") + "</ol>" : "<div class=\"pf2e-empty-list\">Add creatures to see their XP cost against the chosen budget.</div>";
  const statusClass = summary.status === "On target" ? "on-target" : summary.status === "Over budget" ? "over" : "under";
  return "<section class=\"pf2e-builder-grid\"><article class=\"card pf2e-encounter-card\"><div class=\"section-title\"><div><p class=\"eyebrow\">ENCOUNTER BUDGET</p><h2>Build a tactical scene</h2></div><span class=\"tag\">XP math live</span></div><p class=\"pf2e-intro\">Set the party, choose a threat, and stack creatures. Weak and elite adjustments shift a creature's effective level for this budget.</p><form id=\"pf2eEncounterForm\" class=\"pf2e-form\"><div class=\"pf2e-config-grid\"><label>Encounter title<input name=\"title\" maxlength=\"80\" value=\"" + esc(draft.title) + "\" placeholder=\"The bridge at dusk\" /></label><label>Party level<input name=\"partyLevel\" type=\"number\" min=\"1\" max=\"20\" value=\"" + summary.partyLevel + "\" /></label><label>Party size<input name=\"partySize\" type=\"number\" min=\"1\" max=\"10\" value=\"" + summary.partySize + "\" /></label><label>Target threat<select name=\"difficulty\">" + targetOptions + "</select></label></div><div class=\"pf2e-add-creature\"><label>Creature<input name=\"creatureName\" maxlength=\"80\" placeholder=\"River drake\" /></label><label>Creature level<input name=\"creatureLevel\" type=\"number\" min=\"-1\" max=\"25\" value=\"" + summary.partyLevel + "\" /></label><label>Adjustment<select name=\"creatureAdjustment\"><option value=\"standard\">Standard</option><option value=\"weak\">Weak (−1)</option><option value=\"elite\">Elite (+1)</option></select></label><button class=\"secondary-button\" type=\"button\" data-add-pf2e-creature>Add creature</button></div>" + creatureRows + "<div class=\"pf2e-form-actions\"><button class=\"primary-button\" type=\"submit\">Save encounter <span>→</span></button><button class=\"quiet-button\" type=\"button\" data-reset-pf2e-encounter>Clear draft</button></div></form></article><aside class=\"card pf2e-budget-card\"><p class=\"eyebrow\">THREAT READOUT</p><div class=\"pf2e-budget-number\"><strong>" + summary.total + "</strong><span>of " + summary.budget + " XP</span></div><div class=\"pf2e-meter\" aria-label=\"Encounter uses " + summary.total + " of " + summary.budget + " XP\"><span style=\"width:" + Math.min(100, Math.round(summary.total / Math.max(summary.budget, 1) * 100)) + "%\"></span></div><div class=\"pf2e-status " + statusClass + "\"><strong>" + esc(summary.status) + "</strong><span>Plays as " + esc(summary.measured) + " for this party</span></div><dl class=\"pf2e-facts\"><div><dt>Target</dt><dd>" + esc(summary.difficulty.label) + "</dd></div><div><dt>XP award / PC</dt><dd>" + summary.fourPcEquivalent + " XP</dd></div><div><dt>Difference</dt><dd>" + (summary.delta > 0 ? "+" : "") + summary.delta + " XP</dd></div></dl><p class=\"quiet-copy\">" + esc(summary.difficulty.note) + " XP awards scale from the encounter's effective threat, not the number of player characters.</p></aside></section>";
}

function pf2eTreasureRows(level) {
  const itemLevel = offset => Math.max(0, Math.min(20, level + offset));
  const permanent = level < 3 ? [itemLevel(1), itemLevel(0)] : [itemLevel(1), itemLevel(0), itemLevel(-1)];
  const consumable = level < 3 ? [itemLevel(1), itemLevel(0), itemLevel(-1)] : [itemLevel(1), itemLevel(0), itemLevel(-1), itemLevel(-2)];
  return {
    permanent: permanent.map(item => "<li><span>2×</span> permanent item · level " + item + "</li>").join(""),
    consumable: consumable.map(item => "<li><span>2×</span> consumable · level " + item + "</li>").join("")
  };
}

function pf2eTreasurePlanCard(plan) {
  return "<article class=\"card pf2e-saved-card\"><div><p class=\"eyebrow\">LEVEL " + esc(plan.level) + " TREASURE</p><h3>" + esc(plan.title) + "</h3><p>" + esc(plan.hook || "Treasure plan") + "</p></div><div class=\"pf2e-saved-meta\"><span>" + esc(plan.partySize) + " PCs</span><span>" + esc(plan.currency) + " gp currency</span></div><button class=\"quiet-button\" type=\"button\" data-remove-pf2e-treasure=\"" + esc(plan.id) + "\">Remove</button></article>";
}

function pf2eTreasureTables(campaign) {
  const draft = pf2eDraft(campaign);
  const level = pf2eNumber(draft.partyLevel, 1, 1, 20);
  const partySize = pf2eNumber(draft.partySize, Math.max(1, Number(campaign.players) || 4), 1, 10);
  const rows = pf2eTreasureRows(level);
  const roll = pf2eTreasureRoll || "Roll a theme when you want the parcel mix to feel like it belongs somewhere specific.";
  const plans = pf2eData(campaign).treasurePlans || [];
  return "<section class=\"pf2e-treasure-layout\"><article class=\"card pf2e-treasure-card\"><div class=\"section-title\"><div><p class=\"eyebrow\">TREASURE BY LEVEL</p><h2>Plan a full level's rewards</h2></div><span class=\"tag\">Party of " + partySize + "</span></div><p class=\"pf2e-intro\">Use this as a party-level guideline: item parcels stay separate from the currency entry, so you can place them across scenes instead of dropping one chest full of everything.</p><form id=\"pf2eTreasureForm\" class=\"pf2e-treasure-form\"><label>Party level<select name=\"level\">" + Array.from({ length: 20 }, (_, index) => index + 1).map(item => "<option value=\"" + item + "\"" + (item === level ? " selected" : "") + ">Level " + item + " · " + PF2E_TREASURE_CURRENCY[item].toLocaleString() + " gp currency</option>").join("") + "</select></label><label>Treasure plan title<input required name=\"title\" maxlength=\"80\" placeholder=\"Rewards from the flooded observatory\" /></label><div class=\"pf2e-treasure-result\"><span>" + esc(roll) + "</span><button class=\"secondary-button\" type=\"button\" data-roll-pf2e-treasure>Roll reward theme</button></div><button class=\"primary-button\" type=\"submit\">Save treasure plan <span>→</span></button></form><div class=\"pf2e-parcel-grid\"><section><small>Permanent item parcels</small><ul>" + rows.permanent + "</ul></section><section><small>Consumable parcels</small><ul>" + rows.consumable + "</ul></section><section class=\"currency\"><small>Currency entry</small><strong>" + PF2E_TREASURE_CURRENCY[level].toLocaleString() + " gp</strong><span>for the party's level " + level + " rewards</span></section></div></article><aside class=\"card pf2e-reference-card\"><p class=\"eyebrow\">PLACEMENT PROMPT</p><h2>Make it discoverable.</h2><p>Place currency, consumables, and permanent items in different fiction-facing places: a creature's kit, a locked cache, a grateful contact, a salvage site, or an earned favor.</p><div class=\"resource-fields\"><span>Keep an eye on</span><b>Item level</b><b>Party access</b><b>Story relevance</b></div></aside></section>" + "<section class=\"pf2e-saved-section\"><div class=\"section-title\"><h2>Saved treasure plans</h2><span class=\"tag\">" + plans.length + " saved</span></div>" + (plans.length ? "<div class=\"pf2e-saved-grid\">" + plans.map(pf2eTreasurePlanCard).join("") + "</div>" : "<div class=\"empty-state\"><h2>No treasure plans yet.</h2><p>Save a level's parcel mix once you know where the rewards will appear.</p></div>") + "</section>";
}

function pf2eFormatModifier(value) {
  return Number(value) >= 0 ? "+" + value : String(value);
}

function pf2eRangeMiddle(value) {
  const numbers = String(value || "").match(/\d+/g)?.map(Number) || [];
  if (!numbers.length) return 1;
  return Math.round(numbers.reduce((sum, number) => sum + number, 0) / numbers.length);
}

function pf2eCreatureBenchmark(level, profileId) {
  const safeLevel = pf2eNumber(level, 1, -1, 24);
  const index = PF2E_CREATURE_LEVELS.indexOf(safeLevel);
  const profile = PF2E_CREATURE_PROFILES[profileId] || PF2E_CREATURE_PROFILES.brute;
  const hpRange = PF2E_CREATURE_TABLES.hp[profile.hp][index];
  return {
    level: safeLevel,
    profileId: profileId in PF2E_CREATURE_PROFILES ? profileId : "brute",
    profile: profile.label,
    note: profile.note,
    ac: PF2E_CREATURE_TABLES.ac[profile.ac][index],
    perception: PF2E_CREATURE_TABLES.modifier[profile.perception][index],
    saves: {
      fortitude: PF2E_CREATURE_TABLES.modifier[profile.fortitude][index],
      reflex: PF2E_CREATURE_TABLES.modifier[profile.reflex][index],
      will: PF2E_CREATURE_TABLES.modifier[profile.will][index]
    },
    hp: pf2eRangeMiddle(hpRange),
    hpRange,
    attack: PF2E_CREATURE_TABLES.attack[profile.attack][index],
    damage: PF2E_CREATURE_TABLES.damage[profile.damage][index],
    speed: profile.speed,
    tiers: {
      ac: profile.ac,
      perception: profile.perception,
      fortitude: profile.fortitude,
      reflex: profile.reflex,
      will: profile.will,
      hp: profile.hp,
      attack: profile.attack,
      damage: profile.damage
    }
  };
}

function pf2eFormValue(data, name, fallback = "") {
  const value = data?.get?.(name);
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function pf2eCommaList(value) {
  return String(value || "").split(",").map(item => item.trim()).filter(Boolean);
}

function pf2eLineList(value) {
  return String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
}

function pf2eItemGuidance(level, category) {
  const safeLevel = pf2eNumber(level, 1, 1, 20);
  const consumable = /consumable|alchemical/i.test(category);
  return {
    level: safeLevel,
    dc: PF2E_ITEM_DCS[safeLevel - 1],
    price: (consumable ? PF2E_CONSUMABLE_PRICES : PF2E_PERMANENT_PRICES)[safeLevel - 1],
    consumable,
    note: consumable
      ? "Keep a consumable below the strongest same-level spell effect unless its use carries meaningful limits."
      : "Compare against a similar published item and give it an interesting purpose beyond a numerical bonus."
  };
}

function pf2eRelicGuidance(level) {
  const safeLevel = pf2eNumber(level, 1, 1, 20);
  const gifts = PF2E_RELIC_GIFTS.filter(gift => gift.level <= safeLevel);
  const latest = gifts[gifts.length - 1] || PF2E_RELIC_GIFTS[0];
  return {
    level: safeLevel,
    gifts: gifts.length,
    latestType: latest.type,
    treasure: gifts.reduce((sum, gift) => sum + gift.gp, 0),
    next: PF2E_RELIC_GIFTS.find(gift => gift.level > safeLevel) || null
  };
}

function pf2eCreationPreview(data, mode = pf2eCreationMode) {
  const name = pf2eFormValue(data, "name", mode === "monster" ? "Unnamed creature" : mode === "item" ? "Unnamed item" : "Unnamed relic");
  if (mode === "monster") {
    const benchmark = pf2eCreatureBenchmark(pf2eFormValue(data, "level", 1), pf2eFormValue(data, "profile", "brute"));
    const traits = pf2eCommaList(pf2eFormValue(data, "traits", "beast")).map(trait => "<span>" + esc(trait) + "</span>").join("");
    const strike = pf2eFormValue(data, "strikeName", "Primary Strike");
    const strikeTraits = pf2eFormValue(data, "strikeTraits", "physical");
    const abilities = pf2eLineList(pf2eFormValue(data, "abilities")).slice(0, 4);
    return "<div class=\"pf2e-creation-preview-head\"><div><p class=\"eyebrow\">" + esc(benchmark.profile.toUpperCase()) + " ROAD MAP</p><h2>" + esc(name) + "</h2></div><strong>" + benchmark.level + "</strong></div><div class=\"pf2e-stat-traits\">" + traits + "</div><p class=\"pf2e-preview-rule\">" + esc(benchmark.note) + "</p><div class=\"pf2e-creation-stat-grid\"><span><small>Perception</small>" + pf2eFormatModifier(benchmark.perception) + "</span><span><small>AC</small>" + benchmark.ac + "</span><span><small>HP</small>" + benchmark.hp + "<em>" + esc(benchmark.hpRange) + "</em></span><span><small>Fort</small>" + pf2eFormatModifier(benchmark.saves.fortitude) + "</span><span><small>Ref</small>" + pf2eFormatModifier(benchmark.saves.reflex) + "</span><span><small>Will</small>" + pf2eFormatModifier(benchmark.saves.will) + "</span></div><div class=\"pf2e-preview-line\"><small>Speed</small><p>" + benchmark.speed + " feet</p></div><div class=\"pf2e-preview-line\"><small>Strike</small><p><strong>" + esc(strike) + "</strong> " + pf2eFormatModifier(benchmark.attack) + " · " + esc(benchmark.damage) + " " + esc(strikeTraits) + "</p></div>" + (abilities.length ? "<div class=\"pf2e-preview-line\"><small>Abilities</small>" + abilities.map(ability => "<p>" + esc(ability) + "</p>").join("") + "</div>" : "") + "<p class=\"pf2e-preview-foot\">Benchmark values come from GM Core creature-building tables. Review the whole stat block and trade strengths for weaknesses before play.</p>";
  }
  if (mode === "item") {
    const category = pf2eFormValue(data, "category", "Weapon");
    const guide = pf2eItemGuidance(pf2eFormValue(data, "level", 1), category);
    const rarity = pf2eFormValue(data, "rarity", "Common");
    const traits = pf2eCommaList(pf2eFormValue(data, "traits", "magical")).map(trait => "<span>" + esc(trait) + "</span>").join("");
    const activation = pf2eFormValue(data, "activation", "No activation set");
    const frequency = pf2eFormValue(data, "frequency", "—");
    const effect = pf2eFormValue(data, "effect", "Describe what the item does and what makes it worth choosing.");
    return "<div class=\"pf2e-creation-preview-head\"><div><p class=\"eyebrow\">" + esc(rarity.toUpperCase()) + " " + esc(category.toUpperCase()) + "</p><h2>" + esc(name) + "</h2></div><strong>" + guide.level + "</strong></div><div class=\"pf2e-stat-traits\">" + traits + "</div><div class=\"pf2e-item-benchmarks\"><span><small>Typical DC</small>" + guide.dc + "</span><span><small>Price range</small>" + esc(guide.price) + "</span></div><div class=\"pf2e-preview-line\"><small>Activate</small><p>" + esc(activation) + "</p></div><div class=\"pf2e-preview-line\"><small>Frequency</small><p>" + esc(frequency) + "</p></div><div class=\"pf2e-preview-line\"><small>Effect</small><p>" + esc(effect) + "</p></div><p class=\"pf2e-preview-foot\">" + esc(guide.note) + " Price and DC are level benchmarks, not automatic approval.</p>";
  }
  const guide = pf2eRelicGuidance(pf2eFormValue(data, "level", 1));
  const aspectOne = pf2eFormValue(data, "aspectOne", "Air");
  const aspectTwo = pf2eFormValue(data, "aspectTwo", "Life");
  const gifts = pf2eLineList(pf2eFormValue(data, "gifts"));
  const form = pf2eFormValue(data, "form", "A storied object waiting to awaken");
  const next = guide.next ? "Next typical gift: " + guide.next.type.toLowerCase() + " at level " + guide.next.level + "." : "This relic is in grand-gift territory.";
  return "<div class=\"pf2e-creation-preview-head relic\"><div><p class=\"eyebrow\">RELIC SEED · LEVEL " + guide.level + "</p><h2>" + esc(name) + "</h2></div><strong>✦</strong></div><p class=\"pf2e-relic-form\">" + esc(form) + "</p><div class=\"pf2e-relic-aspects\"><span>" + esc(aspectOne) + "</span><i>+</i><span>" + esc(aspectTwo) + "</span></div><div class=\"pf2e-item-benchmarks\"><span><small>Typical gifts</small>" + guide.gifts + "</span><span><small>Treasure replaced</small>" + guide.treasure.toLocaleString() + " gp</span></div><div class=\"pf2e-preview-line\"><small>Gift path</small>" + (gifts.length ? gifts.slice(0, 5).map(gift => "<p>" + esc(gift) + "</p>").join("") : "<p>Add one gift per line as the relic awakens.</p>") + "</div><p class=\"pf2e-preview-foot\">A relic normally matches its bearer's level, uses about two aspects, and gains gifts with story milestones. " + esc(next) + "</p>";
}

function pf2eCreationForm(mode) {
  const creatureLevels = PF2E_CREATURE_LEVELS.map(level => "<option value=\"" + level + "\"" + (level === 1 ? " selected" : "") + ">Level " + level + "</option>").join("");
  const itemLevels = Array.from({ length: 20 }, (_, index) => index + 1).map(level => "<option value=\"" + level + "\"" + (level === 1 ? " selected" : "") + ">Level " + level + "</option>").join("");
  if (mode === "monster") {
    const profiles = Object.entries(PF2E_CREATURE_PROFILES).map(([id, profile]) => "<option value=\"" + esc(id) + "\">" + esc(profile.label) + "</option>").join("");
    return "<form id=\"pf2eCreationForm\" class=\"pf2e-form pf2e-creation-form\"><input type=\"hidden\" name=\"mode\" value=\"monster\" /><div class=\"pf2e-creation-fields two\"><label>Name<input required name=\"name\" maxlength=\"80\" placeholder=\"Ashglass prowler\" /></label><label>Creature level<select name=\"level\">" + creatureLevels + "</select></label><label>Road map<select name=\"profile\">" + profiles + "</select></label><label>Size<select name=\"size\"><option>Tiny</option><option>Small</option><option selected>Medium</option><option>Large</option><option>Huge</option><option>Gargantuan</option></select></label></div><label>Traits<input name=\"traits\" value=\"beast\" placeholder=\"beast, fire, uncommon\" /></label><label>Concept and encounter role<textarea name=\"concept\" rows=\"3\" placeholder=\"What is it, and what should fighting it feel like?\"></textarea></label><div class=\"pf2e-creation-fields two\"><label>Primary Strike<input name=\"strikeName\" placeholder=\"glass talon\" /></label><label>Damage type and traits<input name=\"strikeTraits\" placeholder=\"slashing, agile\" /></label></div><label>Senses, languages, and skills<textarea name=\"details\" rows=\"3\" placeholder=\"darkvision; Aklo; Acrobatics, Stealth\"></textarea></label><label>Special abilities <small>One per line</small><textarea name=\"abilities\" rows=\"5\" placeholder=\"Cinderstep [one-action] — Stride, leaving a haze of sparks.&#10;Shattercry [two-actions] — Creatures in a 15-foot cone attempt a Reflex save.\"></textarea></label><button class=\"primary-button\" type=\"submit\">Save creature <span>→</span></button></form>";
  }
  if (mode === "item") {
    const types = PF2E_ITEM_TYPES.map(type => "<option>" + esc(type) + "</option>").join("");
    return "<form id=\"pf2eCreationForm\" class=\"pf2e-form pf2e-creation-form\"><input type=\"hidden\" name=\"mode\" value=\"item\" /><div class=\"pf2e-creation-fields two\"><label>Name<input required name=\"name\" maxlength=\"80\" placeholder=\"Lantern of the last watch\" /></label><label>Item level<select name=\"level\">" + itemLevels + "</select></label><label>Category<select name=\"category\">" + types + "</select></label><label>Rarity<select name=\"rarity\"><option>Common</option><option>Uncommon</option><option>Rare</option><option>Unique</option></select></label></div><div class=\"pf2e-creation-fields two\"><label>Usage<input name=\"usage\" placeholder=\"held in 1 hand\" /></label><label>Bulk<input name=\"bulk\" placeholder=\"L\" /></label></div><label>Traits<input name=\"traits\" value=\"magical\" placeholder=\"magical, light, invested\" /></label><label>Concept and role<textarea name=\"concept\" rows=\"3\" placeholder=\"What choice does this item create, and why does it exist in the world?\"></textarea></label><div class=\"pf2e-creation-fields two\"><label>Activation<input name=\"activation\" placeholder=\"[one-action] Interact\" /></label><label>Frequency<input name=\"frequency\" placeholder=\"once per day\" /></label></div><label>Effect<textarea required name=\"effect\" rows=\"5\" placeholder=\"Write the complete rules effect, including range, targets, duration, checks, and limits.\"></textarea></label><button class=\"primary-button\" type=\"submit\">Save item <span>→</span></button></form>";
  }
  const aspectOptions = selected => PF2E_RELIC_ASPECTS.map(aspect => "<option" + (aspect === selected ? " selected" : "") + ">" + esc(aspect) + "</option>").join("");
  return "<form id=\"pf2eCreationForm\" class=\"pf2e-form pf2e-creation-form\"><input type=\"hidden\" name=\"mode\" value=\"relic\" /><div class=\"pf2e-creation-fields two\"><label>Name<input required name=\"name\" maxlength=\"80\" placeholder=\"The pilgrim's ember\" /></label><label>Bearer level<select name=\"level\">" + itemLevels + "</select></label><label>Relic form<input required name=\"form\" placeholder=\"A battered brass lantern\" /></label><label>Origin<select name=\"origin\"><option>Background relic</option><option>Campaign relic</option></select></label><label>Tradition<select name=\"tradition\"><option>Arcane</option><option>Divine</option><option>Occult</option><option>Primal</option><option>Unaligned</option></select></label><label>First aspect<select name=\"aspectOne\">" + aspectOptions("Air") + "</select></label><label>Second aspect<select name=\"aspectTwo\">" + aspectOptions("Life") + "</select></label><label>Bearer<input name=\"bearer\" placeholder=\"Character or future owner\" /></label></div><label>History and purpose<textarea name=\"history\" rows=\"4\" placeholder=\"What deed, bond, or unfinished promise gives this relic meaning?\"></textarea></label><label>Current gifts <small>One per line; note tier and aspect</small><textarea name=\"gifts\" rows=\"5\" placeholder=\"Minor · Fire · Flare Bolt&#10;Minor · Life · Healing Wave\"></textarea></label><label>Next awakening milestone<textarea name=\"awakening\" rows=\"3\" placeholder=\"The relic awakens when its bearer carries a stranger safely through the ash storm.\"></textarea></label><button class=\"primary-button\" type=\"submit\">Save relic <span>→</span></button></form>";
}

function pf2eCreationFromForm(data) {
  const mode = pf2eFormValue(data, "mode", "monster");
  const common = {
    id: featureId("pf2e-" + mode),
    type: mode,
    name: pf2eFormValue(data, "name").trim(),
    level: pf2eNumber(data.get("level"), 1, mode === "monster" ? -1 : 1, mode === "monster" ? 24 : 20),
    createdAt: Date.now()
  };
  if (mode === "monster") {
    const profile = pf2eFormValue(data, "profile", "brute");
    return {
      ...common,
      profile,
      size: pf2eFormValue(data, "size", "Medium"),
      traits: pf2eCommaList(data.get("traits")),
      concept: pf2eFormValue(data, "concept"),
      strikeName: pf2eFormValue(data, "strikeName", "Primary Strike"),
      strikeTraits: pf2eFormValue(data, "strikeTraits", "physical"),
      details: pf2eFormValue(data, "details"),
      abilities: pf2eLineList(data.get("abilities")),
      benchmark: pf2eCreatureBenchmark(common.level, profile)
    };
  }
  if (mode === "item") {
    const category = pf2eFormValue(data, "category", "Weapon");
    return {
      ...common,
      category,
      rarity: pf2eFormValue(data, "rarity", "Common"),
      usage: pf2eFormValue(data, "usage"),
      bulk: pf2eFormValue(data, "bulk"),
      traits: pf2eCommaList(data.get("traits")),
      concept: pf2eFormValue(data, "concept"),
      activation: pf2eFormValue(data, "activation"),
      frequency: pf2eFormValue(data, "frequency"),
      effect: pf2eFormValue(data, "effect"),
      guidance: pf2eItemGuidance(common.level, category)
    };
  }
  return {
    ...common,
    form: pf2eFormValue(data, "form"),
    origin: pf2eFormValue(data, "origin", "Background relic"),
    tradition: pf2eFormValue(data, "tradition", "Unaligned"),
    aspectOne: pf2eFormValue(data, "aspectOne", "Air"),
    aspectTwo: pf2eFormValue(data, "aspectTwo", "Life"),
    bearer: pf2eFormValue(data, "bearer"),
    history: pf2eFormValue(data, "history"),
    gifts: pf2eLineList(data.get("gifts")),
    awakening: pf2eFormValue(data, "awakening"),
    guidance: pf2eRelicGuidance(common.level)
  };
}

function pf2eCreationCard(creation) {
  if (creation.type === "monster") {
    const benchmark = creation.benchmark || pf2eCreatureBenchmark(creation.level, creation.profile);
    return "<article class=\"card pf2e-creation-card\"><div class=\"pf2e-stat-card-head\"><div><p class=\"eyebrow\">" + esc((benchmark.profile || "CREATURE").toUpperCase()) + " · LEVEL " + esc(creation.level) + "</p><h3>" + esc(creation.name) + "</h3></div><button class=\"quiet-button\" type=\"button\" data-remove-pf2e-creation=\"" + esc(creation.id) + "\">Remove</button></div><div class=\"pf2e-stat-traits\">" + (creation.traits || []).map(trait => "<span>" + esc(trait) + "</span>").join("") + "</div><div class=\"pf2e-stat-facts\"><span><small>AC</small>" + esc(benchmark.ac) + "</span><span><small>HP</small>" + esc(benchmark.hp) + "</span><span><small>Attack</small>" + pf2eFormatModifier(benchmark.attack) + "</span><span><small>Damage</small>" + esc(benchmark.damage) + "</span></div><p>" + esc(creation.concept || benchmark.note) + "</p><div class=\"pf2e-stat-actions\"><button class=\"primary-button\" type=\"button\" data-add-creation-monster=\"" + esc(creation.id) + "\">Add to encounter <span>→</span></button></div></article>";
  }
  if (creation.type === "item") {
    const guide = creation.guidance || pf2eItemGuidance(creation.level, creation.category);
    return "<article class=\"card pf2e-creation-card\"><div class=\"pf2e-stat-card-head\"><div><p class=\"eyebrow\">" + esc((creation.rarity || "Common").toUpperCase()) + " " + esc((creation.category || "ITEM").toUpperCase()) + " · LEVEL " + esc(creation.level) + "</p><h3>" + esc(creation.name) + "</h3></div><button class=\"quiet-button\" type=\"button\" data-remove-pf2e-creation=\"" + esc(creation.id) + "\">Remove</button></div><div class=\"pf2e-stat-traits\">" + (creation.traits || []).map(trait => "<span>" + esc(trait) + "</span>").join("") + "</div><div class=\"pf2e-stat-facts\"><span><small>DC</small>" + esc(guide.dc) + "</span><span><small>Price</small>" + esc(guide.price) + "</span></div><p>" + esc(creation.effect || creation.concept || "No effect recorded.") + "</p></article>";
  }
  const guide = creation.guidance || pf2eRelicGuidance(creation.level);
  return "<article class=\"card pf2e-creation-card relic\"><div class=\"pf2e-stat-card-head\"><div><p class=\"eyebrow\">RELIC · LEVEL " + esc(creation.level) + "</p><h3>" + esc(creation.name) + "</h3></div><button class=\"quiet-button\" type=\"button\" data-remove-pf2e-creation=\"" + esc(creation.id) + "\">Remove</button></div><p class=\"pf2e-relic-card-form\">" + esc(creation.form || "Relic seed") + "</p><div class=\"pf2e-relic-aspects\"><span>" + esc(creation.aspectOne) + "</span><i>+</i><span>" + esc(creation.aspectTwo) + "</span></div><div class=\"pf2e-stat-facts\"><span><small>Gifts</small>" + esc((creation.gifts || []).length) + " / " + guide.gifts + "</span><span><small>Treasure</small>" + guide.treasure.toLocaleString() + " gp</span></div><p>" + esc(creation.history || creation.awakening || "Its story is still waiting to be discovered.") + "</p></article>";
}

function renderPf2eCreationPreview(form) {
  const preview = document.querySelector("#pf2eCreationPreview");
  if (!preview || !form) return;
  const data = new FormData(form);
  preview.innerHTML = pf2eCreationPreview(data, pf2eFormValue(data, "mode", pf2eCreationMode));
}

function pf2eCreationBuilder(campaign) {
  const creations = pf2eData(campaign).creations || [];
  const tabs = [["monster", "Creature"], ["item", "Magic item"], ["relic", "Relic"]].map(([id, label]) => "<button class=\"pf2e-creation-tab " + (id === pf2eCreationMode ? "active" : "") + "\" type=\"button\" data-pf2e-creation-mode=\"" + id + "\" aria-pressed=\"" + (id === pf2eCreationMode) + "\">" + label + "</button>").join("");
  const copy = pf2eCreationMode === "monster"
    ? "Choose a creature road map and level to get a complete top-down benchmark. Then author the fiction, Strike, and abilities that make it memorable."
    : pf2eCreationMode === "item"
      ? "Draft a complete item entry with a level-appropriate DC and price band visible while you work."
      : "Shape a relic seed, pair two aspects, and pace its gifts against the bearer's level and campaign treasure.";
  const library = creations.length ? "<div class=\"pf2e-creation-library-grid\">" + creations.map(pf2eCreationCard).join("") + "</div>" : "<div class=\"empty-state\"><h2>The forge is quiet.</h2><p>Saved creatures, items, and relics will stay with this campaign and appear here.</p></div>";
  return "<section class=\"pf2e-creation-layout\"><article class=\"card pf2e-creation-editor\"><div class=\"section-title\"><div><p class=\"eyebrow\">PF2E CREATION FORGE</p><h2>Build from the rules outward</h2></div><span class=\"tag\">GM Core guidance</span></div><div class=\"pf2e-creation-tabs\">" + tabs + "</div><p class=\"pf2e-intro\">" + esc(copy) + "</p>" + pf2eCreationForm(pf2eCreationMode) + "</article><aside id=\"pf2eCreationPreview\" class=\"card pf2e-creation-preview\" aria-live=\"polite\">" + pf2eCreationPreview(null, pf2eCreationMode) + "</aside></section><section class=\"card pf2e-creation-rules\"><div><p class=\"eyebrow\">DESIGN CHECK</p><h2>Benchmarks are a beginning.</h2><p>Creature statistics use a road map, but the final pass should trade strengths for weaknesses and respect the three-action economy. Item effects should be compared with published peers. Relics replace part of the party's normal treasure and awaken through story.</p></div><div class=\"pf2e-rule-links\"><a href=\"https://2e.aonprd.com/Rules.aspx?ID=994\" target=\"_blank\" rel=\"noreferrer\">GM Core building rules ↗</a><a href=\"https://2e.aonprd.com/Rules.aspx?ID=3135\" target=\"_blank\" rel=\"noreferrer\">Relic rules and gifts ↗</a></div></section><section class=\"pf2e-saved-section\"><div class=\"section-title\"><h2>Creation library</h2><span class=\"tag\">" + creations.length + " saved</span></div>" + library + "</section>";
}

function pf2eSavedEncounterCard(encounter) {
  const summary = pf2eEncounterSummary(encounter);
  return "<article class=\"card pf2e-saved-card\"><div><p class=\"eyebrow\">" + esc(summary.difficulty.label) + " · LEVEL " + summary.partyLevel + "</p><h3>" + esc(encounter.title || "Untitled encounter") + "</h3><p>" + encounter.creatures.length + " creature" + (encounter.creatures.length === 1 ? "" : "s") + " · " + summary.total + " / " + summary.budget + " XP</p></div><div class=\"pf2e-saved-meta\"><span>" + esc(summary.status) + "</span><span>" + esc(summary.measured) + " threat</span></div><button class=\"quiet-button\" type=\"button\" data-load-pf2e-encounter=\"" + esc(encounter.id) + "\">Edit</button><button class=\"quiet-button\" type=\"button\" data-remove-pf2e-encounter=\"" + esc(encounter.id) + "\">Remove</button></article>";
}

function pf2eStatBlockFacts(block) {
  const saves = block.saves || {};
  const facts = [
    ["Level", block.level],
    ["AC", block.ac],
    ["HP", block.hp],
    ["Perception", block.perception],
    ["Fort", saves.fortitude],
    ["Ref", saves.reflex],
    ["Will", saves.will]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return facts.length ? "<div class=\"pf2e-stat-facts\">" + facts.map(([label, value]) => "<span><small>" + esc(label) + "</small>" + esc(value) + "</span>").join("") + "</div>" : "";
}

function pf2eStatBlockCard(block, mode = "result") {
  const state = pf2eStatState();
  const path = block.sourceId || "";
  const pending = state.pendingPath === path || state.pendingPath === block.id;
  const traits = (block.traits || []).slice(0, 6).map(trait => "<span>" + esc(trait) + "</span>").join("");
  const attacks = (block.attacks || []).length ? "<div class=\"pf2e-stat-lines\"><small>Strikes</small>" + block.attacks.map(item => "<p><strong>" + esc(item.name) + "</strong>" + (item.detail ? " · " + esc(item.detail) : "") + "</p>").join("") + "</div>" : "";
  const abilities = (block.abilities || []).length ? "<div class=\"pf2e-stat-lines\"><small>Abilities</small>" + block.abilities.slice(0, 3).map(item => "<p><strong>" + esc(item.name) + "</strong>" + (item.detail ? " — " + esc(item.detail) : "") + "</p>").join("") + "</div>" : "";
  const saveButton = mode === "result" ? "<button class=\"secondary-button\" type=\"button\" data-save-public-stat=\"" + esc(path) + "\" " + (pending ? "disabled" : "") + ">" + (pending ? "Saving…" : "Save locally") + "</button>" : "";
  const addButton = mode === "saved" ? "<button class=\"primary-button\" type=\"button\" data-add-saved-stat=\"" + esc(block.id) + "\">Add to encounter <span>→</span></button>" : "<button class=\"primary-button\" type=\"button\" data-add-public-stat=\"" + esc(path) + "\" " + (pending ? "disabled" : "") + ">" + (pending ? "Adding…" : "Add to encounter <span>→</span>") + "</button>";
  const removeButton = mode === "saved" ? "<button class=\"quiet-button\" type=\"button\" data-remove-saved-stat=\"" + esc(block.id) + "\">Remove</button>" : "";
  return "<article class=\"card pf2e-stat-card\"><div class=\"pf2e-stat-card-head\"><div><p class=\"eyebrow\">" + esc(block.sourcePack || "PUBLIC STAT BLOCK") + "</p><h3>" + esc(block.name || "Unnamed creature") + "</h3></div>" + removeButton + "</div><div class=\"pf2e-stat-traits\">" + (traits || "<span>No traits previewed</span>") + "</div>" + pf2eStatBlockFacts(block) + (block.summary ? "<p class=\"pf2e-stat-summary\">" + esc(block.summary) + "</p>" : "") + attacks + abilities + "<div class=\"pf2e-stat-actions\">" + addButton + saveButton + (block.sourceUrl ? "<a class=\"secondary-button\" href=\"" + esc(block.sourceUrl) + "\" target=\"_blank\" rel=\"noreferrer\">Open source ↗</a>" : "") + "</div></article>";
}

function pf2ePublicResultCard(entry) {
  const state = pf2eStatState();
  const block = state.details[entry.path];
  if (block) return pf2eStatBlockCard(block, "result");
  const pending = state.pendingPath === entry.path;
  return "<article class=\"card pf2e-stat-card loading\"><div class=\"pf2e-stat-card-head\"><div><p class=\"eyebrow\">" + esc(entry.packLabel) + "</p><h3>" + esc(entry.name) + "</h3></div></div><p class=\"pf2e-stat-summary\">Public result found. Fetch the stat block to import level, defenses, traits, and source metadata.</p><div class=\"pf2e-stat-actions\"><button class=\"primary-button\" type=\"button\" data-add-public-stat=\"" + esc(entry.path) + "\" " + (pending ? "disabled" : "") + ">" + (pending ? "Adding…" : "Add to encounter <span>→</span>") + "</button><button class=\"secondary-button\" type=\"button\" data-save-public-stat=\"" + esc(entry.path) + "\" " + (pending ? "disabled" : "") + ">Save locally</button><a class=\"secondary-button\" href=\"" + esc(entry.sourceUrl) + "\" target=\"_blank\" rel=\"noreferrer\">Open source ↗</a></div></article>";
}

function pf2eStatBlockSearch(campaign) {
  const state = pf2eStatState();
  const saved = pf2eData(campaign).statBlocks || [];
  const levelOptions = "<option value=\"any\">Any level</option>" + Array.from({ length: 27 }, (_, index) => index - 1).map(level => "<option value=\"" + level + "\"" + (String(level) === state.level ? " selected" : "") + ">Level " + level + "</option>").join("");
  const sourceOptions = PF2E_PUBLIC_SOURCE_FILTERS.map(filter => "<option value=\"" + esc(filter.id) + "\"" + (filter.id === state.source ? " selected" : "") + ">" + esc(filter.label) + "</option>").join("");
  const sourceNote = PF2E_PUBLIC_SOURCE_FILTERS.find(filter => filter.id === state.source)?.note || PF2E_PUBLIC_SOURCE_FILTERS[0].note;
  const status = state.status === "loading" ? "Loading the public index…" : state.status === "searching" ? "Searching public stat blocks…" : state.status === "error" ? state.error : state.results.length ? state.results.length + " result" + (state.results.length === 1 ? "" : "s") + " ready" : "Search a creature name to begin.";
  const results = state.results.length
    ? "<div class=\"pf2e-stat-results\">" + state.results.map(pf2ePublicResultCard).join("") + "</div>"
    : "<div class=\"empty-state\"><h2>No public results shown yet.</h2><p>Search by creature name, then add a result directly to the encounter builder or save it to this campaign's stat-block shelf.</p></div>";
  const warning = state.truncated ? "<p class=\"pf2e-stat-warning\">GitHub returned a partial public index. If something is missing, narrow the search or open the source repository directly.</p>" : "";
  const library = saved.length ? "<div class=\"pf2e-stat-library-list\">" + saved.map(block => pf2eStatBlockCard(block, "saved")).join("") + "</div>" : "<div class=\"pf2e-empty-list\">Saved public stat blocks will appear here for quick encounter reuse.</div>";
  return "<section class=\"pf2e-stat-layout\"><article class=\"card pf2e-stat-search-card\"><div class=\"section-title\"><div><p class=\"eyebrow\">PUBLIC STAT BLOCKS</p><h2>Search and add creatures</h2></div><span class=\"tag\">Runtime lookup</span></div><p class=\"pf2e-intro\">Searches public PF2e compendium JSON when you ask for it. Imported entries keep a source link and can be dropped straight into the encounter budget.</p><form id=\"pf2ePublicStatSearchForm\" class=\"pf2e-stat-search-form\"><label>Creature search<input name=\"query\" maxlength=\"80\" value=\"" + esc(state.query) + "\" placeholder=\"goblin, drake, vampire…\" /></label><label>Level filter<select name=\"level\">" + levelOptions + "</select></label><label>Source range<select name=\"source\">" + sourceOptions + "</select></label><button class=\"primary-button\" type=\"submit\">Search public source <span>⌕</span></button></form><p class=\"pf2e-stat-source-note\">" + esc(sourceNote) + " · Source: <a href=\"" + esc(PF2E_PUBLIC_STAT_SOURCE.repoUrl) + "\" target=\"_blank\" rel=\"noreferrer\">PF2e public compendium repo</a></p><div class=\"pf2e-stat-status " + (state.status === "error" ? "error" : "") + "\">" + esc(status) + "</div>" + warning + results + "</article><aside class=\"card pf2e-stat-library\"><div class=\"section-title\"><div><p class=\"eyebrow\">LOCAL SHELF</p><h2>Saved stat blocks</h2></div><span class=\"tag\">" + saved.length + " saved</span></div><p>Keep frequently used creatures here. They remain local to this campaign unless you remove them.</p>" + library + "</aside></section>";
}

function pf2eToolkitView(campaign) {
  if (!hasPf2eEnabled(campaign)) return header("PF2e tools", "SYSTEM-SPECIFIC PREP", "These tools are ready when Pathfinder 2e is enabled for this campaign.", "<button class=\"primary-button\" type=\"button\" data-view-jump=\"systems\">Enable Pathfinder 2e <span>→</span></button>") + "<section class=\"empty-state\"><h2>Pathfinder 2e is not active here.</h2><p>Enable it in Game systems to use encounter XP budgeting and treasure-by-level planning without changing your campaign's other tools.</p></section>";
  const encounters = pf2eData(campaign).encounters || [];
  const tabs = [["encounters", "Encounter builder"], ["create", "Creature & item forge"], ["statblocks", "Stat blocks"], ["treasure", "Treasure tables"]].map(([id, label]) => "<button class=\"pf2e-tab " + (id === pf2eTab ? "active" : "") + "\" type=\"button\" data-pf2e-tab=\"" + id + "\" aria-pressed=\"" + (id === pf2eTab) + "\">" + label + "</button>").join("");
  const content = pf2eTab === "treasure"
    ? pf2eTreasureTables(campaign)
    : pf2eTab === "create"
      ? pf2eCreationBuilder(campaign)
    : pf2eTab === "statblocks"
      ? pf2eStatBlockSearch(campaign)
      : pf2eEncounterBuilder(campaign) + "<section class=\"pf2e-saved-section\"><div class=\"section-title\"><h2>Saved encounters</h2><span class=\"tag\">" + encounters.length + " saved</span></div>" + (encounters.length ? "<div class=\"pf2e-saved-grid\">" + encounters.map(pf2eSavedEncounterCard).join("") + "</div>" : "<div class=\"empty-state\"><h2>No encounters saved yet.</h2><p>Build a scene, then save it with the creature roster and XP budget intact.</p></div>") + "</section>";
  return header("PF2e tools", "TACTICAL PREP", "Build creatures, magic items, and relics alongside encounter budgets, public stat blocks, and treasure planning for Pathfinder Second Edition.") + "<div class=\"pf2e-tabs\">" + tabs + "</div>" + content;
}

root.addEventListener("click", event => {
  const pf2eTabButton = event.target.closest("[data-pf2e-tab]");
  if (pf2eTabButton) {
    pf2eTab = pf2eTabButton.dataset.pf2eTab;
    render();
    return;
  }
  const creationMode = event.target.closest("[data-pf2e-creation-mode]");
  if (creationMode) {
    pf2eCreationMode = creationMode.dataset.pf2eCreationMode;
    render();
    return;
  }
  const removeCreation = event.target.closest("[data-remove-pf2e-creation]");
  if (removeCreation) {
    pf2eData().creations = pf2eData().creations.filter(item => item.id !== removeCreation.dataset.removePf2eCreation);
    saveState();
    render();
    showToast("Creation removed from this campaign.");
    return;
  }
  const addCreationMonster = event.target.closest("[data-add-creation-monster]");
  if (addCreationMonster) {
    const creation = pf2eData().creations.find(item => item.id === addCreationMonster.dataset.addCreationMonster && item.type === "monster");
    if (!creation) return;
    const benchmark = creation.benchmark || pf2eCreatureBenchmark(creation.level, creation.profile);
    pf2eDraft().creatures.push({
      name: creation.name,
      level: creation.level,
      adjustment: "standard",
      source: "PF2e creation forge",
      sourceId: creation.id,
      sourcePack: benchmark.profile,
      traits: creation.traits || [],
      ac: benchmark.ac,
      hp: benchmark.hp
    });
    pf2eTab = "encounters";
    render();
    showToast(creation.name + " added to the encounter.");
    return;
  }
  const addPublicStat = event.target.closest("[data-add-public-stat]");
  if (addPublicStat) {
    pf2eAddPublicStatToEncounter(addPublicStat.dataset.addPublicStat);
    return;
  }
  const savePublicStat = event.target.closest("[data-save-public-stat]");
  if (savePublicStat) {
    pf2eSavePublicStatBlock(savePublicStat.dataset.savePublicStat);
    return;
  }
  const addSavedStat = event.target.closest("[data-add-saved-stat]");
  if (addSavedStat) {
    pf2eAddSavedStatToEncounter(addSavedStat.dataset.addSavedStat);
    return;
  }
  const removeSavedStat = event.target.closest("[data-remove-saved-stat]");
  if (removeSavedStat) {
    pf2eData().statBlocks = pf2eData().statBlocks.filter(item => item.id !== removeSavedStat.dataset.removeSavedStat);
    saveState();
    render();
    showToast("Stat block removed from this campaign.");
    return;
  }
  if (event.target.closest("[data-add-pf2e-creature]")) {
    const form = event.target.closest("#pf2eEncounterForm");
    if (!form) return;
    const data = new FormData(form);
    const name = String(data.get("creatureName") || "").trim();
    if (!name) {
      showToast("Give the creature a name before adding it to the encounter.");
      return;
    }
    const draft = pf2eDraft();
    draft.title = String(data.get("title") || "").trim();
    draft.partyLevel = pf2eNumber(data.get("partyLevel"), draft.partyLevel, 1, 20);
    draft.partySize = pf2eNumber(data.get("partySize"), draft.partySize, 1, 10);
    draft.difficulty = String(data.get("difficulty") || draft.difficulty);
    draft.creatures.push({
      name,
      level: pf2eNumber(data.get("creatureLevel"), draft.partyLevel, -1, 25),
      adjustment: String(data.get("creatureAdjustment") || "standard")
    });
    render();
    return;
  }
  const removePf2eCreature = event.target.closest("[data-remove-pf2e-creature]");
  if (removePf2eCreature) {
    pf2eDraft().creatures.splice(Number(removePf2eCreature.dataset.removePf2eCreature), 1);
    render();
    return;
  }
  if (event.target.closest("[data-reset-pf2e-encounter]")) {
    pf2eEncounterDraft = pf2eDefaultEncounter();
    render();
    return;
  }
  const loadPf2eEncounter = event.target.closest("[data-load-pf2e-encounter]");
  if (loadPf2eEncounter) {
    const encounter = pf2eData().encounters.find(item => item.id === loadPf2eEncounter.dataset.loadPf2eEncounter);
    if (!encounter) return;
    pf2eEncounterDraft = structuredClone(encounter);
    delete pf2eEncounterDraft.id;
    delete pf2eEncounterDraft.createdAt;
    pf2eTab = "encounters";
    render();
    showToast("Encounter loaded into the builder.");
    return;
  }
  const removePf2eEncounter = event.target.closest("[data-remove-pf2e-encounter]");
  if (removePf2eEncounter) {
    pf2eData().encounters = pf2eData().encounters.filter(item => item.id !== removePf2eEncounter.dataset.removePf2eEncounter);
    saveState();
    render();
    showToast("Encounter removed from local prep.");
    return;
  }
  if (event.target.closest("[data-roll-pf2e-treasure]")) {
    pf2eTreasureRoll = PF2E_TREASURE_THEMES[Math.floor(Math.random() * PF2E_TREASURE_THEMES.length)];
    render();
    return;
  }
  const removePf2eTreasure = event.target.closest("[data-remove-pf2e-treasure]");
  if (removePf2eTreasure) {
    pf2eData().treasurePlans = pf2eData().treasurePlans.filter(item => item.id !== removePf2eTreasure.dataset.removePf2eTreasure);
    saveState();
    render();
    showToast("Treasure plan removed from local prep.");
    return;
  }
});

root.addEventListener("input", event => {
  const form = event.target.closest("#pf2eCreationForm");
  if (form) renderPf2eCreationPreview(form);
});

root.addEventListener("change", event => {
  const creationForm = event.target.closest("#pf2eCreationForm");
  if (creationForm) {
    renderPf2eCreationPreview(creationForm);
    return;
  }
  const encounterSetting = event.target.closest("#pf2eEncounterForm [name='partyLevel'], #pf2eEncounterForm [name='partySize'], #pf2eEncounterForm [name='difficulty']");
  if (encounterSetting) {
    const form = encounterSetting.closest("#pf2eEncounterForm");
    const data = new FormData(form);
    const draft = pf2eDraft();
    draft.title = String(data.get("title") || "").trim();
    draft.partyLevel = pf2eNumber(data.get("partyLevel"), draft.partyLevel, 1, 20);
    draft.partySize = pf2eNumber(data.get("partySize"), draft.partySize, 1, 10);
    draft.difficulty = String(data.get("difficulty") || draft.difficulty);
    render();
    return;
  }
  const treasureLevel = event.target.closest("#pf2eTreasureForm [name='level']");
  if (treasureLevel) {
    pf2eDraft().partyLevel = pf2eNumber(treasureLevel.value, pf2eDraft().partyLevel, 1, 20);
    render();
    return;
  }
});

root.addEventListener("submit", event => {
  if (event.target.matches("#pf2eCreationForm")) {
    event.preventDefault();
    const data = new FormData(event.target);
    const creation = pf2eCreationFromForm(data);
    if (!creation.name) {
      showToast("Name this creation before saving it.");
      return;
    }
    if (creation.type === "relic" && creation.aspectOne === creation.aspectTwo) {
      showToast("Choose two different aspects so the relic has room to grow.");
      return;
    }
    pf2eData().creations.unshift(creation);
    saveState();
    render();
    showToast(creation.name + " saved to the PF2e creation library.");
    return;
  }
  if (event.target.matches("#pf2ePublicStatSearchForm")) {
    event.preventDefault();
    pf2eRunPublicStatSearch(event.target);
    return;
  }
  if (event.target.matches("#pf2eEncounterForm")) {
    event.preventDefault();
    const data = new FormData(event.target);
    const draft = pf2eDraft();
    draft.title = String(data.get("title") || "").trim();
    draft.partyLevel = pf2eNumber(data.get("partyLevel"), draft.partyLevel, 1, 20);
    draft.partySize = pf2eNumber(data.get("partySize"), draft.partySize, 1, 10);
    draft.difficulty = String(data.get("difficulty") || draft.difficulty);
    if (!draft.title) {
      showToast("Name the encounter before saving it.");
      return;
    }
    if (!draft.creatures.length) {
      showToast("Add at least one creature before saving the encounter.");
      return;
    }
    pf2eData().encounters.unshift({ id: featureId("pf2e-encounter"), createdAt: Date.now(), ...structuredClone(draft) });
    saveState();
    pf2eEncounterDraft = pf2eDefaultEncounter();
    render();
    showToast(draft.title + " saved to Pathfinder prep.");
    return;
  }
  if (event.target.matches("#pf2eTreasureForm")) {
    event.preventDefault();
    const data = new FormData(event.target);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const level = pf2eNumber(data.get("level"), pf2eDraft().partyLevel, 1, 20);
    const partySize = pf2eNumber(pf2eDraft().partySize, Math.max(1, Number(activeCampaign().players) || 4), 1, 10);
    pf2eData().treasurePlans.unshift({
      id: featureId("pf2e-treasure"),
      title,
      level,
      partySize,
      currency: PF2E_TREASURE_CURRENCY[level],
      hook: pf2eTreasureRoll || "Choose item parcels that reveal something about the scene.",
      createdAt: Date.now()
    });
    saveState();
    pf2eTreasureRoll = null;
    render();
    showToast(title + " saved to Pathfinder prep.");
    return;
  }
});
