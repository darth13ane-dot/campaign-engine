# Build a playable session from campaign notes

Open a session's **Prepare session** workspace and choose **Build from notes**. The session's existing notes become the first selected source when available. Your source selection, brief, draft pieces, edits, and review choices save with that session and travel in workspace backups.

## Choose material for this session

Search record names or content across sessions, characters, quests, world entries, journals, and arcs. Add the records that matter now. Each selected record retains its stable identity, including its Archivist ID when present. Names and short identity suffixes distinguish records with the same title.

Use a focused, exact passage from each record, or **Paste notes** for your own new writing. You can inspect the record's current text beside its saved excerpt. Each draft accepts up to twelve excerpts of 6,000 characters each; long records explicitly show that their initial selection is shortened. The originals remain intact.

Write a brief describing the session's focus, tone, relevant player interests, and constraints. The workspace shows the session budget and already prepared scene time.

## Shape the session

**Shape a draft myself** works offline. Add and reorder openings, scenes, clues, character spotlights, clocks, and prep tasks. A finished scene needs a title, a concrete situation, and a meaningful player choice. Keep source quotes beside the draft and record any proposed additions or assumptions.

**Draft with my AI connection** uses the existing chat-completions connection. Before sending, review the selected notes and explicitly check the sending confirmation. The request contains the campaign and session titles, game system, available time, brief, and those selected excerpts. Other campaign records, imported detail stores, conversation history, and existing prep text stay outside this request. The API key authenticates the connection and stays outside the saved draft and workspace export.

The assistant is asked for an opening, flexible scenes, choices, clue delivery routes, contingencies, and useful supporting preparation. Returned pieces begin unselected. Each must cite an exact substring from a selected excerpt. Invalid citations or malformed pieces reject the response as a whole, preserving your notes. Connection failures retain the inputs for a deliberate retry; requests can be cancelled and time out after two minutes.

Exact quotes establish traceability. They do not prove that a generated scene follows logically from the notes or that all invented details have been identified. Review the wording and the suggested additions yourself. Game mechanics and live provider quality need their own validation.

## Review and add to prep

Edit individual pieces and select the ones you want to use. The review shows new scene minutes and the combined time budget. The optional pin control adds campaign records cited by selected pieces to the prep references.

**Add selected to session prep** appends the selected material. Existing openings and scene plans remain; an opening that would exceed the saved field limit is rejected before any piece is applied. Campaign canon and existing live-desk progress remain intact. Applied pieces leave the draft, and unselected pieces stay available for later review. Source excerpts and suggested additions remain attached to approved pieces, including opening paragraphs, and appear in the GM Markdown packet. First starting the session carries this preparation and attribution into its live desk.

If a source record changes, review its current text and choose **Use current record text**. If selected excerpts, the brief, destination prep, or live-session status change, **Review changes & keep draft** retains your draft wording while acknowledging the current material. Quotes must still match. Missing or ambiguous sources block application until you restore the source or remove it and repair the affected citations. An identified source cannot attach to a different record that happens to share its name.

The workspace and its source material are GM-only. Player preview excludes drafts and excerpts; player documents retain their separate approval workflow.

## Verification

Domain tests cover system-neutral manual authoring, request scope, exact citation validation, atomic application, repeated application, source identity, stale reviews, late responses, field limits, normalization, backup roundtrips, player projection, and prep-to-live transfer. Browser checks use synthetic campaigns and controlled AI responses to cover editing, reload, narrow layouts, errors, approval, exports, and offline use. Native checks exercise the packaged application with isolated profiles. No paid provider call or live Archivist/Foundry write is needed for these checks.
