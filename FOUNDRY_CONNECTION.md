# Foundry VTT connection

Campaign Engine 1.3.1 uses **Foundry API Bridge** as its recommended Foundry connection. The Foundry module maintains its own two WebSocket connections. Campaign Engine talks to the bridge's public HTTPS API, which relays commands over the module's existing connection instead of opening or replacing a WebSocket.

## Recommended setup: Foundry API Bridge

1. Install [Foundry API Bridge](https://foundryvtt.com/packages/foundry-api-bridge) in Foundry VTT and enable it for the world.
2. Open the module settings and create or copy its `pk_...` API key.
3. Keep Foundry open with a Game Master signed in and confirm the module's API connection is active.
4. In Campaign Engine, open **Settings -> Foundry VTT** and leave **Foundry API Bridge** selected.
5. Use the default public API URL, `https://api.foundry-mcp.com/v1`, and paste the same `pk_...` key.
6. Choose **Test connection**, then either **Sync all actors** or use the live-directory filters for a focused sync.

The key is sent as a bearer credential only to the configured public API URL. In the Windows app, **Protect this key with Windows** encrypts it for the current Windows account in the private AppData credential store so installed and portable launches can restore it after restarts and updates. In a browser, it remains in memory for the current session. It is never written into campaign exports or local campaign records.

If an older Campaign Engine workspace contains the previous `wss://api.foundry-mcp.com/v1/connect` value, 1.1.2 automatically replaces it with the HTTPS public API URL. Campaign Engine must not connect directly to the module's WebSocket endpoint because that endpoint is reserved for the Foundry module's long-lived client connection.

## Compatibility status

As of August 28, 2026, Foundry API Bridge 8.11.2 declares support for Foundry VTT 11 through 14 and is verified for Foundry 14. Its PF2e adapter was developed and tested against Pathfinder 2e system 7.12.2. The current Pathfinder 2e system is 8.4.1 for Foundry 14, and compatibility between that PF2e release and the bridge's live-action adapter has not yet been independently confirmed.

This is a compatibility risk, not a known failure. Campaign Engine shows the connected Foundry and game-system versions so a GM can record the exact combination in a bug report. Test live actions in a disposable world or after a Foundry backup before using them in an upgraded campaign, especially after a PF2e system update.

## What Campaign Engine can do through the module

- Read the current world summary and actor list.
- Search actors by name, actor type, disposition, player ownership, and Foundry folder without replacing the existing actor cache.
- Fetch full actor records for Campaign Engine's sheet viewer.
- Create actors and roll tables when you explicitly send content from the Builder.

Each complete or filtered actor sync links a Campaign Engine character to its Foundry Actor ID when there is exactly one matching name. That stable ID is then preferred over name matching when opening the character sheet. A focused sync merges its results into the cache; it does not remove sheets linked by an earlier sync.

Connection status distinguishes a rejected key, an unavailable subscription action, invalid request fields, an offline Foundry world, and a bridge timeout so the next repair step is visible without opening developer tools. When the bridge supplies structured tier or validation details, Campaign Engine preserves them; unexpected server failures also retain the bridge request ID for support.

Campaign Engine retries a read request once after a transient `429`, `502`, `503`, `504`, timeout, or browser-network failure. It does not retry rejected credentials or Foundry create/write requests. This keeps short bridge interruptions recoverable without risking duplicate documents.

Builder sends create new Foundry documents. Repeating a send can therefore create duplicates. Campaign Engine does not update or delete existing Foundry documents through this connection.

Foundry systems store statistics differently. Campaign Engine reads common fields such as name, type, portrait, HP or wounds, defense, movement, saves, ability modifiers, and embedded actions where available. Missing fields remain blank instead of being guessed.

For Pathfinder 2e actors, the sheet viewer uses the PF2e schema for level, HP, AC, Perception, Speed, Fortitude, Reflex, Will, ability modifiers, traits, and embedded items. **Sheets & stats** can combine PC/NPC, link-state, PF2e-level, and text filters without changing campaign or Foundry records.

## PF2e live-table actions

Campaign Engine 1.3.1 uses Foundry API Bridge's native `/pf2e` endpoints for Perception, skills, saves, Strikes, Strike damage, and conditions. It also uses the bridge's live roll-table and journal endpoints. Sync a PF2e actor, choose **Refresh strikes, conditions & tables**, then confirm each individual action before sending it.

Strike, condition, and roll-table refreshes settle independently. A subscription restriction or temporary failure in one section no longer hides data returned by the others. Ready Strikes show their actual PF2e multiple-attack labels, unavailable Strikes are not offered as live actions, and roll-table history records every matched result instead of only the numeric table roll. PF2e roll history also keeps critical-success and critical-failure meaning from the bridge response.

Live actions follow four safety rules:

- Every chat-visible roll or Foundry write requires an explicit confirmation for that single request.
- Side-effecting POST requests are never retried automatically, preventing duplicate rolls, condition changes, journals, or player displays. Only explicitly read-only Strike and condition refreshes may retry once after a transient bridge failure.
- While one live request is in progress, Campaign Engine locks the other live-action forms until that request settles so a double submission cannot create concurrent writes.
- Every outcome is kept in recent bridge history and copied into the active session desk log when a session is running.

Only Campaign Engine journal articles marked **Player safe** are offered as Foundry handouts. A journal creation followed by a failed player display is reported as a partial success so the GM can inspect Foundry before deciding whether to show it manually.

## Actor JSON fallback

You can work without any connection. Export an actor from Foundry, then choose **Foundry VTT -> Import actor JSON** in Campaign Engine. The file stays local to Campaign Engine.

## Legacy REST bridge

Existing custom bridges remain available under **Legacy REST bridge**. They must support:

```text
GET /health
=> { "ok": true }

GET /actors
=> { "actors": [ /* Foundry Actor document JSON objects */ ] }
```

For protected legacy bridges, Campaign Engine sends `X-Campaign-Engine-Key`. A legacy bridge must also allow requests from the origin where Campaign Engine is running.

Imported actors are associated with the campaign selected at import time and matched to Archivist character records by name. Actor snapshots are saved only in the Campaign Engine installation that imported them.
