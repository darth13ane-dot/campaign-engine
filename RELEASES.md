# Sharing and desktop updates

## Version 1.17.0 — A complete GM run sheet

**GM run sheet** opens a readable preparation snapshot with local contents and scene-reference links. Download self-contained HTML for offline reading and browser printing, or Markdown for your preferred editor. Both formats share the same content model and retain scene order, choices, timings, supporting preparation, and approved source attribution.

The packet audit reproduced lost detailed notes when a linked record also had an overview, structured stats becoming an object placeholder, and selected reference text being shortened. The exports now retain each supported field separately, render nested values readably, and keep complete saved text from selected PDF pages. Missing references remain unavailable; pending reviews, unrelated records, and live-desk notes stay outside the prep snapshot.

Preview controls preserve keyboard return and narrow layouts. Changes to preparation or sources require a fresh preview; player mode removes private content and disables downloads. Source text is escaped, document scripts remain disabled, and exported HTML makes no external requests. Workflow format 3 is unchanged. [SESSION_PREP.md](SESSION_PREP.md) explains use and [DESKTOP_SECURITY.md](DESKTOP_SECURITY.md) records the preview boundaries.

Verification covers 297 automated tests; the browser journey from selected notes through approval, preview, downloads, and offline reopening; 1440/700/390 px layouts; script and resource blocking; and rendered A4/Letter print specimens. Native checks exercise restart, document navigation, and actual Electron downloads in an isolated synthetic profile. GM pilot usefulness, Windows signing, and installer/updater replacement remain broader readiness work.

## Version 1.16.0 — Actionable preparation review

Session Prep now gives specific follow-up items with direct routes to the relevant fields or controls. The review identifies missing scene choices and situations, timing problems, unavailable references, unfinished supporting entries and tasks, and remaining notes-draft pieces. Scene numbers distinguish repeated titles. Four items appear first, with an explicit **Show all** control for longer plans.

The previous percentage could show every prompt covered while a scene's player-choice field was empty. Scene coverage now requires a title, situation, and choice, and the review leads with concrete work instead of a percentage. The GM can start play at any point. Existing notes approvals, campaign canon, live progress, and workflow format 3 remain intact. [SESSION_PREP.md](SESSION_PREP.md) explains the review and its limits.

Parchment-theme cards in the preparation workspace now use a light background, keeping its fields and review content readable with dark text.

Verification includes 293 automated tests, browser keyboard and immediate-click editing, missing-record and PDF-page review, desktop and narrow layouts, offline reload, and player privacy. Native checks cover repair, restart, reviewed restore, export/import, and opening the unchanged save in published v1.15.1. These checks use synthetic campaigns; real-session usefulness remains a GM pilot question.

## Version 1.15.1 — Protect preparation across app versions

Session preparation now uses workflow format 3. This marks PDF page links, source attribution, pending note reviews, and saved live capture as requiring a compatible app. Earlier published builds could accept these plans and lose page links when starting play; builds from v1.12.0 through v1.15.0 now reject the upgraded workspace through their existing version checks.

Existing format 2 plans upgrade in place, retaining their content. Before the first upgraded save, the browser preserves the exact earlier workspace in Recovery copies, and Windows creates a **Before preparation format upgrade** safety copy. A failed checkpoint prevents the Windows save; browser upgrades and their recovery copy commit together. Future workflow versions are rejected before normalization or live actions can change them.

Use v1.15.1 or a later compatible build for upgraded workspaces and exports. Keep a downloaded backup when changing app versions. Windows safety copies follow the existing twelve-copy retention policy; browser recovery copies share the site's storage and can be removed by clearing or eviction. An older pre-upgrade copy contains the work saved at that time. [BROWSER_STORAGE.md](BROWSER_STORAGE.md) explains recovery and external backups.

Verification includes 289 automated tests, a real-browser v1.15.0 upgrade and stale-tab check, PDF preparation through offline reload, and native published-app v1.14.0/v1.15.0 rejection with unchanged workspace files. Recovery download, preview, restore, current-version export/import, and restart pass; browser recovery controls were checked at 1440 and 390 pixels. Checks use synthetic campaigns and temporary profiles.

## Version 1.15.0 — PDF sources beside the session

