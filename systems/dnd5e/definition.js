CampaignSystemRegistry.register({
  id: "dnd5e",
  name: "D&D 5e",
  displayName: "Dungeons & Dragons Fifth Edition",
  accent: "A familiar fantasy toolkit for ability scores, classes, challenge rating, and actions.",
  sheetFields: ["Armor Class", "Hit Points", "Speed", "Proficiency", "Ability scores", "Challenge rating"],
  characterFields: ["Level", "Class & subclass", "Armor Class", "Hit Points", "Proficiency Bonus", "STR", "DEX", "CON", "INT", "WIS", "CHA"],
  monsterFields: ["Size", "Creature type", "Alignment", "Armor Class", "Hit Points", "Speed", "Challenge Rating", "STR", "DEX", "CON", "INT", "WIS", "CHA"],
  links: [{ label: "D&D 5e for Foundry", url: "https://foundryvtt.com/packages/dnd5e" }]
});
