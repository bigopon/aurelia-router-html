# Router HTML Features and Roadmap

## Purpose

Router HTML is a declarative router for Aurelia applications. The route tree is written in the template, and each `<au-route>` owns the markup, bindings, and nested routes activated by its URL segment.

This document records:

- the behavior currently implemented by the package;
- the syntax and meaning of each feature;
- the six next features proposed for implementation;
- the architectural boundaries those additions must preserve;
- the acceptance criteria required before a feature is considered complete.

The router should remain understandable by reading `RouteContext`, `au-route`, and the environment adapter. New features must not turn it into a centralized navigation transaction framework.

## Design principles

1. HTML remains the primary route configuration format.
2. Nested route structure determines parameter and residue scope.
3. `RouteContext` owns matching state, not browser APIs.
4. Environment adapters own browser history and location integration.
5. Aurelia template features such as binding, `if`, `repeat`, `let`, and slots work normally inside and around routes.
6. Synchronous views remain synchronous. Animation and other asynchronous work are opt-in.
7. Generated links and matched parameters use symmetrical syntax where possible.
8. Every public behavior requires matcher tests, node-based Aurelia tests, and browser coverage where a browser is involved.

---

# Implemented features

## 1. Declarative routes

Routes are declared next to the markup they render.

```html
<nav>
  <a href="/welcome">Welcome</a>
  <a href="/about">About</a>
</nav>

<au-route path="welcome">
  <h1>Welcome</h1>
</au-route>

<au-route path="about">
  <h1>About</h1>
</au-route>
```

The browser adapter can intercept same-origin anchors and update the active route tree without a document navigation.

## 2. Nested routes and residue

A parent route consumes its matching prefix and supplies the unmatched residue to its children.

```html
<au-route path="account">
  <h1>Account</h1>

  <au-route path="profile">
    <h2>Profile</h2>
  </au-route>

  <au-route path="security">
    <h2>Security</h2>
  </au-route>
</au-route>
```

For `/account/security`, the parent matches `/account` and the child receives `/security`.

Markup belonging to the parent remains rendered while sibling child routes swap.

## 3. Index routes

In route declarations, `/`, `.`, and `./` represent the current parent index.

```html
<au-route path="products">
  <au-route path="/">
    Product catalog
  </au-route>
</au-route>
```

For non-index declarations, a plain relative pattern and its `./` form are equivalent:

```html
<au-route path="product">...</au-route>
<au-route path="./product">...</au-route>
```

Both consume `product` from the residue supplied by their parent. A leading slash on an `au-route` declaration remains contextual as well; route declarations always match parent residue.

## 4. Route parameters and scoped `$params`

Named segments are exposed to the view owned by the route that declared them.

```html
<au-route path="users/:userId">
  Parent user: ${$params.userId}

  <au-route path="posts/:postId">
    Child post: ${$params.postId}
    Parent user: ${$route.parent.$params.userId}
  </au-route>
</au-route>
```

Each `<au-route>` creates its own parameter scope. Child `$params` does not silently merge ancestor parameters. Ancestor parameters remain available through the route-context tree.

Parameter values are decoded when matched and encoded when used for href generation.

Named parameters are required by default. Add `?` to make only that segment optional:

```html
<au-route path="products/:id">ID required</au-route>
<au-route path="offers/:id?">ID optional</au-route>
```

The first route requires `/products/123`. The second accepts both `/offers` and `/offers/summer`; href generation omits the optional segment when no `id` is supplied.

## 5. Dynamic route paths

Dynamic paths use Aurelia binding syntax.

```html
<au-route path.bind="routePath">...</au-route>
<au-route path.to-view="routePath">...</au-route>
<au-route :path="routePath">...</au-route>
```

When the bound value changes, the existing route context updates its pattern and refreshes against the current parent residue.

A static `path` that resembles interpolation produces a development warning because interpolation cannot safely express a dynamic route pattern. Dynamic paths must use `path.bind`, `path.to-view`, or `:path`.

## 6. Conditional routes

Routes can be created and removed with Aurelia template controllers.

