# Installable web app

Campaign Engine can also be shared as an installable Progressive Web App (PWA). Users do not need Node.js or an installer. Preparing the hosted files requires Node.js and pnpm so the local PDF library can be included.

1. Run `pnpm install --frozen-lockfile` and `pnpm run prepare:assets`.
2. Host the app's HTML, scripts, styles, `systems/`, and generated `vendor/` folder over HTTPS. For a public deployment, use the empty `release-assets/archivist-data.js` and `release-assets/archivist-details.js` files in the hosted root.
3. Open the hosted `index.html` in Chrome or Edge and allow the first offline cache to finish.
4. Use **Install Campaign Engine** from the browser's address-bar menu.

It then launches in its own window, works offline after its first load, and updates itself when a new version of the hosted files is published. The service worker’s cache name should be bumped for intentional release cutovers if a host does not automatically refresh it.

Opening `index.html` directly remains useful for local viewing, but browsers do not allow PWA installation or background updates from `file://` URLs.

The PDF reader uses browser modules and should be used over HTTP(S) or in the Windows app. Its text, page numbers, and record history are saved with the workspace. v1.12.0 stores browser workspaces in IndexedDB and migrates the earlier localStorage workspace while retaining both original copies. Keep the same site address and browser profile to reopen that workspace. A hosted-site move requires a downloaded backup and reviewed restore on the new site.

Wait for **Saved** before closing. IndexedDB remains browser-managed storage: available space, private browsing, clearing site data, and eviction affect retention. The app reports save failures and offers a download of unsaved work. Keep external backups and use **Reload saved workspace** to resolve a competing tab's save. See [Browser storage and recovery](BROWSER_STORAGE.md) for the migration and recovery workflow and [Performance](PERFORMANCE.md) for measured capacity examples.
