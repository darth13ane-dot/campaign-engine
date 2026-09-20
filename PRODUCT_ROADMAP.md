# Campaign Engine product roadmap

Campaign Engine should help a GM turn an ongoing campaign into a playable next session, run that session with the right information close at hand, and carry its consequences into future preparation. Its first audience is GMs running continuing campaigns across multiple tabletop systems.

The priority is a complete preparation and session-planning workflow that complements Archivist AI. A paid product is a later possibility, conditional on demonstrated usefulness, reliability, demand, and a clear complementary role. This roadmap sets the product order; existing Foundry work remains a supporting integration track. Dates in the older [release schedule](RELEASE_SCHEDULE.md) do not override these acceptance gates.

## Product principles

- **Prepare situations and choices.** Help the GM assemble pressures, opportunities, clues, NPCs, and flexible scenes that survive unexpected player decisions.
- **Use the campaign's memory.** Keep plans connected to stable records, established facts, previous sessions, and unresolved consequences.
- **Keep creative authority with the GM.** Generated material and imported changes remain editable proposals. Applying a plan must preserve existing canon and live-session notes.
- **Make manual preparation complete.** AI, Archivist, and Foundry enhance a usable offline workflow. A GM can prepare and run a session without connecting any service.
- **Protect ownership and continuity.** Exportable data, visible save failures, recoverable changes, and portable persistence are product features.
- **Support multiple systems deliberately.** The core planning model is system neutral; encounter math, sheets, and live actions belong to explicit system adapters with stated compatibility.

### Positioning hypothesis

