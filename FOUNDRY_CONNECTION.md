# Foundry VTT connection

Campaign Engine keeps its campaign records separate from your VTT. It can show Foundry character sheets and stat blocks in either of two ways:

1. **Actor JSON import** — In Foundry VTT, export the actor data through the system or a trusted export module, then choose that JSON file from **Foundry VTT → Import actor JSON** in Campaign Engine. This is completely local and does not need a server connection.
2. **A trusted bridge** — A Foundry module or small service you control can expose your chosen actors to Campaign Engine. This is useful for repeated syncs, but should be protected because actor data belongs to your game world.

## Bridge contract

Enter the bridge's base URL in Campaign Engine. The bridge should support:

```text
GET /health
=> { "ok": true }

GET /actors
=> { "actors": [ /* Foundry Actor document JSON objects */ ] }
```

If you protect the bridge, Campaign Engine sends the optional key as:

```text
X-Campaign-Engine-Key: <key>
```

The bridge must allow requests from the origin where Campaign Engine is running. If you open `index.html` directly, this may require permitting the `null` origin; serving the folder locally or hosting Campaign Engine over HTTPS is usually safer.

## What Campaign Engine reads

The sheet viewer reads common actor fields where they exist: name, type, portrait, HP/wounds, AC/defense, movement, Fortitude/Reflex/Will, ability modifiers, and embedded items/actions. Different Foundry systems structure data differently, so fields that are not present remain blank rather than being guessed.

Imported actors are associated with the campaign selected at import time and matched to Archivist character records by name. Imported data is saved only in the browser used for Campaign Engine.
