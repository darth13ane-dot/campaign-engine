# Campaign size and performance

v1.11.0 reduces repeated record lookup, redaction and history work as campaigns grow. Player preview and player search build one temporary identity/name index per projection pass. Each pass applies current sharing permissions, ambiguous-identity checks and wiki-reference redaction. Packet approval fingerprints retain v1.10.0 compatibility.

History compares serialized record baselines and materializes only changed records. It still examines every campaign, including nested edits in inactive campaigns, and keeps independent before/after values for undo. Search builds its index when a query contains searchable words and reuses it until a save, campaign replacement or view-mode change requires a fresh index. Search order, result counts and filters retain their existing behavior.

Autosave uses the browser JSON writer or desktop bridge's synchronous copy rather than first cloning the complete workspace again. Electron documents copied function parameters across its [context bridge](https://www.electronjs.org/docs/latest/api/context-bridge#parameter--error--return-type-support) and structured-clone serialization for [IPC arguments](https://www.electronjs.org/docs/latest/api/ipc-renderer#ipcrendererinvokechannel-args). A packaged-runtime exercise held the first disk write open, edited the live preparation again, and verified both the originally captured revision and the final saved revision.

## Reproduce the data-module benchmark

Run `node scripts/benchmark-workspace.cjs > benchmark-results.json`. It creates synthetic campaigns, measures history, search, projection and desktop storage, and removes its own temporary workspace directory. It does not read existing campaign data. The result includes runtime/hardware information, exact compact JSON sizes, sample counts, medians and ranges. Run performance measurements separately from builds and other tests.

| Fixture | Campaigns | Records per campaign, excluding sessions | Sessions per campaign | Reference pages per campaign | Compact workspace JSON |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ongoing | 1 | 250 | 24 | 100 | 545,214 bytes |
| Long-running | 1 | 4,000 | 200 | 600 | 6,142,630 bytes |
| Four campaigns | 4 | 4,000 | 200 | 600 | 24,570,162 bytes |

Records contain roughly 900 characters of synthetic prose, with approximately two-thirds marked player-known. Each session has four prepared scenes; each reference page contains about 2,000 characters. These fixtures exercise prose and reference text; embedded images, scanned PDFs, large Foundry actor imports and dense relationship graphs need separate measurements.

## Observed results

Measurements on September 19–20, 2026 used Windows x64, an AMD Ryzen 5 5600X and 32 GiB RAM. Node was v24.21.0; browser checks used Chrome 153.0.8010.53 at 1440×1000. The baseline was v1.10.0 (`6ff2e8e`). Timings below are milliseconds. Node medians use seven samples after two warmups; browser medians use five samples after one warmup. Browser render measurements include scripting and DOM updates, with paint and user-perceived interaction latency requiring further measurement.

| Operation | Fixture | v1.10.0 | v1.11.0 |
| --- | --- | ---: | ---: |
| History check, unchanged records (Node) | Long-running | 20.71 | 5.18 |
| History check, unchanged records (Node) | Four campaigns | 91.50 | 30.82 |
| History capture, one edited record (Node) | Four campaigns | 97.56 | 28.05 |
| Player projection (Node, active campaign) | Long-running | 806.14 | 34.02 |
| Player dashboard render (Chrome) | Long-running | 562.8 | 27.0 |
| Player search, fresh index and results (Chrome) | Long-running | 377.9 | 26.4 |
| Browser save | Ongoing | 4.5 | 2.4 |

GM search remains fast in these fixtures, with observed long-running fresh-index results of 8.7 ms before and 11.8 ms after; its search algorithm is unchanged. Empty search now avoids indexing entirely. Timing variation across runs reinforces that these are workstation observations, rather than guaranteed latency or capacity limits.

The packaged Electron 37.10.3 runtime saved the four-campaign fixture, retained all 2,400 reference pages and imported-detail markers, and reopened the final preparation revision after a process restart. Its measured preparation render median was 42.7 ms, complete save median 646.7 ms, and player search median 35.5 ms. One observed restart from process launch to an enabled workspace took 1.51 seconds. Large previous-save recovery also passed its review and restore flow. The full save still crosses the renderer bridge and reads/writes workspace JSON; larger libraries need additional storage work.

## Browser capacity and recovery

In v1.11.0, the ongoing fixture saved successfully in Chrome; the 6.14 MB and 24.57 MB fixtures exceeded its `localStorage` quota. v1.12.0 migrates the browser workspace to IndexedDB, retaining the exact legacy workspace and recovery copy. Each committed save atomically replaces the current workspace and its previous automatic save. [Browser storage and recovery](BROWSER_STORAGE.md) documents that migration and its safeguards.

On September 20, 2026, Chrome 153.0.8010.53 saved and reloaded the 24.57 MB four-campaign fixture, including 16,000 records, 800 sessions, 2,400 reference pages, and a synthetic imported-detail marker. A full browser process restart reopened it offline and retained a further offline preparation edit. Crashing the renderer while a real transaction was uncommitted preserved the exact previously committed primary and previous copies. A transaction-abort check retained unsaved status and allowed a successful retry.

Two tabs loading the same revision cannot silently overwrite each other's later commits. Browser checks exercised rejected stale saves and restores, download of the stale draft, explicit reload, and preservation of an older app's separately edited workspace. Desktop and 390px recovery controls were inspected. The measured fixture is one verified example on one workstation; mobile devices, other browsers, eviction, power loss, and larger real libraries need separate verification.

When a browser save fails, GM view keeps a visible **Download current workspace** action. The download contains the current in-memory workspace, including unsaved preparation. A quota failure preserves the previous saved bytes; downloading keeps the unsaved indicator active until a save succeeds. Further editing retains the warning before closing. Player preview hides and rejects the full-workspace download action.

Wait for **Saved** before closing. If browser storage is full or unavailable, download current work, open the Windows app, choose **Restore backup**, and review the incoming campaigns before confirming. The browser still serializes the complete workspace and stores additional recovery copies; available capacity varies by browser, device, and origin. External backups remain necessary for recovery after site-data removal or eviction. See [MDN's storage guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). The app does not currently request a persistent-storage grant.
