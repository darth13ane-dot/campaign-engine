# Campaign Engine product roadmap

Campaign Engine should help a GM turn an ongoing campaign into a playable next session, run that session with the right information close at hand, and carry its consequences into future preparation. Its first audience is GMs running continuing campaigns across multiple tabletop systems.

The priority is a complete preparation and session-planning workflow. A paid product is a later possibility, conditional on demonstrated usefulness, reliability, and demand. This roadmap sets the product order; existing Foundry work remains a supporting integration track. Dates in the older [release schedule](RELEASE_SCHEDULE.md) do not override these acceptance gates.

## Product principles

- **Prepare situations and choices.** Help the GM assemble pressures, opportunities, clues, NPCs, and flexible scenes that survive unexpected player decisions.
- **Use the campaign's memory.** Keep plans connected to stable records, established facts, previous sessions, and unresolved consequences.
- **Keep creative authority with the GM.** Generated material and imported changes remain editable proposals. Applying a plan must preserve existing canon and live-session notes.
- **Make manual preparation complete.** AI, Archivist, and Foundry enhance a usable offline workflow. A GM can prepare and run a session without connecting any service.
- **Protect ownership and continuity.** Exportable data, visible save failures, recoverable changes, and portable persistence are product features.
- **Support multiple systems deliberately.** The core planning model is system neutral; encounter math, sheets, and live actions belong to explicit system adapters with stated compatibility.

### Positioning hypothesis

