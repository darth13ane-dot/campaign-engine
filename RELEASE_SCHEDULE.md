# Campaign Engine release schedule

The current priority is GM preparation and session planning for ongoing campaigns across multiple systems. Campaign Engine remains a persistent local workspace, with Foundry API Bridge and Archivist Nexus supplying optional live and imported data. Shared planning improvements lead the schedule; system-specific integrations follow that foundation. [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) defines the ordered milestones and future paid-product gates.

## Planned releases

| Release | Target | Theme | Planned scope | Exit criteria |
| --- | --- | --- | --- | --- |
| 1.2.0 | Shipped July 22, 2026 | Foundry Workspace Foundation | Windows-protected Foundry key, useful actor filters, stable actor links, world/system status, clearer bridge errors | Saved key survives restart/update; filtered sync is tested; existing actor and Builder flows remain intact |
| 1.2.1 | Shipped July 27, 2026 | PF2e foundation stabilization | Field feedback, retry/status polish, PF2e stat normalization and sheet filters, packaging fixes if needed | No open connection, persistence, filtering, PF2e-sheet, or portable-update regressions |
| 1.3.0 | Shipped August 19, 2026 | PF2e Live Table Actions | PF2e strikes, skills, saves, conditions, roll-table runner, journal/handout publishing, session-log capture | Every Foundry write is explicit and logged; PF2e roll and condition flows have useful error states |
| 1.3.1 | Shipped August 28, 2026 | PF2e Live Table stabilization | Current bridge-contract handling, independent tier-aware refreshes, ready-Strike and MAP labels, complete roll-table results, structured diagnostics, and explicit PF2e compatibility risk | Tier restrictions do not hide available PF2e actions; live response meaning is preserved in history; unverified version combinations are reported without being misrepresented as confirmed compatible |
| 1.4.0 | September 4, 2026 | Campaign workflow improvements | Campaign-wide search, page-aware references, Archivist review, record history, storage and lookup fixes | Browser/offline workflows pass; packaged runtime assets verified; local state and Foundry links survive saves and sync |
| 1.5.0 | Release validation | Session Prep workspace | Opening, time budget, scenes, campaign pins, clues, clocks, spotlights, tasks, GM packet, search, stable session identity, first-start handoff | Saved preparation survives reload and import; player preview excludes prep; live progress survives resume; packaged runtime matches tested source |
| Next planning release | After 1.5.0 feedback | Campaign continuity | Reviewable carry-forward of unfinished prep and unresolved session threads | Selected material carries forward with evidence and stable links; campaign changes retain approval gates |
| Following planning milestones | To be scheduled | Player packets and reusable prep | Explicit player-safe outputs, adaptable planning templates, campaign-start guidance | Player exports pass spoiler checks; templates work across systems and preserve original campaign material |
| Integration backlog | Reprioritize after shared prep milestones | PF2e World Library and Tactical Control | Compendium browsing, journal reconciliation, scene notes, tokens, movement, doors, initiative | Imports preserve IDs; previews and explicit writes protect the connected world |
| Compatibility backlog | Following stabilized system interfaces | D&D 5e compatibility | Stat normalization, sheet filters, rolls, conditions, and compatibility fixes | Existing PF2e paths retain their tested behavior |

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