Imported PDF pages can now become selected sources in Build from notes, scene references, and live-desk pins. Search book titles or page text, review exact excerpts, and keep the original book/page identity through approved preparation, GM packets, and carry-forward. The live reader displays the linked page beside the situation and saved notes.

Selected-page changes require another notes review. Missing or ambiguous books and pages remain unavailable, and legacy imports state when a page number is unknown. Optional AI requests include the selected excerpts only; the GM packet includes linked page text. [PREP_SOURCES.md](PREP_SOURCES.md) explains the workflow, physical PDF numbering, and extraction limits.

## Version 1.14.0 — Prepared scenes at the table

Scenes can now retain their own campaign references from manual preparation, approved note drafts, and continuity. The live desk focuses one situation with its meaningful choice and source notes, and an inline reader opens the exact linked record beside it. Renames follow stable identities; missing sources remain visible. GM packets include scene-linked record details.

Pending log notes and other quick-capture fields now save through redraws, navigation, offline reload and restarts. Committing a note retains the scene where writing began. End-session confirmation saves a pending log note once, and ended desks allow reference browsing while protecting recorded play from further edits. [SESSION_TABLE.md](SESSION_TABLE.md) describes the workflow and limits.

The notes review also preserves its approval button while validation updates, so clicking immediately after editing applies the selected pieces on the first click.

## Version 1.13.0 — Campaign notes into playable prep

**Build from notes** connects selected campaign excerpts to the Session Prep workspace. GMs can shape a draft manually or request structured pieces through their AI connection, edit openings and scenes, review source quotes and suggested additions, then append selected pieces to preparation. Unselected pieces remain saved, and campaign canon and live progress remain intact. Stable identities, stale-source review, exact-quote validation, and retained attribution protect the handoff from notes to play.

[NOTES_TO_SESSION.md](NOTES_TO_SESSION.md) describes the workflow, sending scope, offline path, and verification limits. Automated provider responses validate integration behavior; live provider quality remains unverified.

## Version 1.12.1 — Supported desktop runtime

The Windows app moves from Electron 37.10.3 to the pinned Electron 44.4.3 release, including Chromium 152.0.7977.130 and Node 24.21.0. Package verification now reads the version from the built executable and rejects a runtime that differs from the reviewed dependency. Development requires Node 22.12.0 or later. [RUNTIME_MAINTENANCE.md](RUNTIME_MAINTENANCE.md) records the upstream sources, build procedure, and upgrade coverage.

The existing 247 tests pass. Native checks cover PDF import and its worker, approved player previews, desktop access controls, custom connection approval, large-workspace saves, restart, and reviewed recovery. A controlled Electron 37 → 44 → 37 → 44 cycle retains the synthetic campaign, preparation, imported details, recovery copies, and both Windows-encrypted test credentials; credential files remain unchanged when loaded by the new runtime. Workspace exports remain separate from credentials.

## Version 1.12.0 — Recoverable browser storage

Browser workspaces now save in IndexedDB, with the previous automatic save retained in the same transaction. The first load migrates the earlier localStorage workspace and recovery copy, preserving both exact originals for download. Interrupted migration can resume. The app reports **Saved** only after the transaction commits, and offers a download of current work if saving fails.

A second tab with stale data cannot overwrite a newer save or restore. Download its unsaved draft, then use **Reload saved workspace** to open the committed copy. Changes saved separately by an older app are retained in Recovery copies for review. Supported damaged workspace data remains downloadable and is preserved before a reviewed recovery; newer unsupported formats remain protected.

Verification includes 247 automated tests, a 24.57 MB synthetic workspace with four campaigns and 2,400 reference pages, complete Chrome restart and offline editing, transaction abort and renderer-crash recovery, concurrent-tab save and restore conflicts, and desktop/mobile recovery controls. Preparation, carry-forward, templates, player packets, onboarding, and native Windows save/restart/recovery checks also pass. [BROWSER_STORAGE.md](BROWSER_STORAGE.md) explains migration, tab conflicts, and backup practice; [PERFORMANCE.md](PERFORMANCE.md) records the tested scope and remaining capacity limits.

## Version 1.11.0 — Larger-campaign responsiveness

Player preview and player search now share an indexed record lookup within each render, preserving current sharing rules and redaction. The measured 4,000-record Chrome fixture reduced player-dashboard scripting from 563 ms to 27 ms and fresh player search from 378 ms to 26 ms. Record-history capture avoids repeatedly cloning unchanged records across every campaign, and autosave removes an extra whole-workspace copy. Existing packet approvals and record undo remain compatible.

