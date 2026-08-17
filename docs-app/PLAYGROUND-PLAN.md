# Browser Playground Plan

## Goal

Add a real in-browser playground to the Router HTML documentation. Users should be able to edit a normal Aurelia project made from files such as `main.ts`, `app.ts`, `app.html`, and `app.css`, then run it without a server-side compiler or a third-party playground service.

The playground must preserve Aurelia conventions. It must not require users to replace conventional file pairs with playground-specific inline component definitions.

## Recommended Architecture

Do not run Vite itself in the browser. Reproduce its relevant pipeline with Aurelia's convention preprocessor and `esbuild-wasm` over an in-memory filesystem.

```text
Editor files
    |
    v
Compiler Web Worker
    |- Aurelia convention preprocessing
    |- virtual import resolution
    `- esbuild-wasm bundling
    |
    v
JavaScript + CSS + diagnostics
    |
    v
Isolated preview iframe
```

The Vite plugin remains the Node/Vite adapter. The playground becomes another adapter around the same convention API.

## What the Aurelia Vite Plugin Does

The Vite plugin is a thin integration layer. It:

1. Filters supported TypeScript, JavaScript, and template files.
2. Calls `@aurelia/plugin-conventions` for source transformation.
3. Uses filesystem checks to discover conventional pairs such as `app.ts`, `app.html`, and `app.css`.
4. Rewrites template imports to Vite virtual `.$au.ts` modules for production builds.
5. Reads those virtual modules from disk.
6. Redirects Aurelia imports to development package exports during development.
7. Delegates CSS loading, module resolution, bundling, and HMR to Vite.

The `.$au.ts` convention is a Vite/Rollup integration detail. It is unnecessary in the playground because the virtual esbuild loader can load `.html` files as generated JavaScript modules directly.

## Convention Transformation

For a conventional pair:

```ts
// app.ts
export class App {
  public message = 'Hello';
}
```

```html
<!-- app.html -->
<h1>${message}</h1>
```

The resource preprocessor effectively produces:

```ts
import * as view from './app.html';
import { customElement } from '@aurelia/runtime-html';

@customElement(view)
export class App {
  public message = 'Hello';
}
```

The HTML preprocessor turns `app.html` into a JavaScript module containing:

- The custom-element name.
- Template text.
- Template dependencies.
- Bindables and aliases.
- Containerless and shadow DOM metadata.
- Conventional stylesheet imports.
- A `register()` function.

The playground should use these same transforms instead of maintaining a separate approximation of Aurelia conventions.

## One Environment-Neutral Convention API

A separate `@aurelia/plugin-conventions/browser` entry is not required. Prefer one public, environment-neutral API that every adapter uses.

The root package must not statically import Node-only modules. Merely adding a host argument while retaining root-level `fs`, Node `path`, or `process` imports would still make the package unsuitable for a browser bundle.

Introduce a host such as:

```ts
export interface IConventionFileHost {
  fileExists(importer: string, specifier: string): boolean;
  readFile(importer: string, specifier: string): string;
}

export interface IConventionEnvironment {
  dev: boolean;
}

