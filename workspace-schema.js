(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CampaignWorkspaceSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const WORKSPACE_SCHEMA_VERSION = 1;
  const SESSION_WORKFLOW_SCHEMA_VERSION = 3;
  const UNSUPPORTED_SCHEMA = "UNSUPPORTED_WORKSPACE_SCHEMA";
  const object = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const collections = ["sessions", "characters", "quests", "locations", "journal", "arcs", "connections", "documents", "builders", "checklist", "systems"];
  function invalid(label, expected) { const error = new Error(`This file does not contain a valid Campaign Engine workspace. ${label} must be ${expected}. The workspace has not been replaced.`); error.code = "INVALID_WORKSPACE_DATA"; throw error; }
  function records(value, label) {
    if (!Array.isArray(value) || value.some(row => !object(row))) invalid(label, "a list of records");
    value.forEach((row, index) => {
      for (const field of ["name", "title", "role", "description", "detail", "body", "recap", "text", "label", "permission"]) if (row[field] != null && typeof row[field] !== "string") invalid(`${label} ${index + 1} ${field}`, "text");
      if (row.tags != null && (!Array.isArray(row.tags) || row.tags.some(tag => typeof tag !== "string"))) invalid(`${label} ${index + 1} tags`, "a list of text labels");
    });
  }
  function version(value, maximum, label) {
    if (value == null) return;
    if (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > maximum) {
      const error = new Error(`${label} uses an unsupported schema version (${String(value)}). ${Number(value) > maximum ? "It requires a newer Campaign Engine version." : "Use a compatible Campaign Engine version."} This app supports ${label.toLowerCase()} schema ${maximum}.`);
      error.code = UNSUPPORTED_SCHEMA;
      throw error;
    }
  }
  function assertWorkflowVersion(workflow) {
    if (object(workflow)) version(workflow.schemaVersion, SESSION_WORKFLOW_SCHEMA_VERSION, "Session workflow");
  }
  function needsWorkflowBackup(previousState, nextState) {
    const next = new Map((nextState?.campaigns || []).map(campaign => [campaign.id, campaign.sessionWorkflow]));
    return (previousState?.campaigns || []).some(campaign => {
      const previous = campaign.sessionWorkflow || campaign.sessionDeskState || campaign.reconciliationState;
      return object(previous) && Number(previous.schemaVersion ?? 0) < SESSION_WORKFLOW_SCHEMA_VERSION
        && Number(next.get(campaign.id)?.schemaVersion) === SESSION_WORKFLOW_SCHEMA_VERSION;
    });
  }
  function assertState(state) {
    if (!object(state) || !Array.isArray(state.campaigns)) invalid("This workspace", "an object with a campaigns list");
    const ids = new Set();
    state.campaigns.forEach((campaign, index) => {
      const label = `Campaign ${index + 1}`;
      if (!object(campaign)) invalid(label, "a campaign record");
      if (typeof campaign.id !== "string" || !campaign.id.trim()) invalid(`${label} identity`, "a non-empty string");
      if (ids.has(campaign.id)) invalid(`${label} identity`, "unique within the workspace");
      ids.add(campaign.id);
      for (const field of ["title", "system", "genre", "summary"]) if (campaign[field] != null && typeof campaign[field] !== "string") invalid(`${label} ${field}`, "text");
      for (const field of collections) if (campaign[field] != null) records(campaign[field], `${label} ${field}`);
      for (const field of ["systemData", "connectionBoard", "nextSession"]) if (campaign[field] != null && !object(campaign[field])) invalid(`${label} ${field}`, "an object");
      const workflow = campaign.sessionWorkflow;
      if (workflow != null) {
        if (!object(workflow)) invalid(`${label} session workflow`, "an object");
        assertWorkflowVersion(workflow);
        for (const field of ["preps", "desks", "reconciliations", "playerPackets", "drafts"]) {
          if (workflow[field] == null) continue;
          if (!object(workflow[field])) invalid(`${label} ${field}`, "a record map");
          for (const [key, item] of Object.entries(workflow[field])) {
            if (!object(item)) invalid(`${label} ${field} ${key}`, "a record");
            for (const rows of ["scenes", "pinned", "revelations", "clocks", "spotlights", "tasks", "beats", "log", "proposals", "sections"]) {
              if (item[rows] != null) records(item[rows], `${label} ${field} ${key} ${rows}`);
            }
          }
        }
        if (workflow.sessions != null) records(workflow.sessions, `${label} legacy sessions`);
      }
      for (const field of ["sessionDeskState", "reconciliationState"]) assertWorkflowVersion(campaign[field]);
    });
    for (const field of ["appearance", "copilot", "foundry", "prepTemplates"]) if (state[field] != null && !object(state[field])) invalid(`Workspace ${field}`, "an object");
    return state;
  }
  function normalizeWorkspace(value, appVersion, savedAt = new Date().toISOString()) {
    version(object(value) ? value.schemaVersion : undefined, WORKSPACE_SCHEMA_VERSION, "Workspace");
    const source = object(value) && Object.hasOwn(value, "state") ? value : { state: value };
    const state = assertState(source.state);
    if (source.archivist != null && !object(source.archivist)) invalid("Archivist details", "an object");
    return { schemaVersion: WORKSPACE_SCHEMA_VERSION, appVersion: String(source.appVersion || appVersion || "0.0.0"), savedAt: String(source.savedAt || savedAt), state, archivist: source.archivist || {} };
  }
  function summary(value) {
    const workspace = normalizeWorkspace(value);
    return {
      campaigns: workspace.state.campaigns.map(campaign => ({ id: campaign.id, title: campaign.title || "Untitled campaign", system: campaign.system || "Custom", sessions: campaign.sessions?.length || 0, records: ["characters", "quests", "locations", "journal", "arcs"].reduce((sum, field) => sum + (campaign[field]?.length || 0), 0) })),
      templates: object(workspace.state.prepTemplates?.templates) ? Object.keys(workspace.state.prepTemplates.templates).length : 0,
      savedAt: workspace.savedAt
    };
  }
  return { WORKSPACE_SCHEMA_VERSION, SESSION_WORKFLOW_SCHEMA_VERSION, UNSUPPORTED_SCHEMA, assertWorkflowVersion, needsWorkflowBackup, assertState, normalizeWorkspace, summary };
});
