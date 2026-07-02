# Campaign Engine for Windows

Campaign Engine is packaged with Electron as a normal Windows desktop application. The installed build has its own window, Start-menu entry, desktop shortcut, private AppData workspace, backups, and update controls.

## Run the desktop app from this folder

Double-click **Run Campaign Engine.cmd**.

The launcher opens the finished Windows app from `dist` directly. Node.js and pnpm are not required to use it. If no Windows build exists yet, the launcher falls back to the developer version and installs the locked dependencies if needed.

Before opening the app, the local launcher prepares the private AppData workspace from `archivist-data.js` and `archivist-details.js`. On first launch, or when it finds only the two sample campaigns, it loads the Archivist campaigns automatically. A replaced sample workspace is backed up first.

On first launch, Campaign Engine creates its private workspace at:

```text
%APPDATA%\Campaign Engine\campaign-engine-workspace.json
```

When an API key is saved in **Settings → AI connection**, Windows encrypts it for the current Windows account and Campaign Engine stores only the protected value at:

```text
%APPDATA%\Campaign Engine\ai-credential.json
```

The credential stays outside the executable, so both installed and portable launches restore it after restarts and upgrades. Saving AI settings with a new key replaces the protected value; **Clear saved key** removes it.

The local build created by **Build Campaign Engine.cmd** includes the private Archivist snapshot and automatically replaces an untouched demo workspace after making a safety backup. Public release builds created by **Prepare Campaign Engine Release.cmd** deliberately contain empty Archivist snapshot files.

## Build the Windows applications

Double-click **Build Campaign Engine.cmd**.

The script:

1. installs the exact dependencies from `pnpm-lock.yaml`;
2. runs the workspace storage tests;
3. builds the assisted Windows installer;
4. builds the no-install portable executable;
5. generates `latest-portable.json` with its version, size, and SHA-512 checksum.

Outputs appear in `dist/`. Both the installed **Setup** edition and the no-install **Portable** edition can check, download, verify, and install updates from inside Campaign Engine.

For an update release, double-click **Prepare Campaign Engine Release.cmd**. Enter a higher version number and the trusted HTTPS folder that will contain both executables, `latest.yml`, `latest-portable.json`, and the installer blockmap. Release preparation refuses to build without an update feed, then updates `package.json`, refreshes the lockfile, runs the tests, and builds the new Windows artifacts.

## Back up and restore campaign data

Open **Settings → Private data & backups**.

- **Back up workspace** saves a portable JSON backup wherever you choose.
- **Restore backup** validates the file and creates a safety copy before replacing anything.
- **Create local safety copy** writes a timestamped copy under the AppData backup folder.
- **Open data folder** shows the live workspace and automatic previous-file copy.

The encrypted AI credential is intentionally excluded from workspace backups and cannot be decrypted by a different Windows account.

## Automated GitHub releases

The workflow at `.github/workflows/windows-release.yml` runs for tags beginning with `v`.

1. Put this source in a GitHub repository.
2. Change `version` in `package.json`, for example from `1.0.0` to `1.0.1`.
3. Commit the change.
4. Create and push a matching tag:

```text
git tag v1.0.1
git push origin main --tags
```

GitHub Actions tests and builds the app, uploads a workflow artifact, and creates a GitHub Release containing the installer, portable app, `latest.yml`, `latest-portable.json`, and blockmap.

The release build receives this update-feed address automatically:

```text
https://github.com/OWNER/REPOSITORY/releases/latest/download
```

That CI-provided address also replaces an older blank local setting, so existing installations begin using the bundled feed after upgrading.

For automatic updates, those files must be downloadable without an interactive login. A public app-shell repository is safe because private Archivist snapshots are excluded from release builds. Keep workspace backups private.

The portable updater downloads the new portable executable to a temporary staging folder, verifies its exact size and SHA-512 checksum from `latest-portable.json`, closes Campaign Engine, replaces the original executable, and reopens it. A temporary `.previous` copy is removed after the updated app launches successfully.

## Signing

Unsigned personal builds work, but Windows may display an Unknown Publisher warning. For broader distribution, add a Windows code-signing certificate through electron-builder's standard `CSC_LINK` and `CSC_KEY_PASSWORD` secrets in GitHub Actions.