Search opens without indexing a blank query and retains an unchanged index between visits. Edits, workspace replacement and GM/player mode changes refresh it. A browser save failure now keeps a visible **Download current workspace** action that includes unsaved preparation; successful saving clears the warning. Browser capacity remains limited by `localStorage`.

Verification includes 235 automated tests, browser preparation/player-packet/onboarding/recovery checks, and a packaged desktop exercise with four campaigns, 16,000 records, 800 sessions and 2,400 reference pages. Overlapping saves, inactive-campaign undo, restart and reviewed recovery preserve the data. [PERFORMANCE.md](PERFORMANCE.md) records fixtures, measurements, reproducible commands and observed storage limits.

## Version 1.10.0 — Desktop trust and release checks

Every desktop request now verifies the application window, main frame, and bundled page before accessing campaign files, saved keys, update controls, or connections. Save-and-close messages follow the same rule. Navigation keeps the app on its bundled page, external web links open through a restricted URL parser, and device and browser permission requests are denied.

The application content policy blocks inline scripts, event handlers, and JavaScript string evaluation while retaining local PDF processing, player-document previews, offline caching, and configured integration connections. Interface fonts are bundled with their licenses for consistent offline use, removing font-service requests at startup. Custom connection programs require a native review of the exact program and arguments for each launch; cancellation starts no program. The built-in Archivist connection retains its normal sign-in workflow.

Pull requests and changes to `main` now run Windows tests and package verification before tagged release builds. GitHub Actions use pinned current revisions, and public releases include application downloads and update metadata. [DESKTOP_SECURITY.md](DESKTOP_SECURITY.md) describes these boundaries and remaining readiness work.

## Version 1.9.0 — First use and workspace recovery

New public installations open a welcome screen with explicit choices to create a campaign, restore a backup, explore an editable example, or connect Archivist. Campaign creation accepts the next session's number and title and opens Session Prep directly. Empty workspaces retain their settings and template library across restarts. Existing campaigns, including edited samples, are preserved when bundled data changes.

Backup selection opens a review of the incoming campaigns and custom library. Confirmation creates a recovery copy and saves the replacement before switching the active workspace. A changed current workspace invalidates its preview. Browser and desktop storage share validation for workspace versions, campaign identities, record lists, and planning containers. Failed writes and rejected imports preserve current data.

**Browse recovery copies** exposes desktop safety copies and the previous automatic save, or the browser's previous workspace. A failed startup opens a protected recovery screen. Confirmed desktop recovery preserves damaged primary and previous files byte-for-byte before replacing them. Unsupported newer schemas require a compatible version. The last campaign can be deleted with a recovery copy, leaving a usable empty workspace.

See [GETTING_STARTED.md](GETTING_STARTED.md) for setup, backup, and recovery instructions.

## Version 1.8.0 — Reusable prep templates

**Prep templates** adds six original planning starters: investigation, social event, exploration, dungeon expedition, heist, and downtime. Each supplies adaptable guidance, suggested timing, and optional scenes. A global custom library lets GMs create, edit, duplicate, and reuse their own structures across campaigns and game systems. **Save this structure** captures a plan's arrangement and numeric settings into fresh generic prompts while its session material stays with the source.

Template application uses a saved, editable review. Choose entries, write session details, and explicitly add the selected copies to prep. Opening text appends, duration replacement is optional, and existing preparation and live progress retain their saved state. Source or target changes require a fresh review; consumed reviews cannot be replayed.

Planning guidance stays separate from authored fields and readiness. Blank template entries remain unfinished and stay out of live play and continuity suggestions. Full workspace backups preserve the custom library, pending reviews, and applied preparation; approved Archivist refreshes preserve them too. Unsupported future template formats retain their saved data and show a recovery message. The template workflow runs locally and remains outside Player preview and player search.

See [PREP_TEMPLATES.md](PREP_TEMPLATES.md) for the complete GM workflow.

## Version 1.7.0 — Reviewed player packets

**Player packets** gives each session several named recaps, briefings, or handouts. Write custom sections, choose editable copies from explicitly player-known records, and arrange the document. An isolated preview shows the exact title and text for players. Approve that version before downloading Markdown or printable HTML.

