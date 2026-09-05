# Sharing and desktop updates

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
