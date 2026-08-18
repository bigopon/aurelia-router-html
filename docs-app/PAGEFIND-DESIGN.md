# Pagefind search design

## Goal

Provide fast, static documentation search without making an external search provider part of the documentation runtime.

## Build pipeline

The normal Vite build still produces the client-side documentation SPA. A second, build-only step starts the same Aurelia route tree in Node with jsdom and a `MemoryPathAdapter`. It renders each documentation path into `.pagefind-source/<path>/index.html`. The main documentation panel is marked with `data-pagefind-body`, so navigation and browser chrome are excluded from the index. Pagefind writes its assets into `dist/pagefind`.

The docs application owns jsdom, Aurelia's browser platform, and Pagefind as build-only dependencies. They are not part of the browser runtime bundle.

The temporary pages are search input only; they are not deployed and do not need hydration support. The deployed application continues to boot from `index.html` and serves Pagefind's generated index and UI assets.

The browser loads Pagefind's generated UI lazily into the documentation sidebar. During local development, before a production index exists, the missing generated assets are ignored and the guide remains usable.

## Route policy

Every static documentation page is rendered. `/playground` is intentionally excluded: it starts a worker, embeds an iframe, and persists browser state, none of which improves documentation search. Search results still link to normal SPA URLs.

## Runtime boundaries

The renderer uses the same page components and route declarations as the browser app, but replaces browser history with `MemoryPathAdapter` and disables title, scroll, focus, and animation services. This keeps routing behavior in scope while keeping browser-only effects out of the build.

The browser bootstrap remains responsible for registering `PlaygroundPage`. The renderer does not register it because the playground route is excluded.

## Failure policy

Rendering or indexing errors fail the docs build. A stale index must never be deployed. The generated `.pagefind-source` directory is disposable and is recreated on every build.

## Verification

`npm run build` in `docs-app` must produce `dist/pagefind/pagefind.js` and a rendered HTML file for every route listed in `scripts/render-for-search.mjs`. The docs end-to-end suite continues to verify client-side navigation.