Saved drafts, approvals, and source checks travel with workspace backups and approved Archivist refreshes. Stable session identity preserves packets through renames; GM search opens the chosen packet directly. Editing content or changing a referenced source requires another review. Missing, ambiguous, or revoked sources block export; refreshing a copy explicitly replaces its edited text.

Internal links reveal only uniquely resolved player-known labels. Hidden or unresolved references become a neutral notice. Exported HTML and Markdown keep authored markup and external addresses inert, and the HTML document loads no external resources. Custom prose still needs the GM's spoiler review. [PLAYER_PACKETS.md](PLAYER_PACKETS.md) explains the complete workflow.

Local Player preview and search now project public record text through the same reference checks, excluding private planning fields, factions, tags, and relationship metadata. Record cards and search open the selected record by stable identity, including records with identical names. Imported packet drafts recover missing section lists and retain distinct copies when IDs collide, requiring fresh approval for ambiguous copies. The dashboard also tolerates imported characters without a role.

Archivist permission interpretation uses exact shared-label rules, correcting cases such as `not public`. Existing explicitly shared flags remain subject to GM review because a previously misclassified stored flag cannot reliably be distinguished from a deliberate sharing choice.

## Version 1.6.0 — Session continuity

**Bring forward** opens a saved review from Session Prep. Choose an earlier completed session, recorded session notes, or current campaign quests and story arcs. Review unused live scenes, unchecked revelations, incomplete clocks and prep tasks, spotlight opportunities, and pinned records. Edit the proposed copies and explicitly select what to add. Every new review begins with nothing selected.

Completed live progress supplies the carry-forward state. Recorded sessions without a live desk identify their material as earlier preparation with unknown play progress. Current active quests and story arcs offer grounded scene drafts. Applied consequence evidence uses the exact proposals actually applied; older batches without that audit record are identified explicitly.

Selected material appends to the target prep with its original source attached. Existing preparation and live progress survive, repeated reviews identify material already carried, and meaningful source or target changes require a fresh review. Selections and edits persist across reloads. Source attribution appears in prep and GM Markdown packets and follows stable session identities through renames. Ended desks and the Consequence Inbox provide a path to choose or create the next session and open its review.

Desktop recovery now retains the twelve newest supported backups by their creation time across backup reasons. Same-time copies receive unique filenames. Unreadable and unsupported copies remain available for manual recovery. Workspaces with unsupported future schemas are rejected before load, import, or replacement can rewrite their contents or recover an older file over them.

Core preparation and continuity remain available offline across game systems. See [SESSION_PREP.md](SESSION_PREP.md) for the complete workflow.

## Version 1.5.0 — Session Prep workspace

**Prepare session** opens a dedicated workspace from Overview, Sessions, and session records. GMs can assemble an opening, time budget, ordered scenes with details and decisions, pinned campaign records, clues, clocks, character spotlight opportunities, and preparation tasks. Saved preparation can be searched in GM view and downloaded as a GM Markdown packet.

Preparation checks derive from the saved material, with timing totals and unresolved-reference feedback. On the first start, the prepared material carries into the Live Session Desk. Reopening the desk preserves live progress. Stable session references keep prep and desks attached through renames and distinguish sessions with the same title; uniquely identifiable legacy references are upgraded.

The workspace persists preparation in its existing backup and Archivist-review paths. Player preview excludes prep and its search results. Core preparation works across game systems without requiring AI or an integration. See [SESSION_PREP.md](SESSION_PREP.md) for the workflow and [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) for the preparation-first product direction and future commercial gates.

## Version 1.4.2 — Navigation and Archivist connection diagnostics

The bundled proxy uses the operating system's trusted certificate authorities, allowing trusted Windows HTTPS inspection while keeping certificate verification enabled. This supersedes the 1.4.1 release attempt.

The left navigation scrolls independently on desktop and mobile, keeping the campaign selector and Settings available in shorter windows.

Archivist sync offers **Use built-in connection**, using a pinned proxy and the app's bundled runtime. Its HTTP response types now agree, so OAuth errors show the server's actual rejection instead of `[object Response]`. This connection keeps its sign-in cache under the app's private data directory, separate from external npx installations. Custom commands remain supported and argument paths retain their quoting.

Connection attempts cannot overlap, errors stay visible on the sync screen, and a failed tool listing no longer reports a successful connection. Closing an attempt also closes its child processes. A fetched preview is labelled as awaiting review rather than as an imported workspace.

