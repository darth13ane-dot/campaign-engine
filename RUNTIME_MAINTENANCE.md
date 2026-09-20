# Desktop runtime maintenance

Campaign Engine v1.12.1 pins **Electron 44.4.3**, with Chromium 152.0.7977.130 and Node 24.21.0. On September 20, 2026, this was the current stable release; Electron's supported major lines were 44, 43, and 42. The previous packaged Electron 37.10.3 was outside that support window. Sources: [official release](https://releases.electronjs.org/release/v44.4.3), [release list](https://releases.electronjs.org/), and [support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).

## Build and verify

Use Windows x64, Node **22.12.0 or later**, and the package manager specified in `package.json`.

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm run pack
```

Electron 42 changed its npm package to fetch the development binary when first invoked through its CLI. `pnpm exec electron --version` prepares and checks that binary before native development tests. The workspace explicitly disables Electron install-time build scripts; Windows packaging obtains the pinned runtime through electron-builder. Windows CI repeats the locked install and package check. See the [official migration notes](https://www.electronjs.org/docs/latest/breaking-changes#behavior-changed-electron-no-longer-downloads-itself-via-postinstall-script).

`scripts/verify-package.mjs` checks the packaged version, bundled renderer/PDF/font assets, Archivist proxy version, and exclusion of private campaign snapshots. It also launches the built Windows executable in its Node entry mode to read runtime versions. That probe runs no application startup code and opens no normal workspace profile. A mismatched Electron version fails the package check. Both pull-request validation and the tagged release run this verification.

## Upgrade coverage

The v1.12.1 checks use synthetic campaigns, temporary profiles, and synthetic credentials. Windows credential encryption and the real desktop preload handlers are exercised.

| Exercise | Verified result |
| --- | --- |
| Existing automated suite | All 247 tests pass. |
| Electron 37 → 44 | Existing campaign state, preparation, imported details, and recovery copies reopen; both saved test credentials decrypt and their encrypted files remain byte-identical. |
| Save, export, rollback, and return | Preparation saved under 44 reopens under 37 and again under 44. Workspace exports retain campaign data and exclude test credentials. |
| Native document workflow | Local PDF import and worker, searchable reference text, isolated player preview, and approval remain usable. |
| Desktop boundaries | Script injection and untrusted desktop requests are rejected; navigation, permissions, and custom-program approval retain their tested behavior. |
| Large workspace | Four synthetic campaigns, 16,000 records, 800 sessions, and 2,400 reference pages survive overlapping saves, restart, inactive-campaign undo, and reviewed recovery. |

The upgrade exercise starts the old and new packaged application files under their matching Electron runtimes in the same isolated profile. It verifies application/data compatibility. Native installer replacement and the portable updater's process replacement still need a separate end-to-end OS exercise. Live Archivist authentication and a live Foundry world are separate compatibility checks. The local native test machine is Windows x64 build 26200; broader device and graphics-driver coverage remains a pilot task.

## Keep the runtime maintained

Before each release, check upstream support and security updates, review intervening breaking changes against the APIs used in `electron/`, and select an exact stable version. Update the lockfile without unrelated dependency changes. Keep the app's sandbox, isolated preload, current storage origin, and existing credential store through runtime-only maintenance.

Run the automated suite, package verification, and native prep/document/recovery checks. For a major runtime change, repeat the isolated upgrade cycle with encrypted test keys and preserve an external workspace backup. Verify the published executable, update manifests, and downloaded application files after release. Report untested integration or installer behavior explicitly.

Windows distributions currently require a separately established signing process. Runtime maintenance and verified data compatibility are part of readiness alongside signed releases, useful diagnostics, and GM pilot evidence.
