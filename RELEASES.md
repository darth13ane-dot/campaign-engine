# Sharing and desktop updates

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