During validation, Archivist's token endpoint returned HTTP 400 `invalid_grant` after browser authorization, including with a fresh client registration. Client ID, redirect URI, and PKCE verifier matched. These app changes expose that failure; they do not resolve an authorization-code rejection by Archivist. If it persists, provide that diagnostic to Archivist support without sending tokens, authorization codes, or verifier files.

## Version 1.4.0 — Campaign workflow improvements

Campaign-wide search now includes sessions, story arcs, live scratchpads and logs, and imported PDF pages. Results can be filtered by type and expanded beyond the first page. Player preview searches only shared campaign records; private notes and rulebooks remain in GM view.

Rulebooks use local PDF.js text extraction, retaining PDF page numbers. **Read & search** opens a page reader, and GM inquiry selects passages matching the question from enabled sources, with book titles and page references. Existing legacy imports remain readable; reimport a PDF to recover its full text and page numbers. Image-only scans still require OCR before importing. PDF.js and its support assets ship with the Windows app and are cached for offline PWA use.

Archivist sync now fetches a review before changing the workspace. Each changed field can use its local value or the incoming value, and existing overrides default to local. The preview reports incomplete imports and rejects application if the workspace changed during review. Source detail records refresh with an approved import. The desktop app makes a safety backup before saving it. Existing Foundry actor links, local workflow state, and history survive refreshes.

**Record history** shows changed fields and can undo a record operation or a consequence batch. Undo refuses to overwrite a record edited again since that operation. History travels with workspace backups and retains up to 100 operations within a 2 MB budget, always retaining the latest operation.

Rapid edits now share a pending save, with visible pending, saving, saved, and error states. The Windows app waits for unsaved work before closing and keeps the window open when saving fails. Browser startup restores valid saved campaigns even with empty bundled snapshots. Connection calculations and sheet matching reuse record lookups. Feature views render their final controls directly, without global DOM rewriting.

Packaging includes the missing Foundry actor normalizer. Every release build verifies that required HTML and PDF assets are present and match source, and that public builds exclude private Archivist data.

## Version 1.3.1 — PF2e Live Table stabilization

Campaign Engine 1.3.1 aligns the PF2e live-table panel with Foundry API Bridge's current public response contracts. Strike, condition, and roll-table refreshes now settle independently, so an Adventurer-tier restriction on roll tables no longer prevents the tier-free PF2e Strike and condition data from loading. Read-only Strike and condition refreshes may recover from one transient bridge interruption without retrying any roll or mutation. Confirmed writes remain single-attempt, and the live panel locks concurrent submissions until the active request settles.

The Strike picker now excludes actions that Foundry reports as not ready and uses the live PF2e multiple-attack labels. Roll history preserves critical-success and critical-failure results, while roll-table draws record every matched entry—including overlapping table results—instead of reducing the response to its numeric die total.

Bridge failures retain field-level validation details, subscription requirements, and the request ID needed for support. Foundry API Bridge 8.11.2 supports Foundry VTT 11 through 14, but its PF2e adapter was tested against PF2e 7.12.2; compatibility with the current PF2e 8.4.1 release on Foundry 14 has not been independently confirmed. Campaign Engine reports the connected versions and treats that gap as a visible compatibility risk rather than claiming a known failure.

## Version 1.3.0 — PF2e Live Table Actions

Campaign Engine 1.3.0 adds a guarded PF2e live-table panel to the Foundry VTT workspace. After syncing a Pathfinder 2e actor, the GM can refresh its current Strikes and conditions, roll Perception, skills, saves, Strike attacks or damage, adjust one condition, draw from a live Foundry roll table, and publish a player-safe Campaign Engine journal article as a Foundry handout.

Every chat-visible or mutating action requires a fresh confirmation checkbox and is sent exactly once. Campaign Engine never retries these POST requests automatically. Successes, failures, and partial journal publishes are retained in the bridge action history; when a live session desk is active, the same outcome is appended to its timestamped session log for later reconciliation.

Journal publishing only lists articles explicitly marked **Player safe**. If Foundry creates a journal but disconnects before it can be shown to players, Campaign Engine reports and logs that partial result instead of inviting an unsafe blind retry.

## Version 1.2.1 — PF2e foundation stabilization

