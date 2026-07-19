# Foundry VTT connection

Campaign Engine 1.1.1 uses **Foundry API Bridge** as its recommended Foundry connection. The bridge keeps Foundry in control of the world while allowing Campaign Engine to read actors and create selected builder content through the module's WebSocket API.

## Recommended setup: Foundry API Bridge

1. Install [Foundry API Bridge](https://foundryvtt.com/packages/foundry-api-bridge) in Foundry VTT and enable it for the world.
2. Open the module settings and create or copy its `pk_...` API key.
3. Keep Foundry open with a Game Master signed in.
4. In Campaign Engine, open **Foundry VTT** and leave **Foundry API Bridge** selected.
5. Use the default WebSocket URL, `wss://api.foundry-mcp.com/v1/connect`, and paste the same `pk_...` key.
6. Choose **Test connection**, then **Sync actors**.

The key is kept only for the current Campaign Engine session. It is not written into campaign exports or local campaign records.

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
