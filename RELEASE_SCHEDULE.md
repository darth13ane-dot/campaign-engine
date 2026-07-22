# Campaign Engine release schedule

This schedule favors small, observable Foundry improvements followed by a stabilization window. Campaign Engine is used as a persistent portable desktop workspace, with Foundry API Bridge and Archivist Nexus supplying live and imported data. Releases therefore keep local-first storage, explicit writes, diagnostics, and rollback ahead of broader automation.

## Planned releases

| Release | Target | Theme | Planned scope | Exit criteria |
| --- | --- | --- | --- | --- |
| 1.2.0 | July 24, 2026 | Foundry Workspace Foundation | Windows-protected Foundry key, useful actor filters, stable actor links, world/system status, clearer bridge errors | Saved key survives restart/update; filtered sync is tested; existing actor and Builder flows remain intact |
| 1.2.1 | July 29, 2026 | Foundation stabilization | Field feedback, retry/status polish, D&D 5e stat filters, packaging fixes if needed | No open connection, persistence, filtering, or portable-update regressions |
| 1.3.0 | August 7, 2026 | Live Table Actions | Sheet rolls, conditions, roll-table runner, journal/handout publishing, session-log capture | Every Foundry write is explicit and logged; journal and roll flows have useful error states |
| 1.3.1 | August 12, 2026 | Live Table stabilization | Compatibility fixes for active D&D 5e and PF2e worlds | Tested against the then-current Foundry API Bridge and supported Foundry versions |
| 1.4.0 | August 28, 2026 | Tactical Control | Active scene viewer, tokens, targeting, pathfinding, doors, and combat console | Destructive actions require confirmation; combat state refreshes without replacing campaign canon |
| 1.5.0 | September 18, 2026 | World Library | Compendium browsing/imports, PF2e live actions, journal reconciliation, scene notes | Imports preserve source IDs; two-way changes use previews instead of blind overwrites |

Dates are targets, not reasons to ship an unstable build. Patch releases can move forward whenever a user-blocking defect is fixed and verified.

## Release rules

- Keep Foundry reads broad and Foundry writes explicit.
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