Established tools already cover substantial campaign work: [LegendKeeper's official feature list](https://www.legendkeeper.com/features/) includes offline support, permissions, search, templates, maps, timelines, and boards; [World Anvil's GM workflow](https://www.worldanvil.com/learn/workflows/gm-workflow) describes planning, running, and reporting on sessions. These sources were checked on September 9, 2026. Our inference is that feature count or AI availability alone does not demonstrate a compelling reason to switch. The proposition to test is **turn established campaign knowledge into runnable preparation quickly, preserve player choices and consequences, and keep campaign ownership dependable**.

## Complementary role alongside Archivist AI

The user explicitly wants to avoid excessive competition with Archivist AI. Its current offering already includes automatic campaign records, summaries, campaign questions and prep assistance, private journals, relationship views, and player handouts. [Official feature description, checked September 9, 2026](https://www.rpgarchivist.io/features). Its [official MCP connector](https://www.rpgarchivist.io/mcp) supports campaign-data access from external assistants, including session-preparation workflows. This is an integration opportunity; these sources do not establish a partnership or endorsement.

Campaign Engine's development focus is **a practical GM preparation and session-running workspace**: flexible scene plans, time budgets, preparation checks, adaptable structures, live table controls, and deliberate carry-forward of what still needs attention. Imported Archivist records supply campaign context, keep their source identities, and remain distinct from unapproved planning drafts.

Apply these product boundaries to upcoming work:

- Prioritize features that help a GM assemble, adapt, run, or evaluate a playable session using selected campaign knowledge.
- Let Archivist supply recording ingestion, transcription, automatic campaign extraction, and broad historical recall for connected users. Extend supported integration paths and source attribution when useful to preparation.
- Keep existing records, journals, search, and handout exports as supporting workflow capabilities. Evaluate expansion against the preparation task; a parallel automated campaign archive, general lore chatbot, public campaign gallery, and cast-analysis service are outside the current roadmap.
- Keep manual/offline preparation and data recovery complete for GMs who use another source or bring their own notes. Connecting Archivist should increase the value of the combined workflow.
- Before a commercial offering, validate demand for the preparation workflow, review applicable integration and content terms, and investigate cooperation where useful. Describe integrations accurately and keep provider accounts, costs, and ownership clear.

The product hypothesis is that GMs will value a reliable planning workspace around their campaign memory. Existing overlap is acknowledged; claims of unique features or market demand require evidence.

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

## Delivered milestone: v1.7.0 — Reviewed player packets

**Status: implemented in v1.7.0.** Each session can own several saved documents with custom sections and opt-in editable copies from player-known records. An isolated preview and explicit approval bind the selected public text to Markdown and printable HTML downloads. Relevant source or reference changes require another review; unavailable or revoked sources block export. [PLAYER_PACKETS.md](PLAYER_PACKETS.md) describes the workflow and its limits.

Acceptance gates:

1. GMs can compose, reorder, preview, approve, and export multiple distinct packets for one session, with stable session and packet identities.
2. Every copied section comes from an explicitly shared source; output includes only the selected public heading and text. Private fields and source metadata remain outside the document.
3. Hidden, malformed, ambiguous, or missing internal references are replaced with a neutral notice. Export markup cannot execute scripts or load remote resources.
4. Approval covers the previewed content and current source and reference dependencies. Source edits, deletion, or permission revocation are rechecked immediately before export.
5. Draft edits, approvals, and source identity survive normalization, restart, full workspace restore, and approved Archivist refresh. Source records remain unchanged by packet editing.
6. Desktop and narrow browser checks cover the complete workflow, persisted approvals, stale sources, and local player projection. Exported files receive direct inspection.

The GM remains responsible for secrets written as ordinary prose in a shared field or custom section. Current local Player preview is a presentation feature; hosted player access would need authorization at the server boundary. Older imported records with previously misclassified explicit sharing flags require review.

## Delivered milestone: v1.8.0 — Reusable preparation templates

**Status: implemented in v1.8.0.** Six system-neutral starters cover investigation, social events, exploration, dungeon expeditions, heists, and downtime. Each supplies scene structure, timing, optional material, and prompts for the opening, clues, clocks, spotlights, and preparation tasks. A workspace-wide library lets GMs create, duplicate, edit, and reuse their own structures across campaigns. [PREP_TEMPLATES.md](PREP_TEMPLATES.md) explains the workflow.

Saving a structure from an existing prep captures its numeric shape and generates fresh generic prompts. Campaign prose, identities, references, and play progress stay with the original session. Using a template opens a saved review: the GM selects material, writes campaign-specific content, and explicitly adds it to the prep. Timing replacement is a separate opt-in. Planning guidance remains visible beside authored fields, with its own completion count; blank prompts do not satisfy preparation checks.

Acceptance gates:

1. A GM can use every built-in starter offline and adapt the same core workflow in at least three system configurations. Real GM pilot results remain a separate beta gate.
2. Custom structures work across campaigns and survive restart and full workspace backup/restore. Capturing structure retains no source campaign prose, private records, or identity links.
3. Selected review rows append as distinct editable prep items with reset progress. Existing preparation, campaign canon, source templates, and live desks remain intact; changing the session duration requires an explicit choice.
4. Saved review edits and selections survive restart. Changed source or target material requires refresh; applying the same consumed review twice is rejected.
5. Guidance survives normalization and appears in the GM packet as unfinished planning work when the corresponding authored field is blank. It does not become prepared content or live progress.
6. Player preview excludes template authoring. Unsupported library formats retain their saved data and provide a recovery path. Workspace replacement prevents competing template edits.
7. Domain, filesystem, browser, and packaged-runtime checks cover these behaviors, including narrow layouts and public snapshot exclusion.

## Delivered milestone: v1.9.0 — First use and workspace recovery

**Status: implemented in v1.9.0.** New public installations start with an empty workspace and explicit choices to create a campaign, restore a backup, explore an editable example, or connect Archivist. Creating a campaign opens preparation for its chosen next session. Empty workspaces retain settings and reusable templates; saved campaigns and edited samples survive startup unchanged by bundled examples.

Backup selection opens a review before replacement. Browser and desktop storage share validation of workspace versions, campaign identities, record lists, and planning containers. Recovery copies are available from the UI, with original damaged bytes preserved before an explicitly confirmed recovery. [GETTING_STARTED.md](GETTING_STARTED.md) explains these workflows.

Acceptance gates:

1. A new GM can create a campaign for any supported system and prepare its next numbered session without entering historical records or connecting a service.
2. Empty, populated, and example-based workspaces survive restart and backup/restore. Deleting the final campaign saves a recovery copy and retains workspace settings and templates.
3. Selecting a backup leaves current data unchanged. Confirmation saves a recovery copy before replacement; canceled, stale, malformed, unsupported, and failed-write restores preserve current work.
4. Browser recovery and the desktop's native import and recovery handlers, preload APIs, safety-copy list, and process restart are exercised. Automated desktop checks supply file-picker results from test fixtures. Damaged primary/previous recovery preserves original bytes; future workspace schemas remain protected.
5. GM recovery previews remain outside Player preview. Desktop and mobile layouts, offline use, and existing preparation, continuity, template, and player-packet workflows receive interaction checks.

## Delivered milestone: v1.10.0 — Desktop trust and release checks

**Status: implemented in v1.10.0.** This foundation protects local campaign work and privileged desktop operations. All desktop requests verify the exact application main frame; navigation, permissions, and script loading have explicit policies. Custom connection programs receive a native launch review. Interface fonts and their licenses are bundled for offline use. Pull requests gain Windows tests and package verification. [DESKTOP_SECURITY.md](DESKTOP_SECURITY.md) records the boundaries and remaining work.

Acceptance gates:

1. Every registered desktop request rejects foreign windows, child frames, missing frames, and navigated pages before accessing credentials, storage, updates, or processes. Legitimate workspace and close operations still succeed.
2. Injected inline scripts, event handlers, remote scripts, and JavaScript string evaluation fail under the application policy. Bundled scripts, fonts, local PDF workers, player previews, exports, and offline caching remain usable.
3. The app blocks navigation to remote or unrelated local pages, executable external schemes, webviews, and unneeded browser/device permissions. Ordinary web links open in the default browser.
4. The exact custom program and arguments appear in a native launch review. Cancel starts no process; approval applies to one launch. Built-in Archivist behavior remains intact.
5. Browser and packaged-runtime checks exercise normal planning and recovery alongside hostile inputs. Pull-request validation runs tests and Windows package checks without release secrets, and the tagged release's assets and update feeds are verified.

## Delivered milestone: v1.11.0 — Larger-campaign responsiveness

**Status: implemented in v1.11.0.** Synthetic workspaces expose repeated player projection and history costs. A per-pass source index, serialized history baselines and reuse of valid search indexes reduce those costs while retaining current permissions, stable identities, packet approvals and undo. Browser save failures expose a persistent download of the complete current workspace. [PERFORMANCE.md](PERFORMANCE.md) records measured gains and limits.

Acceptance gates:

1. Measure documented synthetic campaign sizes, record/page counts, history capture, projection, search and storage; keep a reusable benchmark that uses no private campaign data.
2. Check sharing revocation, duplicate identities, Unicode and malformed references, retained packet fingerprints, nested record edits, inactive campaigns and history reset.
3. Exercise real browser quota failure, preservation of existing saved bytes, download of unsaved changes, continuing close warnings, successful retry, and GM-only recovery controls at desktop/mobile widths.
4. Save and reopen a representative large workspace through the packaged desktop APIs. Hold a write open to verify that its captured revision and later edits remain distinct; exercise undo and reviewed recovery.
5. Verify existing preparation, player packet, first-use and recovery flows; publish passing Windows tests, matching packaged assets, a versioned release and working update manifests.

## Active milestone: v1.12.0 — Recoverable browser storage

**Status: implemented in v1.12.0.** Browser workspaces use IndexedDB transactions, preserving their previous automatic save and both exact originals during migration from localStorage. Saves report success only after transaction completion. Revision checks reject stale-tab writes; explicit reopening retains older-app branches for review. Large workspaces can reopen and remain editable offline. [BROWSER_STORAGE.md](BROWSER_STORAGE.md) explains the workflow and its limits.

Acceptance gates:

1. Migrate populated, empty, and damaged legacy workspaces without losing original data. A failed or interrupted migration remains recoverable; unsupported future formats stay protected.
2. Save and reopen the documented 24.57 MB synthetic workspace through the browser UI and after a complete offline process restart, retaining all campaigns, references, plans, and imported details.
3. Abort a real browser transaction and interrupt an unfinished save with a renderer crash. Retain the prior committed primary and previous copies, show unsaved status, and successfully save a subsequent edit.
4. Reject stale-tab autosaves and reviewed replacements. Offer download of unsaved work and an explicit reload; preserve a differing older-app branch as a downloadable recovery copy.
5. Exercise recovery at desktop/mobile widths, offline carry-forward and templates, player-packet privacy, first use, and native Windows persistence. Verify tests, package contents, the published release, and update assets.

## Remaining trust, performance, and beta readiness

Reliability work proceeds alongside the earlier milestones. This is the gate for inviting a broader pilot and making a commercial commitment.

| Area | Concrete work and acceptance gate |
| --- | --- |
| First use | v1.9.0 provides explicit starting choices, direct next-session preparation, and valid empty workspaces. Existing campaigns and edited examples are retained. Observe new GMs completing this workflow and improve it from their results. |
| Schema and import | v1.9.0 shares workspace validation across browser and desktop storage, rejecting ambiguous campaign identities and malformed supported containers before import. Legacy envelopes and supported records round-trip; future workspace/session-workflow schemas remain protected. Extend explicit migrations and field validation as stored models evolve. |
| Recovery | v1.9.0 exposes recovery copies and reviewed restore through the UI. v1.12.0 adds transactional browser saves, an automatic previous copy, exact migration originals, preserved damaged data, and stale-tab protection. Desktop safety copies retain the twelve newest supported backups. Continue device, upgrade, and interruption exercises, including browser eviction and external-backup recovery. |
| Large campaigns | v1.11.0 measures 0.55–24.57 MB synthetic workspaces and improves projection/history costs. v1.12.0 saves the four-campaign fixture in Chrome and reopens it offline after a process restart; native saves and recovery also pass. Measure real campaign shapes and slower devices, reduce complete-save costs, and verify additional browsers before extending capacity claims. |
| Desktop security | v1.10.0 adds an application content policy, navigation and permission restrictions, a common sender check for all privileged IPC, and native review of custom programs. Preserve the sandbox, context isolation, disabled Node integration, and encrypted credentials. Continue dependency maintenance and test any migration from the bundled file page to a dedicated application protocol with origin-storage recovery. |
| Release assurance | v1.10.0 adds pull-request and main-branch Windows tests and package verification. Exercise installation, upgrade, rollback, and portable updates with representative workspaces. Establish a signed distribution process. The downloaded v1.9.0 portable release reported `NotSigned`; signing hooks exist in CI. |
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

**Business hypotheses to test:** GMs may pay for preparation time saved, dependable carry-forward between sessions, and practical table controls; a paid local app may fit the current architecture and ownership model; optional shared preparation may later create recurring value. Test these benefits with GMs who use Archivist as well as those who bring other campaign notes. Pricing, packaging, and demand remain undecided.

After the beta gates, define a paid local offering with a supported release policy, license and update entitlement behavior, offline access rules, support and refund processes, and a reviewed inventory of redistributed software and included game material. Document data handling and external AI/service costs in terms customers can understand. A hosted backend is optional for this path; distribution and entitlement design should match the validated offer.

Hosted collaboration becomes a separate decision when users demonstrate a recurring need for shared campaigns, cross-device access, or player portals. Its gates include accounts, tenant isolation, server-enforced GM/player access, conflict handling, recoverable cloud backups, export/deletion, operational monitoring, and a sustainable service-cost model. Billing and managed AI quotas follow a chosen offering. None of these hosted capabilities is currently established by the desktop implementation.

The decision to charge should follow evidence that GMs return to prepare and run their next session, with the trust and support arrangements needed to keep their campaigns safe.
