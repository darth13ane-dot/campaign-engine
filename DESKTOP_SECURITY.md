# Desktop trust and campaign data

Campaign Engine keeps session preparation and campaign records in the local workspace. Optional Archivist, Foundry, and AI connections use the services configured by the GM. Backups contain private campaign material; keep them in a location you control. [GETTING_STARTED.md](GETTING_STARTED.md) describes backup review and recovery.

## Application boundaries

Desktop actions accept requests only from the main Campaign Engine window while it is displaying the bundled application page. This covers workspace reads and writes, recovery copies, saved keys, update controls, external links, and Archivist connections. Requests from other windows, embedded frames, missing frames, or navigated pages are rejected before the action runs. Save-and-close signals use the same checks.

The app retains Electron's sandbox and context isolation with Node integration disabled. Navigation keeps the main window on the application page. Web addresses open in the default browser; executable schemes and addresses containing embedded credentials are rejected. Embedded navigation is limited to the script-free player document preview, which also has its own sandbox and restrictive content policy. Webviews and device, camera, microphone, location, notification, and clipboard-read permission requests are denied.

The application page enforces a Content Security Policy before resources load. JavaScript comes from local application assets; inline scripts, inline event handlers, and JavaScript string evaluation are blocked. PDF support permits WebAssembly compilation and a local worker. Existing UI styles require inline CSS. Interface fonts are bundled with their licenses and work offline; starting the app makes no font-service request. HTTPS images support campaign artwork. Configurable integrations retain HTTP/HTTPS connections, including local Foundry and AI services; this policy does not select or authorize a provider for the GM.

These controls follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security). They are defense layers around the current local application. The desktop still serves its bundled page through `file://`; a future change to a dedicated application protocol must preserve existing origin storage and be tested as an upgrade. v1.12.1 pins Electron 44.4.3 and verifies the runtime inside the built executable. [Runtime maintenance](RUNTIME_MAINTENANCE.md) covers ongoing support checks and the verified upgrade cycle.

## Custom connection programs

The built-in Archivist connection uses the packaged connector and its normal provider sign-in. Advanced settings also support a custom program and arguments. Each attempt to test or sync a custom connection shows a native dialog with the exact program and arguments. **Cancel** is the default; **Run this connection** authorizes that one launch.

A custom program has the same file and process access as the Windows account running Campaign Engine. Review its origin and arguments before running it. Commands exceeding the review length limit are rejected. A saved configuration records the connection settings; running it requires a fresh native decision. The built-in connection is the recommended ordinary workflow.

## Verification and remaining release gates

Automated checks exercise every registered desktop request against foreign windows, child frames, and navigated pages, alongside permitted main-window requests, navigation policy, permissions, external-link parsing, and custom-program cancellation. Browser and packaged-runtime checks verify preparation, PDF import, player previews and downloads, recovery, and offline operation under the content policy. Native checks supply dialog responses from fixtures and exercise a harmless real child program; they verify approval and cancellation behavior rather than visual operation of the operating-system dialogs. Pull requests and changes to `main` run the test suite and verify the Windows package with read-only repository access and no release secrets. Tagged releases also build both Windows distributions and verify their public assets.

The local Player preview is a presentation feature. A future hosted service needs server-enforced accounts, tenant isolation, and GM/player authorization. Signed Windows distribution, representative performance measurements, upgrade and rollback exercises, and GM pilot evidence remain separate readiness gates. Current releases report their actual signing status in release validation.
