# Campaign system packages

Campaign Engine keeps generic campaign features in `app.js` and `features.js`. Ruleset metadata, state, views, event handlers, and styles live under `systems/<system-id>/`.

## Runtime contract

- `systems/registry.js` owns stable system IDs and exposes only the views enabled for the active campaign.
- Each `definition.js` registers the system name, builder fields, links, and optional navigation/view contribution.
- System-owned campaign records live under `campaign.systemData[systemId]`.
- A system must not create its state bucket until its feature actually needs data.
- The shared navigation renders only view contributions from enabled systems.

The legacy top-level `campaign.pf2e` bucket is migrated automatically. Populated records move to `campaign.systemData.pf2e`; empty placeholders are deleted. A WFRP-only campaign therefore has no PF2e navigation or PF2e-shaped state.

## Adding a ruleset

1. Create `systems/<id>/definition.js`.
2. Register a stable ID and display metadata with `CampaignSystemRegistry.register`.
3. Put optional system UI and styles in the same directory.
4. Add browser script/style entries to `index.html` and `service-worker.js`.
5. Add tests proving that its view appears only when the system is enabled.

Do not add system-specific state initialization, navigation, rules tables, or handlers to the shared application files.
