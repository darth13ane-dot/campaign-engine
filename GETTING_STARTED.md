# Start preparing and recover your work

A new public installation opens with an empty workspace. Choose **Create a campaign**, **Choose backup file**, **Explore example campaign**, or **Connect Archivist**. Existing saved work opens as usual, including edited examples and workspaces with no campaigns.

## Start with the next session

Choose **Create a campaign** and enter its title and game system. The premise is optional. Set the number, title, and date of the next session; an ongoing campaign can begin here at any session number.

**Create & prepare** opens that session's preparation workspace. Write an opening situation, add scenes and useful references, or choose **Use a template**. Preparation saves locally as you work. See [Session Prep](SESSION_PREP.md) and [Prep templates](PREP_TEMPLATES.md) for the full workflow.

**Explore example campaign** adds an editable copy of Ashes of Veyr. Its edits survive restarts and updates. Starting a new campaign adds it alongside existing work. Deleting the last campaign returns to the welcome screen and retains workspace settings and custom templates.

**Connect Archivist** opens the existing integration from an empty workspace. The Windows app can fetch campaign records for a field-by-field review. Apply the reviewed import to add campaign context, then prepare a session. Connection and provider authorization remain separate from local preparation.

## Keep a recovery copy

Use **Settings → Back up workspace** to export a complete JSON backup. It contains campaign records, session plans and progress, player-packet drafts, custom templates, and imported Archivist details. Keep private backups in a location you control. Credentials stored in the Windows credential store or optional browser key vault are separate.

Windows stores the workspace in its private AppData directory and maintains a previous automatic save. **Create local safety copy** adds a named recovery file. The app retains the twelve newest supported safety copies; unreadable or unsupported copies are preserved for manual recovery. **Open data folder** opens their location.

The browser keeps the previous automatic save in IndexedDB. On its first storage upgrade, it also retains the exact original workspace and recovery copy. **Browse recovery copies** lists these and any preserved damaged or older-app copies, with individual downloads. Download regular backups to retain additional versions and recover after browser data is cleared.

Wait for **Saved** before closing the browser. If saving fails, use **Download current workspace** in the warning above the page. This includes your latest unsaved changes; the save indicator clears after a successful save. For a storage-full warning, restore the downloaded backup in the Windows app to continue. [Campaign size and performance](PERFORMANCE.md) describes measured examples and storage limits.

If another tab has saved a newer workspace, download your unsaved work, then choose **Reload saved workspace** and confirm. This opens the latest committed copy and clears the stale draft from the current tab. Older-app changes are retained in Recovery copies for separate review. Keep active editing in one tab; review and transfer any wanted material from a downloaded draft deliberately. [Browser storage and recovery](BROWSER_STORAGE.md) explains migration, offline use, conflicts, and recovery limits.

## Review and restore

1. Choose **Restore backup** in Settings, or **Choose backup file** on the welcome screen.
2. Select a JSON backup. The app checks its workspace version, campaign identities, and supported record and planning containers before showing a preview.
3. Review the campaign names, systems, session and record counts, and custom-template count. An empty workspace is a valid restore target.
4. Choose **Restore this workspace** to replace current campaigns, plans, settings, and templates. **Keep current workspace** cancels the preview.

The current workspace remains active during review. A changed current workspace requires a fresh preview. Restoration saves a recovery copy before replacing the primary data; a failed replacement keeps the current workspace active. Successful restoration returns to the overview or welcome screen.

**Browse recovery copies** opens the desktop's safety copies and previous automatic save, or the browser's automatic and preserved copies. Choose **Preview copy**, then follow the same review and confirmation. Copies that cannot be opened show their error. Browser recovery data can also be downloaded in its original form.

## When saved data needs attention

A failed load opens **Recover your workspace** and protects the saved data from ordinary edits. Try **Retry loading**, preview a recovery copy, or choose a valid downloaded backup. In the browser, **Download saved data** preserves the exact original text for recovery. On Windows, use **Open data folder** to access preserved files.

An explicitly confirmed recovery can replace damaged primary and previous workspace data after preserving both originals: separate files on Windows, or downloadable preserved records in the browser database. Storage errors stop replacement. A workspace, browser database, or session workflow created by a newer, unsupported format requires a compatible application version; the original remains protected. If the browser database itself is structurally damaged, use a downloaded backup in another browser profile or the Windows app.

Missing or duplicate campaign identities, malformed record lists, and malformed planning containers require a corrected backup. Work on a copy of the file. The error identifies the offending area; current data remains intact.

Recovery and restore previews contain GM information and are hidden in Player preview. Local preparation and recovery remain available offline once the browser application is cached. The Windows application includes these runtime assets.
