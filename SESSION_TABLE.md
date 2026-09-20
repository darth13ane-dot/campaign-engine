# Take a prepared scene to the table

Version 1.14.0 connects each prepared situation with its campaign references and keeps live capture drafts recoverable.

## Prepare the records you will need

In **Prepare session**, each scene has **At hand for this scene**. Choose **Link a campaign record**, search, and select a character, place, quest, arc, journal, or session. Short identity suffixes distinguish records with the same name. Linking uses the existing record's stable identity and preserves imported IDs and local edits.

Approved **Build from notes** scenes also receive the campaign records cited by their selected source quotes when the pin option is selected. You can refine those links in prep. Reusable templates continue to capture general planning structure, and the GM packet includes both scene references and their saved record details. Preparation checks count scene references alongside the session's general pins.

First starting a live session copies the scene references into its desk. Later prep edits stay in prep; resuming an existing desk preserves its play state. Unfinished scenes carried forward into another session keep their references.

## Run the current situation

Choose a scene in **Scenes & pressures**. The focused scene displays its situation, meaningful choice, source attribution, and linked records above the live notes. Scene focus saves with an active desk and survives restarts. Completing a scene and choosing which scene to focus are separate controls, so you can revisit earlier situations freely.

Open a scene reference or a pinned record to read it beside the situation. The reader shows current saved campaign details, including portrayal notes and recorded stats. It stays within the live desk. Closing it returns keyboard focus to the reference button. The reader displays your saved rules notes; it does not validate those mechanics against a game system.

Stable identities follow renamed records. A removed or ambiguous source remains visible as an unavailable link and cannot attach itself to another record with the same name. Player preview excludes the live desk and its private references.

## Keep ideas while using table controls

Pending timestamped log notes, new scene titles and kinds, clock labels and sizes, and clues save while you type. Using a clock, opening a reference, changing scene focus, navigating away, or restarting preserves that work. Each **Add** action commits its own field and leaves other pending drafts intact.

A log note remembers the scene that was in focus when writing began. Switching focus while drafting keeps that original association. Committing adds the timestamped event once and clears the draft. Clearing the text and beginning another note uses the new focused scene. Uncommitted text remains preparation until you add it to the log.

The usual save status applies: check that saving has completed before closing. A failed save retains the existing recovery and current-workspace download options.

## Finish and review

If a log note is pending when you end the session, the confirmation offers **Save note & end session** and explains that it will save the note first. The note then appears in the ended log and the starting recap for consequence review. Other uncommitted capture ideas remain saved with the desk for reference.

Ended desks allow scene and record browsing. Gameplay controls, scratchpad edits, and capture submission are disabled; stale or synthetic UI events also fail the ended-status check. Campaign consequence approval retains its separate review process.

## Verification and limits

Automated tests cover stable and ambiguous identities, normalization, selected notes, first-play copies, repeated starts, capture drafts, scene association, read-only ended state, GM packets, continuity, and player projection. Browser tests use isolated campaigns at 1440, 700, and 390 pixel widths, including a fully offline reload and the reproduced lost-note scenario. Native checks use isolated Windows profiles and packaged code.

This release supplies linked campaign records and saved notes. Scene-specific PDF-page links and live system actions remain separate capabilities. Real table use and additional devices remain part of the broader preparation pilot.
