function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatDate(value) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
}

function normalizedStatus(value) {
  const status = String(value || "").trim().toLocaleLowerCase();
  const statuses = {
    planned: "Planned",
    "in-progress": "Active",
    active: "Active",
    blocked: "Blocked",
    failed: "Failed",
    done: "Done",
    complete: "Done",
    completed: "Done",
    "n/a": "Unclassified"
  };
  return statuses[status] || firstText(value, "Unclassified");
}

function entryTitle(collection, item) {
  if (collection === "characters") return firstText(item.character_name, item.name, item.title);
  if (collection === "quests") return firstText(item.quest_name, item.title, item.name);
  return firstText(item.title, item.name, item.journal_name);
}

function mapSessions(rows) {
  const chronological = [...asArray(rows)].sort((left, right) => {
    return new Date(left.session_date || left.date || left.created_at || 0) - new Date(right.session_date || right.date || right.created_at || 0);
  });
  return chronological.map((item, index) => ({
    archivistId: String(item.id || ""),
    number: item.number ?? item.index ?? index + 1,
    date: formatDate(item.session_date || item.date || item.created_at),
    title: entryTitle("sessions", item) || `Session ${item.number ?? item.index ?? index + 1}`,
    recap: firstText(item.summary, item.notes, "No session recap was returned by Archivist."),
    tags: unique([item.type]),
    upcoming: false,
    source: "archivist"
  })).reverse();
}

function mapCharacters(rows) {
  return asArray(rows).map(item => ({
    archivistId: String(item.id || ""),
    name: entryTitle("characters", item) || "Unnamed character",
    role: unique([item.type, item.player_name || item.player_handle]).join(" / ") || "Character",
    description: firstText(item.description, item.backstory, "No character description was returned by Archivist."),
    tags: unique([item.type, ...asArray(item.character_aliases), ...asArray(item.aliases)]),
    source: "archivist"
  }));
}

function mapQuests(rows) {
  return asArray(rows).map(item => ({
    archivistId: String(item.id || ""),
    title: entryTitle("quests", item) || "Untitled quest",
    status: normalizedStatus(item.status),
    detail: firstText(item.next_action, item.resolution, item.description, "No next action was returned by Archivist."),
    tags: unique([item.quest_category, item.quest_giver]),
    source: "archivist"
  }));
}

function mapWorld(rows, kind) {
  return asArray(rows).map(item => ({
    archivistId: String(item.id || ""),
    title: entryTitle(kind, item) || `Unnamed ${kind}`,
    detail: firstText(item.description, item.summary, `No ${kind} description was returned by Archivist.`),
    tags: unique([kind, item.type]),
    source: "archivist"
  }));
}

function journalPermission(item) {
  if (item.public === true) return "Player safe";
  const permission = firstText(item.effective_permission, item.permission);
  if (!permission) return "GM only";
  return /public|player|read/i.test(permission) ? "Player safe" : permission;
}

function mapJournals(rows) {
  return asArray(rows).map(item => ({
    archivistId: String(item.id || ""),
    title: entryTitle("journals", item) || "Untitled journal",
    body: firstText(item.content, item.body, item.summary, item.description, "Archivist did not return journal content."),
    permission: journalPermission(item),
    tags: unique(asArray(item.tags)),
    source: "archivist"
  }));
}

function detailMap(rows, collection, extra = {}) {
  return Object.fromEntries(asArray(rows).map(item => {
    const title = entryTitle(collection, item) || `Archivist record ${item.id || "unknown"}`;
    if (collection === "characters") {
      return [title, {
        ...item,
        id: item.id,
        description: firstText(item.description, item.backstory),
        backstory: firstText(item.backstory),
        aliases: unique([...asArray(item.character_aliases), ...asArray(item.aliases)]),
        playerName: firstText(item.player_name),
        playerHandle: firstText(item.player_handle)
      }];
    }
    if (collection === "quests") {
      return [title, {
        ...item,
        id: item.id,
        description: firstText(item.description, item.next_action, item.resolution),
        nextAction: firstText(item.next_action),
        resolution: firstText(item.resolution)
      }];
    }
    if (collection === "journals") {
      return [title, {
        ...item,
        id: item.id,
        content: firstText(item.content, item.body, item.summary, item.description),
        tags: unique(asArray(item.tags))
      }];
    }
    if (collection === "sessions") {
      return [title, {
        ...item,
        id: item.id,
        summary: firstText(item.summary),
        notes: firstText(item.notes)
      }];
    }
    return [title, {
      ...item,
      ...extra,
      id: item.id,
      description: firstText(item.description, item.summary),
      aliases: unique(asArray(item.aliases))
    }];
  }));
}