```html
<au-route if.bind="canEdit" path="edit">
  <h1>Editor</h1>
</au-route>
```

A newly added route immediately checks the current residue. Removing an active conditional route tears down its view and context cleanly.

## 7. Repeated routes

Routes and their links can be generated from application data.

```html
<nav>
  <a repeat.for="tab of tabs" href.bind="tab.path">
    ${tab.label}
  </a>
</nav>

<template repeat.for="tab of tabs">
  <au-route path.bind="tab.path">
    <h1>${tab.label}</h1>
  </au-route>
</template>
```

Adding a matching item activates the new route immediately. Removing an active item removes its view without corrupting sibling render locations.

## 8. Exact matching

Routes normally accept a matching prefix and forward residue to children. `exact` requires the complete path presented by the parent to be consumed.

```html
<au-route path="products" exact>
  Product catalog only
</au-route>
```

At a nested level, exactness applies to the residue supplied by the parent rather than the complete browser URL.

## 9. Fallback matching

A fallback participates only when no regular sibling matches.

```html
<au-route path="*" fallback>
  Nothing matched
</au-route>
```

Fallback selection is evaluated in the current parent context. A nested fallback is active only while its parent is active.

## 10. Single-segment wildcard paths

`*` and `/*` consume one segment and forward any remaining residue to nested routes.

```html
<au-route path="*" fallback>
  <au-route path="details" exact>
    Unknown item details
  </au-route>
</au-route>
```

The optional leading slash does not change wildcard behavior.

## 11. Terminal paths

`**` and `/**` consume the complete remaining path. A static prefix can precede the terminal wildcard.

```html
<au-route path="files/**">
  Path presented: ${$route.$path}
  Terminal segment: ${$params['**']}
  Remaining path: ${$route.residue}

  <au-route path="/" exact>
    The child receives the index residue.
  </au-route>
</au-route>
```

For `/files/guides/router/start.html`:

- `$route.$path` is `/files/guides/router/start.html`;
- `$params['**']` is `guides/router/start.html`;
- `$route.residue` is `/`.

A non-index child beneath `**` cannot match because the terminal route has consumed all remaining segments.

## 12. Route-context APIs

Every active routed view receives `$route`, the nearest `IRouteContext`.

Available state includes:

- `active` — whether the route currently matches;
- `pattern` — the local route pattern;
- `fullPath` — the pattern combined with its ancestors;
- `$path` — the path presented to this context;
- `residue` — the path remaining for children;
- `$params` — parameters captured by this context;
- `parent`, `children`, and `root` — route-tree traversal.

### Href generation

```html
<a au-link=".">Current index</a>
<a au-link="reviews">Reviews</a>
<a au-link="./reviews">Reviews</a>
<a au-link="/products">All products</a>
<a au-link="products/camera">Camera</a>
<a au-link="files/guides/router/start.html">Router guide</a>
```

`reviews` and `./reviews` resolve below the current context. `/products` resolves from the root route context. Concrete paths can directly satisfy required parameters, prefix residue, terminal `**` segments, and fallback routes. Active ancestor parameters are reused automatically.

The custom attribute generates the native `href`, toggles `is-active` using prefix matching, and sets `aria-current="page"` for an exact match. Use an instruction object when generating from a registered pattern and separate application data, or when supplying matching options:

```html
<a au-link.bind="{
  target: '/products/:productId',
  params: { productId: product.id },
  options: { exact: true },
  activeClass: 'selected'
}">
  Product
</a>
```

`$route.href()` remains the lower-level API for non-anchor use cases. Its string targets follow the same rule: no leading slash is context-relative, `./` is an equivalent explicit relative form, and `/` starts from the root context.

Terminal href generation uses the same key as terminal matching:

```ts
route.href('/files/**', { '**': 'guides/router/start.html' });
```

### Registered paths

```html
${$route.getPaths().join(', ')}
${$route.root.getPaths().join(', ')}
```

Paths can be listed from a subtree or from the root context. This includes routes introduced through conditional and repeated templates while they are registered.

## 13. Swap order

Sibling view replacement supports three orders:

