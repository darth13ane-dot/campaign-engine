# Installable web app

Campaign Engine can also be shared as an installable Progressive Web App (PWA). Users do not need Node.js or an installer. Preparing the hosted files requires Node.js and pnpm so the local PDF library can be included.

1. Run `pnpm install --frozen-lockfile` and `pnpm run prepare:assets`.
2. Host the app's HTML, scripts, styles, `systems/`, and generated `vendor/` folder over HTTPS. For a public deployment, use the empty `release-assets/archivist-data.js` and `release-assets/archivist-details.js` files in the hosted root.
3. Open the hosted `index.html` in Chrome or Edge and allow the first offline cache to finish.
4. Use **Install Campaign Engine** from the browser's address-bar menu.

It then launches in its own window, works offline after its first load, and updates itself when a new version of the hosted files is published. The service worker’s cache name should be bumped for intentional release cutovers if a host does not automatically refresh it.

Opening `index.html` directly remains useful for local viewing, but browsers do not allow PWA installation or background updates from `file://` URLs.

The PDF reader uses browser modules and should be used over HTTP(S) or in the Windows app. Its text, page numbers, and record history are saved with the workspace. Large libraries can exceed a browser's local storage quota; the save indicator reports failures and workspace export remains available for recovery.
