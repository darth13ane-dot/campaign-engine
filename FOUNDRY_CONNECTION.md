# Foundry VTT connection

Campaign Engine 1.1.3 uses **Foundry API Bridge** as its recommended Foundry connection. The Foundry module maintains its own two WebSocket connections. Campaign Engine talks to the bridge's public HTTPS API, which relays commands over the module's existing connection instead of opening or replacing a WebSocket.

## Recommended setup: Foundry API Bridge

1. Install [Foundry API Bridge](https://foundryvtt.com/packages/foundry-api-bridge) in Foundry VTT and enable it for the world.
2. Open the module settings and create or copy its `pk_...` API key.
3. Keep Foundry open with a Game Master signed in and confirm the module's API connection is active.
4. In Campaign Engine, open **Settings -> Foundry VTT** and leave **Foundry API Bridge** selected.
5. Use the default public API URL, `https://api.foundry-mcp.com/v1`, and paste the same `pk_...` key.
6. Choose **Test connection**, then **Sync actors**.

The key is sent as a bearer credential only to the configured public API URL and remains in memory for the current Campaign Engine session. It is not written into campaign exports or local campaign records.

If an older Campaign Engine workspace contains the previous `wss://api.foundry-mcp.com/v1/connect` value, 1.1.2 automatically replaces it with the HTTPS public API URL. Campaign Engine must not connect directly to the module's WebSocket endpoint because that endpoint is reserved for the Foundry module's long-lived client connection.

## What Campaign Engine can do through the module

- Read the current world summary and actor list.
- Fetch full actor records for Campaign Engine's sheet viewer.
- Create actors and roll tables when you explicitly send content from the Builder.

Builder sends create new Foundry documents. Repeating a send can therefore create duplicates. Campaign Engine does not update or delete existing Foundry documents through this connection.

Foundry systems store statistics differently. Campaign Engine reads common fields such as name, type, portrait, HP or wounds, defense, movement, saves, ability modifiers, and embedded actions where available. Missing fields remain blank instead of being guessed.

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
