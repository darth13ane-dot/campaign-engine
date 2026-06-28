CampaignSystemRegistry.register({
  id: "pf2e",
  name: "Pathfinder 2e",
  displayName: "Pathfinder Second Edition",
  accent: "A tactical fantasy toolkit for proficiency ranks, defenses, ancestry, and actions.",
  sheetFields: ["Armor Class", "Hit Points", "Perception", "Fortitude", "Reflex", "Will"],
  characterFields: ["Level", "Ancestry", "Class", "Armor Class", "Hit Points", "Perception", "Fortitude", "Reflex", "Will"],
  monsterFields: ["Level", "Creature type", "Alignment", "Armor Class", "Hit Points", "Perception", "Fortitude", "Reflex", "Will"],
  links: [
    { label: "Archives of Nethys", url: "https://2e.aonprd.com/" },
    { label: "PF2e for Foundry", url: "https://foundryvtt.com/packages/pf2e" }
  ],
  view: {
    id: "system-pf2e",
    label: "PF2e tools",
    icon: "⚔",
    renderer: "pf2eToolkitView",
    loadingTitle: "PF2e tools",
    loadingKicker: "SYSTEM-SPECIFIC PREP"
  }
});
