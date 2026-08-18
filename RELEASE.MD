# Releasing `aurelia-router-html`

## One-time setup

1. Publish the first version locally to claim the npm package:

   ```sh
   npm login
   npm whoami
   npm publish
   ```

2. On npmjs.com, open the package settings and add a GitHub Actions trusted publisher:

   - User: `bigopon`
   - Repository: `aurelia-router-html`
   - Workflow: `publish.yml`
   - Allowed action: `npm publish`

3. In GitHub repository settings, create an environment named `npm-publish` and require your approval before deployment.

The publish workflow uses npm trusted publishing. Do not create or store an npm token in GitHub.

## Future releases

1. Choose the new pre-1.0 version. Use a minor version for breaking changes, such as `0.2.0`, and a patch version for compatible fixes, such as `0.1.1`.

2. From a clean worktree, release the explicit version:

   ```sh
   npm run release -- 0.1.1
   ```

   The command updates `package.json` and `package-lock.json`, commits the
   release, creates the matching `v0.1.1` tag, and atomically pushes the current
   branch and tag to `origin`. It refuses a missing or invalid version, a dirty
   worktree, or an existing local or remote tag.

3. In GitHub Actions, open **Publish npm package** and choose `master` as the workflow ref. Enter `v0.1.1` for the tag input, type `PUBLISH` for confirmation, and run the workflow. The workflow itself checks out and verifies that tag.

4. Approve the pending `npm-publish` environment deployment. The workflow validates the library and docs, packs the package, then publishes it as npm's default `latest` tag.

## If a release fails

Do not reuse the same version. Fix the issue, increment the version, create a new matching tag, and run the workflow again. npm versions are immutable once published.