function entityIndex(bundle) {
  const entries = new Map();
  const add = (rows, type, collection) => {
    for (const item of asArray(rows)) {
      if (!item.id) continue;
      const name = entryTitle(collection, item);
      if (name) entries.set(String(item.id), { type, name });
    }
  };
  add(bundle.characters, "character", "characters");
  add(bundle.sessions, "session", "sessions");
  add(bundle.quests, "quest", "quests");
  add(bundle.locations, "location", "locations");
  add(bundle.factions, "location", "factions");
  add(bundle.items, "location", "items");
  add(bundle.journals, "journal", "journals");
  return entries;
}

function mapConnections(bundle) {
  const entries = entityIndex(bundle);
  return asArray(bundle.links).flatMap(item => {
    const from = entries.get(String(item.from_id || ""));
    const to = entries.get(String(item.to_id || ""));
    if (!from || !to || (from.type === to.type && from.name === to.name)) return [];
    return [{
      id: `archivist-${item.id || `${item.from_id}-${item.to_id}`}`,
      archivistId: String(item.id || ""),
      from,
      to,
      type: "Is tied to",
      note: firstText(item.alias),
      source: "archivist"
    }];
  });
}

function mapCampaignBundle(bundle) {
  const raw = bundle.campaign || {};
  const sessions = mapSessions(bundle.sessions);
  const characters = mapCharacters(bundle.characters);
  const quests = mapQuests(bundle.quests);
  const locations = [
    ...mapWorld(bundle.locations, "location"),
    ...mapWorld(bundle.factions, "faction"),
    ...mapWorld(bundle.items, "item")
  ];
  const journal = mapJournals(bundle.journals);
  const latest = sessions[0];
  const campaign = {
    id: String(raw.id || ""),
    archivistId: String(raw.id || ""),
    title: firstText(raw.title, "Untitled Archivist campaign"),
    system: firstText(raw.system, "Custom / Other"),
    genre: "Archivist campaign",
    players: characters.filter(item => /^pc(?:\s|$)/i.test(item.role)).length,
    summary: firstText(raw.summary, raw.description, "No campaign summary was returned by Archivist."),
    image: firstText(raw.image),
    source: "Archivist Nexus",
    nextSession: latest ? {
      number: latest.number,
      date: latest.date,
      title: latest.title,
      prep: "Latest session imported from Archivist Nexus",
      isScheduled: false
    } : {
      number: "-",
      date: "No session date",
      title: "No recorded session",
      prep: "No sessions have been imported yet",
      isScheduled: false
    },
    sessions,
    characters,
    quests,
    locations,
    journal,
    connections: mapConnections(bundle)
  };
  const details = {
    campaign: raw,
    sessions: detailMap(bundle.sessions, "sessions"),
    characters: detailMap(bundle.characters, "characters"),
    quests: detailMap(bundle.quests, "quests"),
    world: {
      location: detailMap(bundle.locations, "locations", { kind: "location" }),
      faction: detailMap(bundle.factions, "factions", { kind: "faction" }),
      item: detailMap(bundle.items, "items", { kind: "item" })
    },
    journals: detailMap(bundle.journals, "journals")
  };
  return { campaign, details };
}

function buildCampaignEnginePayload(bundles, importedAt = new Date().toISOString()) {
  const mapped = asArray(bundles).map(mapCampaignBundle).filter(item => item.campaign.id);
  const campaigns = mapped.map(item => item.campaign);
  return {
    schemaVersion: 1,
    importedAt,
    state: {
      source: "archivist",
      activeCampaignId: campaigns[0]?.id || null,
      campaigns
    },
    archivist: {
      importedAt,
      campaigns: Object.fromEntries(mapped.map(item => [item.campaign.id, item.details]))
    }
  };
}

module.exports = {
  buildCampaignEnginePayload,
  formatDate,
  mapCampaignBundle,
  normalizedStatus
};
