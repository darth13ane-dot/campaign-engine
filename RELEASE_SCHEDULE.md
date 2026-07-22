# Campaign Engine release schedule

This schedule favors small, observable Foundry improvements followed by a stabilization window. Pathfinder 2e is the primary live-play system, so PF2e sheet, action, encounter, and compendium workflows are implemented and stabilized before equivalent D&D 5e work. Campaign Engine is used as a persistent portable desktop workspace, with Foundry API Bridge and Archivist Nexus supplying live and imported data. Releases therefore keep local-first storage, explicit writes, diagnostics, and rollback ahead of broader automation.

## Planned releases

| Release | Target | Theme | Planned scope | Exit criteria |
| --- | --- | --- | --- | --- |
| 1.2.0 | Shipped July 22, 2026 | Foundry Workspace Foundation | Windows-protected Foundry key, useful actor filters, stable actor links, world/system status, clearer bridge errors | Saved key survives restart/update; filtered sync is tested; existing actor and Builder flows remain intact |
| 1.2.1 | July 29, 2026 | PF2e foundation stabilization | Field feedback, retry/status polish, PF2e stat normalization and sheet filters, packaging fixes if needed | No open connection, persistence, filtering, PF2e-sheet, or portable-update regressions |
| 1.3.0 | August 7, 2026 | PF2e Live Table Actions | PF2e strikes, skills, saves, conditions, roll-table runner, journal/handout publishing, session-log capture | Every Foundry write is explicit and logged; PF2e roll and condition flows have useful error states |
| 1.3.1 | August 12, 2026 | PF2e Live Table stabilization | Compatibility fixes for active PF2e worlds, including action and condition schema differences | Tested against the then-current PF2e system, Foundry API Bridge, and supported Foundry versions |
| 1.4.0 | August 28, 2026 | PF2e Tactical Control | Active scene viewer, tokens, targeting, movement, doors, PF2e encounters, initiative, and conditions | Destructive actions require confirmation; encounter state refreshes without replacing campaign canon |
| 1.5.0 | September 18, 2026 | PF2e World Library | PF2e compendium browsing/imports, live actions, journal reconciliation, scene notes | Imports preserve source IDs; two-way changes use previews instead of blind overwrites |
| 1.5.1 | October 2, 2026 | D&D 5e compatibility | D&D 5e stat normalization, sheet filters, rolls, conditions, and compatibility fixes using the stabilized PF2e workflows as the model | D&D 5e support does not weaken or regress the completed PF2e paths |

Dates are targets, not reasons to ship an unstable build. Patch releases can move forward whenever a user-blocking defect is fixed and verified.

## Release rules

- Keep Foundry reads broad and Foundry writes explicit.
- Build and stabilize each table-facing workflow for PF2e before adapting it to D&D 5e.
- Store credentials outside portable executables and campaign exports.
- Prefer stable Foundry document IDs over name-only matching.
- Put live-session actions into the session log when they change play state.
- Route campaign-canon changes through the Consequence Inbox.
- Follow each major Foundry release with a short stabilization release before expanding the command surface.

## Deferred until the safety layer is proven

- Autonomous combat or unattended AI actions.
- Direct wall editing and bulk scene deletion.
- Unreviewed two-way synchronization.
- Mirroring every Foundry document into the campaign workspace.
