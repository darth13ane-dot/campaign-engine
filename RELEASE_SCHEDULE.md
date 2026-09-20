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
| 1.5.0 | Shipped September 9, 2026 | Session Prep workspace | Opening, time budget, scenes, campaign pins, clues, clocks, spotlights, tasks, GM packet, search, stable session identity, first-start handoff | Saved preparation survives reload and import; player preview excludes prep; live progress survives resume; packaged runtime matches tested source |
| 1.6.0 | Shipped September 9, 2026 | Session continuity and recovery | Saved carry-forward review, completed or recorded source sessions, active quest and arc suggestions, source attribution, next-session handoff, backup chronology and future-schema protection | Explicitly selected material appends with stable provenance; stale reviews and duplicates are handled; canon and live progress survive; original workspace bytes remain safe |
| 1.7.0 | Shipped September 9, 2026 | Reviewed player packets | Multiple session documents, editable shared-record copies, isolated preview and approval, Markdown and printable HTML, public text projection and exact import permissions | Exports match approved content, private fields and unresolved links are excluded, changed sources block sharing, packet drafts and approvals survive restore |
| 1.8.0 | Shipped September 9, 2026 | Reusable prep templates | Six original starters, global custom library, capture of planning structure, editable application reviews, separate guidance and authored fields, explicit append and duration choice | Library and reviews survive recovery; blank guidance stays outside authored readiness and live play; stale or replayed reviews fail safely; source canon and live progress remain intact |
| 1.9.0 | Shipped September 18, 2026 | First use and workspace recovery | Explicit start choices, next-session setup, valid empty workspaces, shared validation, reviewed restores, recovery-copy browser | Existing and empty workspaces persist; canceled, stale, malformed and failed restores preserve current data; damaged originals survive confirmed recovery |
| 1.10.0 | Shipped September 19, 2026 | Desktop trust and release checks | Common desktop sender validation, script policy, navigation and permission restrictions, native custom-program review, pull-request Windows validation | Hostile requests fail before privileged operations; planning, PDFs, previews, recovery, and offline use pass under the policy; release artifacts match validated source |
| 1.11.0 | Shipped September 20, 2026 | Larger-campaign responsiveness | Indexed player projection, efficient history baselines, reusable search indexes, reduced save copying, visible browser save recovery | Measured fixtures; secret filtering and undo preserved; unsaved browser work downloadable; large desktop workspace survives overlapping saves, restart and reviewed recovery |
| 1.12.0 | Shipped September 20, 2026 | Recoverable browser storage | IndexedDB migration, transactional current/previous saves, exact legacy recovery copies, stale-tab protection, explicit reload and preserved older-app branches | 24.57 MB fixture survives offline browser restart; aborted and interrupted writes retain committed data; migration, conflicts, recovery, native regression and release verification pass |
| 1.12.1 | Shipped September 20, 2026 | Supported desktop runtime | Pinned Electron 44.4.3, actual executable runtime verification, documented dependency maintenance | Native preparation, PDF, player-preview and security checks pass; workspace and encrypted credentials survive a controlled upgrade/rollback cycle; Windows release and feeds are verified |
| 1.13.0 | Shipped September 20, 2026 | Notes into playable preparation | Selected source excerpts, session brief, manual and optional AI drafts, exact quotes, editable approval, retained attribution | Drafts survive reload and export; stale and invalid citations block approval; selected pieces append once; private sources, canon and live progress remain protected |
| 1.14.0 | Current planning release | Prepared scenes at the table | Scene-specific references, focused situations, inline record reader, durable capture drafts, ended-session protection | Stable links survive prep, live play, packets and carry-forward; drafts survive actions and restarts; ended play stays read-only; published Windows package and feeds verified |
| Following planning milestones | To be scheduled | Onboarding and beta readiness | Campaign-start guidance, recovery practice, reliability, performance, and onboarding | GMs can prepare, run, and recover their work independently across supported systems |
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