Campaign Engine 1.2.1 makes Foundry-linked Pathfinder 2e sheets easier to trust and easier to navigate. Current PF2e Actor exports now normalize level, HP, AC, Perception, Speed, Fortitude, Reflex, Will, ability modifiers—including `+0`—traits, and embedded items into the sheet viewer.

**Sheets & stats** now has independent filters for PCs, NPCs, linked sheets, unlinked sheets, PF2e level, and text across names, roles, traits, statistics, and item names. Filters combine, show the number of matching sheets, and can be cleared as one action.

Foundry API Bridge reads retry once after a transient rate-limit, gateway, offline, or timeout response. Authentication failures are never retried, and create/write requests remain single-attempt so Campaign Engine cannot accidentally duplicate a Foundry document. The connection status reports when a safe retry is in progress and gives clearer exhausted-retry states.

## Version 1.2.0 — Foundry workspace foundation

Campaign Engine 1.2.0 makes Foundry API Bridge a dependable part of the persistent Windows workspace. The desktop app can protect the bridge key with the current Windows account and restore it after restarts or portable updates without storing it in campaign records or exports.

The Foundry screen now reports the connected world's title, game system, Foundry version, system version, cached actor count, stable character-sheet links, and last import. A live-directory search can filter actors by name, actor type, disposition, player ownership, and Foundry folder. Focused syncs merge results into the existing cache instead of erasing previously linked sheets.

When a Campaign Engine character has one exact Foundry name match, the Actor ID is saved as the stable link and preferred for later sheet lookups. Connection failures now distinguish rejected credentials, subscription restrictions, an offline world, and bridge timeouts.

See `RELEASE_SCHEDULE.md` for the planned stabilization and live-table releases that follow this foundation.

## Version 1.1.0 — Prep → play → reconcile

Campaign Engine 1.1.0 connects session planning to live play and post-session campaign upkeep.

From **Overview** or **Sessions**, choose **Run live session** on a planned session. The Live Session Desk keeps flexible scenes and pressures, pinned campaign records, a continuously saved scratchpad, timestamped log entries, quick-created records, clocks, counters, and clue checkoffs in one focused view. Closing the app does not complete the session; choose **End session** explicitly, and confirm it, when play is finished.

Ending a session opens the **Consequence Inbox**. Edit the recap, add proposed record updates manually, or—with explicit consent—ask the configured AI endpoint to draft evidence-backed proposals. Every proposal shows its session evidence and a before/after preview. Approve only the desired changes, then apply the batch. Unapproved changes never touch campaign canon.

Desktop editions create a local safety backup immediately before applying a batch. Archivist-backed fields are recorded as local overrides, IDs and imported source records remain intact, and stale proposals stop rather than overwriting a record changed since the draft was created. Unapplied drafts persist in the workspace and its backups until they are applied or deliberately discarded.

Double-click **Build Campaign Engine.cmd** or run `pnpm run dist`. This produces:

- an NSIS Setup executable for normal installation and automatic updates;
- a portable executable with in-app, no-install updates;
- `latest.yml` and a blockmap for the installed-app updater.
- `latest-portable.json` for the portable updater.

See `WINDOWS_APP.md` for the complete build, backup, and automated-release workflow.

## Enabling in-app updates

Host `latest.yml`, `latest-portable.json`, both Windows executables, and the installer blockmap together at a trusted HTTPS address. GitHub tag builds publish these files automatically.

The release workflow embeds its GitHub Releases download address. Manual release preparation requires the equivalent HTTPS address before it builds. You can override it inside the installed app under **App updates**. Campaign Engine checks when it opens and every six hours; changing the automatic-check setting reschedules those checks immediately. Downloads and installation remain explicit.

Portable builds use Campaign Engine's dedicated portable updater because electron-updater officially supports the Windows NSIS target, not the portable target. Portable downloads are size-checked and SHA-512 verified before the original executable is replaced and reopened.

## Private campaign data

Windows release builds contain empty Archivist stubs. The live campaign workspace and full Archivist details are stored under `%APPDATA%\Campaign Engine` and travel only through backups the user explicitly creates. Application upgrades do not overwrite that workspace.

Saved AI credentials also live under `%APPDATA%\Campaign Engine`, encrypted for the current Windows account and outside both the executable and workspace backups. This keeps the key stable across portable updates without putting it in a transferable campaign file.