- `attach-next-detach-current` — activate the incoming branch before removing the outgoing branch;
- `detach-current-attach-next` — remove the outgoing branch first;
- `parallel` — begin incoming and outgoing work together.

```html
<au-route path="products/:productId" swap-order="parallel">
  <au-route path="specs">Specs</au-route>
  <au-route path="reviews">Reviews</au-route>
</au-route>
```

The default avoids an empty child-stage gap. Swap order can be configured globally and overridden by a route.

## 14. Opt-in route animation

Animation is disabled unless configured or requested by a route.

```html
<au-route path="reviews" animate>
  Reviews
</au-route>
```

Animated views receive enter and leave classes such as:

- `au-route-enter-from`;
- `au-route-enter-active`;
- `au-route-leave-active`;
- `au-route-animating`.

Parallel swap allows outgoing and incoming animations to overlap. Frame callbacks use Aurelia's injected platform, and fallback timing uses the runtime scheduler rather than browser globals.

Without animation or asynchronous lifecycle work, activation and deactivation may complete synchronously.

## 15. Browser history and anchor interception

The browser adapter provides:

- initial `location.pathname` loading;
- `pushState` navigation;
- `replaceState` navigation;
- back and forward handling through `popstate`;
- optional same-origin anchor interception;
- preservation of modified clicks, downloads, external links, and non-self targets;
- path routing such as `/products/ice-cream/reviews`;
- hash-only routing such as `#products/ice-cream/reviews`;
- query-key routing such as `?app=products/ice-cream/reviews`.

Programmatic navigation is available through `IRouteCoordinator`:

```ts
router.load('/products');
router.load('/products', { replace: true });
```

In every mode, matching receives only the route pathname. Route query values and the route hash remain available as URL state without changing which route matches.

## 16. Router configuration

```ts
Routing.customize({
  interceptLinks: true,
  swapOrder: 'parallel',
  animations: false,
  routingMode: 'query',
  routeQueryKey: 'app',
});
```

Configuration controls browser link interception, default swap order, animation behavior, and the browser URL mode. `routingMode` accepts `path`, `hash`, or `query`; `routeQueryKey` names the reserved query parameter used by query mode.

## 17. In-browser documentation playground

The documentation includes editable projects rather than separate, potentially inconsistent source snippets.

Implemented playground behavior includes:

- conventional Aurelia file pairs such as `app.ts`, `app.html`, and `app.css`;
- CodeMirror syntax highlighting and persistent editor state;
- browser-worker compilation with the Aurelia convention preprocessor and `esbuild-wasm`;
- an in-memory virtual filesystem and import resolver;
- isolated sandboxed iframe previews;
- compilation diagnostics and relayed runtime console errors;
- automatic debounced runs with a countdown indicator;
- explicit Run and Reset actions;
- Code, Split, and Preview display modes;
- memory-backed route URLs displayed with the preview;
- embedded playgrounds shared by overview links and focused feature pages;
- compiler-worker and iframe recreation after route reattachment and HMR replacement.

The playground is documentation infrastructure. It must demonstrate package behavior but must not introduce playground-only router semantics.

## 18. Query, hash, and browser URL modes

The coordinator owns a complete route location containing pathname, query, and hash. Matching continues to use pathname only, while every active route context exposes the same read-only location state through `$query`, `$hash`, `$route.$query`, and `$route.$hash`.

```html
<p>Sort: ${$query.get('sort')}</p>
<p>Section: ${$hash}</p>

<a href.bind="$route.href('.', {}, {
  query: { sort: 'price', page: 2 },
  hash: 'reviews'
})">
  Sorted reviews
</a>
```

Href generation can replace query and hash state or preserve the current values explicitly. Repeated query keys and percent encoding round-trip through the read-only query snapshot.

Applications choose how the internal route location maps to the browser URL:

```ts
Routing.customize({
  routingMode: 'path',
});

Routing.customize({
  routingMode: 'hash',
});

Routing.customize({
  routingMode: 'query',
  routeQueryKey: 'app',
});
```

The query-mode key is reserved for the route pathname. Other query values remain route state. Hash mode owns the browser fragment for routing; an internal route hash, when used, follows the routed hash path.

