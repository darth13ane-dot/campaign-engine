# Campaign Engine Project Instructions

## GitHub Publishing

- After completing and validating any requested code or documentation change, commit the scoped files and push the finished change to the GitHub repository.
- Do not leave completed requested work only in the local workspace unless the user explicitly asks not to publish it.
- Before pushing, fetch the remote branch and confirm the local history is a direct continuation of the GitHub history.
- When `package.json` is bumped for a release, create and push the matching `vX.Y.Z` tag and verify the GitHub Actions release, update manifest, and downloadable portable asset.
- Never force-push or rewrite published history unless the user explicitly requests it.
- If publication fails, preserve the local commit and give the user the exact failing command, error, and repair steps.
