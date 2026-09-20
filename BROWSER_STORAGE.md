# Browser storage and recovery

From v1.12.0, Campaign Engine stores browser workspaces in IndexedDB. Preparation, campaign records, reusable templates, player-packet drafts, and imported Archivist details stay together. The Windows app continues using its AppData workspace files. Credentials remain separate from workspace backups.

## Opening an existing workspace

Open the updated app at the same site address in the same browser profile. The first load copies the earlier localStorage workspace and recovery data into the database before replacing those keys with migration markers. Both original strings remain available under **Settings → Browse recovery copies**. Existing campaign and source identities are retained.

Editing becomes available after the workspace opens. If migration is interrupted, retry loading: already copied originals remain in the database and partial marker writes can resume. If the original workspace is damaged, the recovery screen offers its exact saved text and compatible recovery copies. A reviewed recovery preserves damaged originals before committing replacement data. A future workspace or database format requires a compatible app version.

Migration markers make v1.11.0 reject the obsolete localStorage copy. Continue using v1.12.0 or later after migration. Downloaded workspace backups retain schema version 1; restoring one through an older app creates a separately managed copy. An older tab that was already open can still save its old branch. The current app detects that change, stops saving, and preserves the branch when you explicitly reopen the saved workspace.

If the browser database is missing while migration markers remain, the app asks for a downloaded backup. Structural damage to the database record itself leaves its contents untouched; restore an external backup in another browser profile or the Windows app. Avoid clearing the affected profile while investigating recoverable data.

## Saving and closing

Each successful save updates the primary workspace, its previous automatic save, and a revision token in one transaction. The writer captures the workspace before asynchronous work starts; an edit arriving during saving becomes the next queued revision. **Saved** appears after the transaction completes. A failed or aborted transaction retains the prior committed copies and keeps unsaved changes visible.

Wait for **Saved** before closing the tab or app window. The app starts a flush when hidden and requests a close warning while changes remain unsaved. Browsers can terminate pages without delivering those events, especially on mobile devices; a close warning is additional assistance. Keep regular downloaded backups. See MDN's [transaction lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) and [beforeunload limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).

## When two tabs disagree

Use one tab for active editing. Every save checks the revision it originally opened against the current committed revision. A changed revision blocks the write, including a restore reviewed before another tab's save.

1. Use **Download current workspace** to keep the unsaved draft from the tab showing the warning.
2. Choose **Reload saved workspace** and confirm. At a protected startup screen, use **Open saved workspace**.
3. The latest saved workspace opens. The discarded tab draft stays in the file you downloaded; differing older-app data appears in Recovery copies.
4. Review and transfer any material you want to retain deliberately. Restoring an entire downloaded draft replaces the current workspace after its own preview and confirmation.

The reload clears pending restore and Archivist import reviews. Applying imported campaign changes still requires the normal field-by-field review.

## Recovery copies and limits

| Copy | Retention and use |
| --- | --- |
| Previous automatic save | The primary data from the immediately preceding committed save. A subsequent save replaces this slot. |
| Original workspace and recovery copy | Exact localStorage data copied during the first migration. Later saves retain these originals. |
| Preserved damaged data | Original workspace text retained before an explicitly reviewed recovery. Download it for manual repair. |
| Older-app branch | Differing localStorage text retained when a conflicting older app's save is explicitly resolved. |
| Downloaded backup | An external JSON file you control, suitable for reviewed restore in the browser or Windows app. |

**Preview copy** uses the same validation and confirmation as importing a backup. **Download copy** retains the original stored text, including malformed copies that cannot be previewed. Recovery content and complete-workspace downloads are available in GM view.

The verified Chrome fixture contains four campaigns, 16,000 records, 800 sessions, and 2,400 reference pages: approximately 24.57 MB of compact JSON. It survived full browser restart and offline editing. Aborting a real transaction and crashing the renderer before commit retained both previously committed copies. These checks cover synthetic data on one Windows workstation; power loss, other browsers, mobile devices, eviction, and larger real libraries require additional verification. See [PERFORMANCE.md](PERFORMANCE.md).

IndexedDB still uses browser-managed storage. The app currently does not request a persistent-storage grant. Site-data clearing, private-profile closure, or browser eviction can remove the workspace and all internal recovery copies together. Storage also belongs to a particular origin and profile; use export and reviewed restore when changing either. Available capacity varies, and every save still serializes a complete workspace plus retained copies. MDN documents [quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). External backups provide recovery beyond the browser profile.

## Verification

`pnpm test` covers exact migration originals, empty workspaces and templates, 24 MiB payload capture, transaction abort after a successful put request, interrupted marker writes, stale tabs, older-app branches, damaged data, future formats, missing migrated databases, and database upgrades. The save-controller test covers clearing a discarded draft only after any active write has finished.

Release interaction checks additionally exercise the real browser database, full process restart, offline preparation, stale restore previews, rescue downloads, renderer interruption, narrow recovery layouts, and the packaged Windows persistence path. Test data and browser profiles are isolated from existing campaign work.