export function preprocess(
  unit: IFileUnit,
  options: IOptionalPreprocessOptions,
  host: IConventionFileHost,
  environment: IConventionEnvironment,
): ModifyCodeResult | undefined;
```

The final API shape can combine `host` and `environment` with the options object, but the dependencies should remain explicit and testable.

Required internal changes:

1. Remove default imports of `fs` from the convention preprocessor graph.
2. Move Node filesystem access into the Vite, Webpack, Parcel, Gulp, and test-runner adapters.
3. Replace Node `path` usage in the core transform with portable path operations suitable for normalized POSIX virtual paths.
4. Replace `process.env.NODE_ENV` checks with an explicit option.
5. Keep HMR code generation optional and adapter-provided.
6. Keep experimental template type checking disabled in the initial playground.
7. Preserve the TypeScript AST and parse5 transformations so browser and Node builds have identical convention behavior.

The browser host will resolve files from a `Map<string, string>`. Node adapters will resolve files from disk.

Until the environment-neutral API is available in a release, the documentation app will vendor the locally built browser-safe ESM entry. This temporary copy is used only by the browser compiler. The released Vite plugin and its Node convention dependency remain unchanged.

## Compiler Worker

The editor sends a complete project snapshot to a dedicated worker:

```ts
interface PlaygroundCompileRequest {
  entry: string;
  files: Record<string, string>;
}
```

Example:

```ts
{
  entry: '/src/main.ts',
  files: {
    '/src/main.ts': '...',
    '/src/app.ts': '...',
    '/src/app.html': '...',
    '/src/app.css': '...',
  },
}
```

All virtual paths should be normalized POSIX paths regardless of the host operating system.

The worker should initialize `esbuild-wasm` once and run esbuild in that worker with its nested worker disabled.

### Virtual esbuild plugin

Implement `onResolve` and `onLoad` handlers:

- `.ts`, `.tsx`, `.js`, and `.jsx`: run convention preprocessing before passing the result to esbuild.
- `.html`: run Aurelia HTML preprocessing and return the generated JavaScript module.
- `.css`: return CSS for bundling and collection.
- Shadow CSS imports: return the stylesheet as a string module.
- Relative imports: resolve against the in-memory file map.
- Extensionless imports: apply the same supported extension order as the convention plugin.
- Aurelia package imports: redirect to generated playground runtime shims.
- Router HTML imports: redirect to the current playground runtime shim.
- Unsupported bare imports: return a clear diagnostic rather than attempting arbitrary npm installation.

Use compiler settings equivalent to:

```ts
{
  bundle: true,
  format: 'esm',
  target: 'es2022',
  write: false,
  sourcemap: 'inline',
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
  },
  define: {
    __DEV__: 'true',
  },
}
```

Return structured diagnostics with file, line, column, severity, and message so the editor can highlight the failing source.

## Aurelia and Router Runtime Bundle

The browser compiler should not implement arbitrary npm resolution. Generate a playground runtime during the docs build containing:

- `aurelia`
- `@aurelia/kernel`
- `@aurelia/runtime`
- `@aurelia/runtime-html`
- `@aurelia/template-compiler`
- Router HTML

Build these together so every exposed package shares the same internal Aurelia module instances. Building each package independently could duplicate DI keys, metadata stores, or runtime classes.

Expose generated shim modules for the package specifiers users can import. The esbuild virtual resolver maps bare imports to those shims.

The playground runtime should use development Aurelia exports and define `__DEV__` as `true`.

## Preview Isolation

Create a new preview iframe for every Run or Reset. Full replacement avoids:

- Custom-element definition collisions.
- Old Aurelia containers and controllers.
- Router subscriptions surviving recompilation.
- Stale browser history.
- Playground-specific HMR complexity.

Router HTML uses real `window.history`, so the strongest arrangement is a separate preview origin:

```text
docs.example.com
playground-preview.example.com
```

Local development can use separate ports:

```text
localhost:9027  documentation
localhost:9028  playground preview
```

The docs page sends compiled JavaScript and CSS to the preview with `postMessage`. The preview relays console messages, navigation state, startup status, and runtime errors back to the parent.

Do not execute arbitrary editable code in a same-origin iframe with both `allow-scripts` and `allow-same-origin`. That would allow playground code to reach documentation cookies, storage, and parent DOM state.

If a separate preview origin is unavailable initially, use a memory-backed router adapter and an address-bar simulation. Do not weaken iframe isolation simply to obtain `history.pushState()`.

## Playground UI

Provide:

- File tabs or a compact file tree.
- Code editor with HTML, TypeScript, JavaScript, and CSS support.
- Preview panel.
- Initial route input.
- Run button.
- Reset button.
- Console and diagnostic panel.
- Copy project button.
- Resizable editor/preview split.

Examples should be represented as real file maps rather than escaped source strings. The same example definition can then feed:

- The documentation source panel.
- The playground editor.
- Node convention tests.
- Browser end-to-end tests.

## Initial Support Matrix

The first complete version should support:

- `main.ts` entry files.
- Conventional `app.ts` + `app.html` pairs.
- Conventional plain CSS pairs.
- Nested conventional custom elements.
- HTML-only custom elements.
- `<import from="./component">` and `<require>`.
- Custom attributes.
- Value converters.
- Binding behaviors.
- Template controllers.
- Explicit Aurelia decorators.
- Bindable, alias, capture, containerless, and shadow DOM template metadata.
- Shadow CSS loaded as text.
- Local dynamic imports bundled by esbuild.
- Router HTML registration and navigation.
- Normal Aurelia template syntax, including `repeat`, `if`, `let`, slots, and bindings.

Defer initially:

- Vite HMR. Rebuild and replace the iframe instead.
- SCSS, Less, Stylus, and other stylesheet preprocessors.
- Full CSS module behavior.
- Arbitrary npm dependencies.
- Node built-ins.
- Experimental template type checking.
- Production code splitting.

## Testing Strategy

### Aurelia convention package

Run the existing convention fixtures through both:

1. A Node filesystem host.
2. An in-memory `Map<string, string>` host using POSIX paths.

The generated code and metadata should match.

Add explicit coverage for:

- Conventional TS and HTML pairs.
- HTML-only elements.
- Conventional CSS.
- Extensionless template imports.
- Nested resource imports.
- Resource class naming conventions.
- Template metadata.
- Development and production options without global environment reads.

### Playground compiler

Add node/browser tests for:

- Virtual path resolution.
- Convention preprocessing before TypeScript transformation.
- HTML-to-JavaScript modules.
- CSS collection and shadow CSS string loading.
- Aurelia and Router HTML shim resolution.
- Compile diagnostics with source positions.
- Unsupported package diagnostics.

### Playground end-to-end

Use Playwright to verify:

- A conventional `app.ts` + `app.html` project starts.
- Editing HTML changes the preview.
- Editing the view model changes bindings.
- A nested conventional component loads through `<import>`.
- Router HTML links update the preview URL and selected route.
- Reset restores the original files and route.
- Runtime errors appear in the console panel.
- Repeated Run operations create clean Aurelia applications without leftover views or route contexts.
- Preview code cannot access the documentation parent origin.

## Delivery Stages

### Stage 1: Environment-neutral conventions

- Make the convention host a supported public API.
- Remove Node-only imports from the core package graph.
- Update every existing Node/bundler adapter to supply its host and environment.
- Add parity tests using the in-memory host.

### Stage 2: Compiler proof of concept

- Add a worker with `esbuild-wasm`.
- Compile `main.ts`, `app.ts`, `app.html`, and `app.css` from memory.
- Bundle against the generated Aurelia and Router HTML runtime.
- Return JavaScript, CSS, and diagnostics.

### Stage 3: Isolated preview

- Add the preview host and `postMessage` protocol.
- Start and dispose Aurelia applications through complete iframe replacement.
- Relay navigation, logs, and errors.

### Stage 4: Documentation integration

- Add the playground page and editor UI.
- Convert selected docs examples into shared file-map fixtures.
- Add “Edit in playground” links that initialize the playground from those fixtures.

### Stage 5: Broader convention coverage

- Add remaining template metadata cases.
- Add assets and richer CSS handling.
- Add optional TypeScript language-service diagnostics if the compiler cost is acceptable.

## First Implementation Decision

Start in the Aurelia repository by making `@aurelia/plugin-conventions` environment-neutral through the host API. Do not fork the convention logic into Router HTML, and do not begin with a browser-specific package entry unless compatibility constraints later prove that a conditional entry is required.

Once the same transform passes against Node and in-memory hosts, build the playground compiler around that API.

For the pre-release implementation, import the vendored convention build from `docs-app/src/playground/vendor/plugin-conventions/index.mjs`. Replace that copy with the released package import once the upstream API ships.
