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

2. Update `version` in `package.json`, then synchronize the lockfile:

   ```sh
   npm install --package-lock-only --ignore-scripts
   ```

3. Commit and push the release change, then create and push the matching tag:

   ```sh
   git commit -am "chore(release): 0.1.1"
   git tag v0.1.1
   git push
   git push --tags
   ```

4. In GitHub Actions, open **Publish npm package** and choose the `v0.1.1` tag as the workflow ref. Enter `v0.1.1` for the tag input, type `PUBLISH` for confirmation, and run the workflow.

5. Approve the pending `npm-publish` environment deployment. The workflow validates the library and docs, packs the package, then publishes it as npm's default `latest` tag.

## If a release fails

Do not reuse the same version. Fix the issue, increment the version, create a new matching tag, and run the workflow again. npm versions are immutable once published.