Established tools already cover substantial campaign work: [LegendKeeper's official feature list](https://www.legendkeeper.com/features/) includes offline support, permissions, search, templates, maps, timelines, and boards; [World Anvil's GM workflow](https://www.worldanvil.com/learn/workflows/gm-workflow) describes planning, running, and reporting on sessions. These sources were checked on September 9, 2026. Our inference is that feature count or AI availability alone does not demonstrate a compelling reason to switch. The proposition to test is **turn established campaign knowledge into runnable preparation quickly, preserve player choices and consequences, and keep campaign ownership dependable**.

## Established foundation

The code audit began from version **1.4.2**. These capabilities are present in the inspected implementation; live service compatibility and future milestones have separate validation requirements.

| Capability | Current implementation and evidence |
| --- | --- |
| Campaign knowledge and preparation | Characters, quests, world records, journals, arcs, connections, guided creation, and reviewable assistant drafts in [app.js](app.js); system registry under [systems/](systems/). |
| Search and references | Campaign search and local PDF page retrieval in [campaign-search.js](campaign-search.js) and [source-library.js](source-library.js). PDF import retains selectable text and page numbers; scanned books require prior OCR. |
| Prep, play, and reconciliation | Versioned Live Session Desk state and approval-based Consequence Inbox in [session-workflow.js](session-workflow.js), with corresponding workflow tests. |
| Canon protection | Field-level Archivist review in [archivist-merge.js](archivist-merge.js) and [workspace-views.js](workspace-views.js); record and batch undo in [campaign-history.js](campaign-history.js). |
| Local persistence | Serialized saves in [workspace-persistence.js](workspace-persistence.js), AppData workspace and recovery/export in [electron/workspace-store.cjs](electron/workspace-store.cjs), and close-save handling in [bootstrap.js](bootstrap.js) and [electron/workspace-close.cjs](electron/workspace-close.cjs). |
| Credentials and distribution | Windows-encrypted credential storage in [electron/credential-store.cjs](electron/credential-store.cjs); installer and portable release workflow in [.github/workflows/windows-release.yml](.github/workflows/windows-release.yml); public snapshot exclusion and packaged-asset checks in [scripts/verify-package.mjs](scripts/verify-package.mjs). |
| Player knowledge and Foundry | Local player-preview filtering in [campaign-knowledge.js](campaign-knowledge.js); explicit Foundry actions in [foundry-live-actions.js](foundry-live-actions.js). Current integration limitations are recorded in [RELEASES.md](RELEASES.md). |

## Delivered milestone: v1.5.0 — Session Prep workspace

**Status: implemented in v1.5.0.** This milestone turns an upcoming session into a coherent preparation workspace with a deliberate handoff to live play. The acceptance gates below define its verification; [SESSION_PREP.md](SESSION_PREP.md) explains the daily workflow.

The GM can set an opening and session time budget; assemble and reorder rich scenes; describe each scene's pressure or central question; pin relevant campaign records; prepare clues and clocks; identify PC spotlight opportunities; and add custom preparation tasks. A derived checklist identifies missing preparation and compares planned scene time with the available session time. It is a guide to readiness, rather than a promise that a session will follow its plan.

An explicit first start transfers the prepared material into the Live Session Desk. Reopening an existing desk preserves its notes and progress. A GM Markdown packet provides a portable reference for the table. It includes private planning material and is labeled for the GM. Stable session identities keep plans attached when a session is renamed or rescheduled.

Acceptance gates:

1. A GM can create and complete a session plan without AI, Archivist, or Foundry, then save, restart, and recover it.
2. Scene order, timing, text, references, clues, clocks, spotlight opportunities, and custom tasks persist through workspace export and restore.
3. Readiness reflects the actual plan. Incomplete fields, unresolved record references, and an overfilled time budget have useful, specific feedback.
4. Starting play transfers the intended prepared material once. Repeated starts resume the same desk without duplicating or overwriting live progress.
5. Renaming or renumbering a session preserves its prep and desk association. Existing campaign and session data continue to load.
6. Markdown output follows scene order, contains the relevant preparation, and remains readable outside Campaign Engine.
7. Browser interaction checks cover editing, reordering, reload, export, and prep-to-play handoff. Domain tests cover identity, normalization, persistence, and repeat-start behavior. Release verification covers the packaged runtime and public data exclusion.

## Delivered milestone: v1.6.0 — Continuity-aware preparation

**Status: implemented in v1.6.0.** A saved Bring forward review assembles proposed material from earlier completed play or recorded session notes, plus current active quests and story arcs. The GM selects and edits individual copies before appending them to the target prep. Completed live scenes and revealed clues stay completed; earlier plans without a live desk state that play progress is unknown. Applied consequences use the exact executed proposal IDs, with explicit limitations for older batches.

Ended desks and the Consequence Inbox let a GM choose an upcoming session or create the next one, then review material for that plan. Original source identity travels with carried rows through later prep and live play. Existing target prep, campaign records, and live progress remain intact. Source attribution is visible in prep and GM packets. A saved review retains selections and edits until the GM applies or refreshes it.

Acceptance gates:

1. A GM can end a session, review consequences, and assemble the following session from selected material without re-entering it.
2. The review uses actual live completion and clock values; recorded-only material clearly states its limited play evidence.
3. Repeated carry-forward identifies existing copies, including material carried through several sessions. Unselected suggestions remain unapplied.
4. Source links survive stable-identity renames, and removed sources cannot silently attach to same-name replacements.
5. Material source, target, or active-thread changes invalidate a saved review. Refresh is explicit and applying preserves campaign canon and existing live state.
6. Saved reviews and source metadata survive normalization, restart, export, and restore. Browser checks cover explicit selection, editing, refresh, duplicate handling, narrow layouts, and offline use.
7. Desktop recovery rejects future workspace schemas without changing originals and retains the newest supported backup copies across reason prefixes.

## Active milestone: v1.7.0 — Reviewed player packets

**Status: implemented in v1.7.0.** Each session can own several saved documents with custom sections and opt-in editable copies from player-known records. An isolated preview and explicit approval bind the selected public text to Markdown and printable HTML downloads. Relevant source or reference changes require another review; unavailable or revoked sources block export. [PLAYER_PACKETS.md](PLAYER_PACKETS.md) describes the workflow and its limits.

Acceptance gates:

1. GMs can compose, reorder, preview, approve, and export multiple distinct packets for one session, with stable session and packet identities.
2. Every copied section comes from an explicitly shared source; output includes only the selected public heading and text. Private fields and source metadata remain outside the document.
3. Hidden, malformed, ambiguous, or missing internal references are replaced with a neutral notice. Export markup cannot execute scripts or load remote resources.
4. Approval covers the previewed content and current source and reference dependencies. Source edits, deletion, or permission revocation are rechecked immediately before export.
5. Draft edits, approvals, and source identity survive normalization, restart, full workspace restore, and approved Archivist refresh. Source records remain unchanged by packet editing.
6. Desktop and narrow browser checks cover the complete workflow, persisted approvals, stale sources, and local player projection. Exported files receive direct inspection.

The GM remains responsible for secrets written as ordinary prose in a shared field or custom section. Current local Player preview is a presentation feature; hosted player access would need authorization at the server boundary. Older imported records with previously misclassified explicit sharing flags require review.

## Ordered next milestones

### 1. Reusable and adaptable planning templates

Let GMs save and adapt useful session structures: investigation, social event, exploration, dungeon expedition, heist, and downtime. Templates contain optional prompts, scene structures, task defaults, and timing suggestions. They can be edited for the campaign and system without creating forced plot outcomes.

**Exit gate:** applying a template is previewable, adds a distinct editable plan, preserves existing work, and retains no source campaign's private records or identity links. GMs running at least three different systems can complete the same core planning workflow; system-specific features clearly state their coverage.

### 2. Trust, onboarding, performance, and beta readiness

Reliability work proceeds alongside the earlier milestones. This is the gate for inviting a broader pilot and making a commercial commitment.

| Area | Concrete work and acceptance gate |
| --- | --- |
| First use | Offer a clear path to create a campaign, import a backup, or explore an optional example. Support a valid empty workspace. Sample replacement must account for edits, rather than identifying untouched examples only by their campaign IDs. Current entry points are `initialState`, `hydrateCampaignState`, and `isDemoWorkspace`. |
| Schema and import | Future workspace schemas are rejected in v1.6.0, including during corrupt-primary recovery. Filesystem tests preserve original, previous, and imported bytes. Identity and nested-data validation, explicit migrations, and empty-workspace support remain to complete; the existing validator still permits a campaign without an ID. |
| Recovery | v1.6.0 retains the twelve newest supported copies by backup creation time, with legacy timestamp fallback and unique same-time filenames. Unreadable and future-schema copies are preserved. Continue failed-write, interrupted-save, restore, and upgrade exercises with representative workspaces, and make recovery reachable through the UI. |
| Large campaigns | Measure startup, search, editing, save latency, and restore with documented campaign sizes and PDF libraries. Browser storage currently writes the full workspace to `localStorage`; establish supported limits and move larger libraries to a storage tier suited to them before promising scale. |
| Desktop security | Add and verify a Content Security Policy, navigation restrictions, and sender validation for privileged IPC. Preserve the existing sandbox, context isolation, disabled Node integration, encrypted credentials, and restricted external-link handling. Review imported content and custom MCP command boundaries. |
| Release assurance | Run appropriate checks on pull requests as well as releases; verify installation, upgrade, rollback, portable updates, and packaged assets. Establish a signed distribution process. The downloaded v1.6.0 portable release reported `NotSigned`; signing hooks exist in CI. |
| Supportability | Provide actionable errors and an explicit diagnostic export that excludes credentials and campaign content by default. Document supported operating systems, integration versions, recovery steps, and known failures. Check keyboard operation, readable layouts, and save/error announcements. |

Architecture changes should follow these needs. The existing pure data modules are useful seams for extracting preparation, import validation, and export logic from the large renderer scripts. A framework rewrite has no acceptance value by itself.

## Proposed pilot measurements

These are starting targets for a pilot, not observed results or evidence of demand. Confirm the cohort, definitions, baseline, and practical thresholds before collecting data; use voluntary feedback and explicit measurement consent.

| Question | Proposed pilot target |
| --- | --- |
| Can a new GM reach a useful plan? | At least 80% of 8–12 pilot GMs complete a first session plan in 20 minutes without developer assistance. Record starting material and interruptions. |
| Does the workflow improve ongoing preparation? | Over three sessions per GM, measure active preparation time against that GM's comparable prior process; seek a median reduction of at least 25%, with unchanged or improved self-rated readiness. |
| Is the result useful in play? | At least 80% use their packet or Live Session Desk during two of the three sessions and rate quick access to needed material at least 4/5. |
| Does continuity earn repeat use? | At least 70% prepare their third session in the app; record what they carried forward and why others stopped. |
| Can it be trusted? | No unresolved data-loss, secret-disclosure, or duplicate-write failures. Every pilot GM completes one export-and-restore exercise; defects receive explicit reproduction and resolution records. |
| Is commercial exploration warranted? | Conduct post-pilot interviews about recurring value, purchase preferences, support expectations, and actual tradeoffs. Treat willingness-to-pay statements as hypotheses until tested through an authorized commercial offering. |

Small-cohort results guide the next iteration; they do not establish broad market demand. Record failures and the workarounds GMs still need.

## Eventual paid product

**Business hypotheses to test:** GMs may pay for preparation time saved, dependable campaign continuity, and useful table materials; a paid local app may fit the current architecture and ownership model; optional hosted collaboration may later create recurring value. Pricing, packaging, and demand remain undecided.

After the beta gates, define a paid local offering with a supported release policy, license and update entitlement behavior, offline access rules, support and refund processes, and a reviewed inventory of redistributed software and included game material. Document data handling and external AI/service costs in terms customers can understand. A hosted backend is optional for this path; distribution and entitlement design should match the validated offer.

Hosted collaboration becomes a separate decision when users demonstrate a recurring need for shared campaigns, cross-device access, or player portals. Its gates include accounts, tenant isolation, server-enforced GM/player access, conflict handling, recoverable cloud backups, export/deletion, operational monitoring, and a sustainable service-cost model. Billing and managed AI quotas follow a chosen offering. None of these hosted capabilities is currently established by the desktop implementation.

The decision to charge should follow evidence that GMs return to prepare and run their next session, with the trust and support arrangements needed to keep their campaigns safe.