Production browser tests cover direct loading, generated hrefs, intercepted links, Back, and Forward in pathname, hash-only, and configurable query-key modes.

## 19. Active links

`IRouteContext.isActive()` resolves the same registered route targets and parameters as `href()`, so navigation URLs and selected state share one source of truth.

```html
<a au-link="reviews">Reviews</a>
<a au-link="/products">All products</a>
```

```ts
interface RouteActiveOptions extends RouteHrefOptions {
  exact?: boolean;
  matchQuery?: boolean;
  matchHash?: boolean;
}
```

- Pathname prefix matching is the default, allowing parent navigation to remain selected for descendants.
- `exact` requires the complete generated pathname. The root pathname `/` is always treated exactly and does not select every route.
- Query and hash state is ignored by default. `matchQuery` and `matchHash` opt into exact comparison against query/hash values generated by the same options object.
- Static, parameterized, nested, index, and terminal targets use the same parameter inheritance as href generation.
- Disposed route-context targets return false.
- The method is marked with Aurelia's `computed` metadata through a lightweight manual decorator call. Template bindings react to pathname, query, and hash changes without emitted decorator scaffolding.
- `au-link` layers native anchor href generation, active-class updates, and exact `aria-current` state on the context APIs.

The docs sidebar and focused playground example use the public API instead of comparing URL strings locally. Matcher, Aurelia/node, and browser tests cover exact and prefix behavior, URL-state comparison, reactive classes, `aria-current`, and navigation updates.

## 20. Complete wildcard captures

Single- and rest-wildcard matching expose the URL segments they consume through route-local parameters.

```html
<au-route path="folders/*">
  Folder: ${$params['*']}
</au-route>

<au-route path="files/**">
  File path: ${$params['**']}
</au-route>
```

For `/folders/guides`, `$params['*']` is `guides`. For `/files/guides/router/start.html`, `$params['**']` is `guides/router/start.html`.

Wildcard captures follow these rules:

- `*` captures exactly one decoded segment without a leading slash;
- `**` captures zero or more decoded segments without the static prefix or leading slash;
- a prefix-only terminal match exposes `''` for `$params['**']`;
- href generation uses the same `'*'` and `'**'` parameter keys and percent-encodes their values;
- captures remain local to the `<au-route>` that declared the wildcard;
- a pattern cannot contain multiple anonymous wildcards of the same kind because one parameter key could not represent them independently.

```ts
route.href('/folders/*', { '*': 'guides' });
route.href('/files/**', { '**': 'guides/router/start.html' });
```

---

# Remaining proposed features

Proposal numbers preserve their original design identifiers. Proposals 1 through 3 are implemented as features 18 through 20 above, so the remaining list begins with proposal 4.

## Proposed 4. Declarative redirects

### Problem

Common defaults and moved URLs currently require application code or duplicate content routes.

### Design

Add redirect-only route declarations:

```html
<au-route path="/" redirect-to="/welcome"></au-route>
<au-route path="legacy/:id" redirect-to.bind="legacyTarget"></au-route>
```

Rules:

- a redirect runs when its route becomes the selected active match;
- redirects render no branch view;
- relative targets resolve from the redirect route's parent context;
- active parameters are available to generated redirect targets;
- redirects replace history by default so Back does not immediately repeat the redirect;
- an explicit option may request push behavior;
- redirect chains track visited normalized locations and reject loops;
- dynamic `redirect-to.bind`, `redirect-to.to-view`, and `:redirect-to` follow the same binding rules as dynamic paths.

Preliminary syntax for push behavior:

```html
<au-route path="offer" redirect-to="/products/sale" redirect-mode="push"></au-route>
```

### Acceptance criteria

- Absolute, relative, parameterized, nested, fallback, and dynamic redirects work.
- Redirects default to history replacement.
- Redirect loops fail with a useful development error.
- A redirect never briefly renders stale branch content.
- Browser tests cover direct loading, anchor navigation, Back, and Forward.

## Proposed 5. Configurable path adapter

### Problem

