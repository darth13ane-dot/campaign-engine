# Installable web app

Campaign Engine can also be shared as an installable Progressive Web App (PWA). This needs no Node.js or installer build.

1. Host this folder over HTTPS (GitHub Pages, Netlify, Cloudflare Pages, a private web server, or any static host all work).
2. Open the hosted `index.html` in Chrome or Edge.
3. Use **Install Campaign Engine** from the browser's address-bar menu.

It then launches in its own window, works offline after its first load, and updates itself when a new version of the hosted files is published. The service worker’s cache name should be bumped for intentional release cutovers if a host does not automatically refresh it.

Opening `index.html` directly remains useful for local viewing, but browsers do not allow PWA installation or background updates from `file://` URLs.
