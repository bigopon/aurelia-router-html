# Release plan

## Release shape

- Publish as `aurelia-router-html`.
- Keep the repository directory unchanged; only the npm identity and public import examples change.
- Start with `0.1.0-rc.0` on the npm `next` tag while Aurelia 2 is an RC.
- Keep `private: true` until every release gate below passes.
- Treat Aurelia packages as peers so an application owns one Aurelia runtime. Develop and test against exact published versions.

## Current state

- The package name and documentation imports use `aurelia-router-html`.
- Runtime imports reference the scoped Aurelia packages that own each API.
- Manifests target Aurelia `2.0.0-rc.2`; the router peer range starts at RC.2.
- No additional router feature is committed in `FEATURES-AND-ROADMAP.md`. Release hardening is the current priority.
- The current root `build` creates the example application. It is not a library or publishing build.
- The repository has no package README, license file, library exports, declaration build, or publish artifact allowlist yet.
- The npm name and published RC.2 compatibility still require a successful registry-backed check. Local registry access timed out during this pass.

## Release gates

### 1. Public package contract

- Confirm that `aurelia-router-html` is available in the npm registry and reserve it if appropriate.
- Add README, license, repository, bugs, homepage, keywords, and Node engine metadata.
- Decide whether the initial version is `0.1.0-rc.0`; do not imply API stability with `1.0.0`.
- Add `files`, `exports`, `types`, `sideEffects`, and `publishConfig.access` metadata.

### 2. Library artifacts

- Separate `build:example` from `build:package`.
- Emit development and production ESM entry points plus declarations from `router/index.ts`.
- Keep Aurelia peer packages external to the bundle.
- Define `__DEV__` as `true` for development output and `false` for production output.
- Make `npm pack --dry-run` contain only public artifacts, source maps if intentional, README, license, and package metadata.

### 3. Published Aurelia compatibility

- Replace the root `node_modules` workspace junction with a normal npm install.
- Generate and commit a root lockfile resolved to published Aurelia `2.0.0-rc.2` packages.
- Refresh the docs-app lockfile and install from npm at RC.2.
- Verify installed Aurelia package directories are ordinary npm packages, not links into the sibling Aurelia repository.
- Run typecheck, node tests, matcher tests, browser tests, docs typecheck, docs build, and docs browser tests.

### 4. Consumer smoke test

- Pack the exact tarball intended for publication.
- Install it into a minimal application created outside this repository.
- Verify production bundling, development diagnostics, `Routing.customize()`, `<au-route>`, and `au-link` using only public imports.
- Run the smoke application in a real browser and test direct entry, refresh, back, and forward navigation.

### 5. Publish and verify

- Remove `private: true` only in the release change.
- Publish the RC with `npm publish --tag next --provenance` when the publishing environment supports provenance.
- Install the published version into the smoke application and repeat the browser check.
- Publish documentation that uses the same released version and record the supported Aurelia range.

## Required validation

```text
npm run build:package
npm run typecheck
npm run test:node
npm run test:matcher
npm run test:e2e:ci
npm --prefix docs-app run typecheck
npm --prefix docs-app run build
npm --prefix docs-app run test:e2e:ci
npm pack --dry-run
```

The release must be stopped if any validation resolves Aurelia from the sibling source workspace rather than from the packed npm dependencies.