`Routing` currently constructs `BrowserPathAdapter` directly. `RouteContext` itself is environment-neutral, but default configuration prevents straightforward SSR, memory routing, WebViews, and application-specific location policies.

### Design

Promote the adapter contract to a public injectable interface.

```ts
export interface IPathAdapter {
  getCurrentPath(): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(callback: (path: string) => void): () => void;
}
```

The final contract will evolve to complete location values when query/hash support is implemented.

Registration options should support either DI registration or an explicit adapter factory:

```ts
Aurelia.register(
  MyPathAdapter,
  Routing.customize({ adapter: MyPathAdapter }),
);
```

The browser adapter remains the default when `IWindow` is available. A memory adapter should be exported for tests, playgrounds, and non-browser hosts.

### Acceptance criteria

- Browser behavior remains unchanged with default configuration.
- A memory adapter runs without `window`, `document`, or global history.
- Server-side creation does not resolve `IWindow` unless the browser adapter is selected.
- Start, stop, push, replace, and subscription ownership are clearly defined.
- Adapter teardown is idempotent and restarting a coordinator resubscribes correctly.

## Proposed 6. Navigation metadata and browser polish

### Problem

Matching and rendering are functional, but production applications also need document titles, fragment scrolling, history scroll restoration, and predictable focus after navigation.

### Design

Deliver this feature in small optional layers rather than placing browser behavior in `RouteContext`.

### Route metadata

Allow static or bound route titles:

```html
<au-route path="products/:productId" title="Product details">
  ...
</au-route>

<au-route path="products/:productId" title.bind="product.name">
  ...
</au-route>
```

Nested title composition belongs to a configurable browser metadata service. Route contexts may expose metadata, but they must not write to `document` directly.

### Hash scrolling

After a successful navigation containing a hash, the browser layer locates the decoded target and scrolls it into view after the active branch is attached.

### Scroll restoration

- Push navigation defaults to the top unless hash navigation selects a target.
- Popstate restores the saved scroll position.
- Applications can configure preserve, top, or manual behavior.

### Focus management

- Navigation may focus an explicitly marked target in the incoming branch.
- A safe fallback can focus the main heading or route container without forcing application-specific semantics.
- Focus behavior is opt-in or configurable and must not steal focus during background URL updates.

### Acceptance criteria

- Route metadata updates after the matching view is ready.
- Nested title composition and dynamic title updates are deterministic.
- Hash scrolling waits for rendered content.
- Back and Forward restore saved positions.
- Keyboard focus moves only under the configured policy.
- All browser behavior is implemented outside `RouteContext` and can be disabled.
- Accessibility-focused browser tests cover focus and document-title behavior.

---

# Recommended implementation sequence

1. Implement proposal 5: make the path/location adapter injectable and export a memory adapter.
2. Implement proposal 4: add redirects using the coordinator and generated-target APIs.
3. Implement proposal 6: add title, scroll, hash, and focus services as optional browser policies.

The complete location model and active-link API are now in place. Adapter injection should precede browser polish so those policies stay outside the matching tree.

# Deferred features

The following remain deliberately outside the immediate roadmap:

- a centralized navigation transaction pipeline;
- guard and lifecycle parity with Aurelia's main router;
- route-name registries before context and path-based generation prove insufficient;
- a large optional-segment or regular-expression pattern language;
- router-owned data loading;
- router-specific replacements for Aurelia template composition and lazy import features.

These can be reconsidered when a concrete application requirement cannot be expressed cleanly with route contexts, adapters, and existing Aurelia composition features.

# Definition of done

A proposed feature is complete only when:

1. its public syntax and TypeScript API are documented;
2. matching behavior remains independent of browser globals;
3. node-level `RouteContext` tests cover state transitions and edge cases;
4. Aurelia node tests cover template scope and lifecycle behavior;
5. browser tests cover history, links, rendering, and accessibility where applicable;
6. the docs overview contains a compact syntax example;
7. a focused editable playground fixture demonstrates the same source that renders the preview;
8. the test checklist records the new guarantees;
9. development and production builds expose the intended `__DEV__` behavior;
10. the complete route tree remains understandable without a separate central route table.
