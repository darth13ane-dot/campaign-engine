(function initializeCampaignSystemState(root, factory) {
  const stateTools = factory();
  if (typeof module === "object" && module.exports) module.exports = stateTools;
  if (root) root.CampaignSystemState = stateTools;
})(typeof globalThis === "object" ? globalThis : this, function createCampaignSystemState() {
  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function hasContent(value) {
    return Object.values(value).some(entry =>
      Array.isArray(entry) ? entry.length > 0 : entry != null
    );
  }

  function normalizeCampaign(campaign, registry) {
    if (!isRecord(campaign)) throw new Error("A campaign record is required.");
    if (!registry?.get) throw new Error("The campaign-system registry is required.");
    if (!isRecord(campaign.systemData)) campaign.systemData = {};

    if (isRecord(campaign.pf2e)) {
      if (hasContent(campaign.pf2e)) campaign.systemData.pf2e = campaign.pf2e;
      delete campaign.pf2e;
    }

    if (!Array.isArray(campaign.systems)) {
      const definition = registry.get(campaign.system || "Custom");
      campaign.systems = [{ id: definition.id, name: definition.name, enabled: true }];
    }
    campaign.systems = campaign.systems
      .filter(isRecord)
      .map(system => {
        const definition = registry.all().find(candidate => candidate.id === system.id)
          || registry.all().find(candidate => candidate.name.toLowerCase() === String(system.name || "").toLowerCase())
          || registry.get(system.name);
        return {
          ...system,
          id: definition.id,
          name: definition.name,
          enabled: system.enabled !== false
        };
      });
    if (!campaign.systems.length) {
      const definition = registry.get(campaign.system || "Custom");
      campaign.systems.push({ id: definition.id, name: definition.name, enabled: true });
    }

    for (const [systemId, data] of Object.entries(campaign.systemData)) {
      if (isRecord(data) && !Object.keys(data).length) delete campaign.systemData[systemId];
    }
    return campaign;
  }

  return Object.freeze({ normalizeCampaign });
});
