# Prepare a player packet

Choose **Player packets** from a session, Session Prep, the live desk, or the Consequence Inbox. Each session can have several named packets: a recap for everyone, a briefing for the next meeting, or an individual letter. Drafts save automatically with the workspace and appear in GM campaign search.

## Assemble the document

1. Give the packet a title your players can see. A new packet starts with a neutral session number; write the intended public title yourself.
2. Add custom **Session recap**, **Briefing**, or **Handout or letter** sections. Edit their headings and text, then arrange them with the arrow controls.
3. Optionally choose **Add a campaign record**. The chooser lists explicitly player-known sessions, characters, quests, places, and journals. Choosing one creates an editable copy of its public title and recap, description, detail, or body.
4. Adapt copied sections for this audience. The original campaign record keeps its own text. Remove any section you do not want in this packet.
5. Use **New packet** to create another document for the same session. The packet selector returns to any saved version.

The composer remains a GM workspace. Sharing a record makes its designated public text eligible for copying; the GM should review that text for the intended audience. Custom prose requires the same judgment: the app cannot infer every secret written into a sentence.

## Preview, approve, and download

**Preview player document** opens an isolated view of the document. It contains only the packet title and ordered section headings and text. Inspect the complete preview, then choose **Approve this packet**. Download **Markdown** or **Printable HTML** from the approved version. Open the HTML in a browser to read or print it.

Approval is tied to the exact content and its current source and reference checks. Editing, reordering, or changing relevant sources requires another review. Downloads validate the packet again immediately before export. A preview left open while the draft changes cannot approve the newer draft.

Internal references such as `[[Character: Vale]]` become plain names when they resolve uniquely to a currently player-known record. Hidden, missing, ambiguous, unsupported, or malformed references become `[Unshared reference]`. References supply labels, without expanding the target's contents. Source copies also retain checks against their original references, even after you edit the copied prose.

HTML, Markdown syntax, images, and external addresses entered as text remain literal text in these outputs. The printable document loads no external content. This keeps the inspected preview and the exported document consistent.

## Resolve changed sources

A copied section requires its original source to remain available, uniquely identifiable, player-known, and unchanged in the fields relevant to its output. A changed or revoked source blocks preview and export until resolved.

**Refresh copy** replaces the copied heading and body from the current source and asks for confirmation before replacing your edits. Review and approve the refreshed packet. You can also remove the section. A deleted source cannot silently attach to a replacement bearing the same name.

Renaming the session preserves all of its packets through stable session identity. Full workspace backups preserve drafts, source checks, and approvals. Use those backups for recovery; player downloads contain only the selected document.

Imported drafts with missing section lists open as empty drafts. If an import contains separate packets with the same packet ID, each copy is retained with a distinct identity and requires fresh approval.

## Player preview and imports

The app's local **Player preview** now uses the same public text projection for shared records and search. Private planning fields, tags, factions, relationships, expanded import details, live notes, and packet drafts stay in the GM workspace. Linked secret names are redacted from the displayed public text. This local preview helps the GM inspect shared material; hosted player accounts would require separate server authorization.

Archivist refresh now interprets exact permission labels through the common knowledge rules, so labels such as `not public` remain private. Explicit local sharing choices retain precedence unless the GM selects the incoming value during review. Older imports may already contain an erroneous explicit player flag from the previous interpretation; review existing sharing choices before distributing their text.

Packets are downloaded locally. Distributing a file to the intended players remains a deliberate GM action. Existing Foundry publication remains a separate explicitly confirmed action.
