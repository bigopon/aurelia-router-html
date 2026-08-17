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

Programmatic navigation is available through the current route context:

```ts
$route.load('/products');
$route.load('/products', {}, { replace: true });
```

In every mode, matching receives only the route pathname. Route query values and the route hash remain available as URL state without changing which route matches.

## 16. Router configuration

```ts
Routing.customize({
  swapOrder: 'parallel',
  animations: false,
  routingMode: 'query',
  routeQueryKey: 'app',
});
```

Configuration controls default swap order, animation behavior, and the browser URL mode. `routingMode` accepts `path`, `hash`, or `query`; `routeQueryKey` names the reserved query parameter used by query mode. `interceptLinks: true` is an optional enhancement for plain same-origin `<a href>` links and is not required by `au-link`.

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
- a pattern cannot contain multiple anonymous wildcards of the same kind because one parameter key could not represent them independently; use named `:params` when multiple segments vary.

```ts
route.href('/folders/*', { '*': 'guides' });
route.href('/files/**', { '**': 'guides/router/start.html' });
```

## 21. Injectable path adapters

`IPathAdapter` is the public environment boundary used by the coordinator. Browser history remains the default, while applications can supply an adapter instance, a DI key, a pre-registered `IPathAdapter`, or an adapter factory without resolving `IWindow`.

```ts
const adapter = new MemoryPathAdapter('/dashboard');

Routing.customize({ adapter });

Aurelia.register(
  Registration.singleton(MyPathAdapter, MyPathAdapter),
  Routing.customize({ adapter: MyPathAdapter }),
);

Routing.customize({
  adapterFactory: container => container.get(MyPathAdapter),
});
```

The exported `MemoryPathAdapter` stores complete route locations without `window`, `document`, or global history. Explicit `au-link` clicks load through their local route context, which calls `push()` or `replace()` and applies the route directly. Memory `navigate()`, `back()`, `forward()`, and `go()` represent external location changes and notify subscribers.

Coordinator lifecycle owns the adapter subscription:

- `start()` subscribes and applies the adapter's current location;
- repeated `start()` calls are inert;
- `stop()` unsubscribes idempotently;
- a later `start()` creates a fresh subscription and reapplies the current location.

---

## 22. Declarative redirects

### Problem

Common defaults and moved URLs currently require application code or duplicate content routes.

### Design

Redirect-only route declarations move a matched location without creating a route view:

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

Matcher coverage verifies that re-entrant redirect navigation cancels the stale matching pass. Node-based Aurelia coverage verifies static, parameterized, relative, nested-index, fallback, dynamically bound, replacement, push, and loop behavior. Browser coverage exercises direct loads, plain-anchor navigation, Back, and Forward in pathname, hash-only, and query-key modes.

## 23. Route titles

Static and bound route metadata composes into the browser document title after the active view tree is ready:

```html
<au-route path="products" title="Products">
  <au-route path="camera" exact title.bind="product.name">
    ...
  </au-route>
</au-route>
```

Dynamic titles require `title.bind`, `title.to-view`, or `:title`. Active titled contexts compose parent-first by default. `Routing.customize({ titles: { separator, fallback, compose } })` controls formatting, while `titles: false` disables browser title writes. The default browser adapter enables the title layer automatically; custom and memory adapters opt in with `titles: true` or an options object.

`RouteContext` exposes normalized title metadata without touching browser globals. `BrowserRouteTitleService` owns `document.title`, coalesces matching changes, and waits for asynchronous routed content to attach before publishing the next title. Node tests cover static, nested, dynamic, fallback, and asynchronous behavior. Standalone browser tests cover pathname, hash-only, and query-key adapters.

## 24. Declarative loading lifecycle

Route templates can prepare data before activation and observe the fully activated nested branch:

```html
<au-route
  path="products/:id"
  loading.bind="() => loadProduct()"
  loaded.bind="() => productIsReady()">
  ...
</au-route>
```

These are Aurelia v2 function bindings, not `.call` expressions, so the callbacks retain the application binding context. `loading` runs parent-first before the route view activates. `loaded` runs children-first after the routed template and all asynchronous activation lifecycle work inside it have completed. Both accept `void | Promise<void>` and retain the synchronous fast path when no promise is returned.

## 26. Settled-view scrolling and history restoration

Browser titles, hash scrolling, and history restoration share one injectable route-view settlement boundary. Every activating `<au-route>` joins it, including views with asynchronous Aurelia activation lifecycle. Successful navigation schedules browser work only after all joined views finish.

The default browser adapter enables scrolling. Applications can disable it or configure restoration, native `scrollIntoView` behavior, and alignment:

```ts
Routing.customize({
  scrolling: {
    restoration: 'restore',
    behavior: 'smooth',
    block: 'start',
  },
});
```

Fragment selection follows HTML behavior by checking literal and decoded IDs before legacy `<a name>` targets; `#top` scrolls to the document start. A newer navigation cancels stale queued fragment work. Pathname, hash-only, and query-key URL modes use the same policy.

The default `restore` policy starts push and replace navigation at the top unless a hash target exists. It records each history entry independently and restores its saved position after Back or Forward rendering settles. `top` always starts at the top when no hash target exists, `preserve` retains the current viewport, and `manual` leaves every scroll decision to application code. The service owns native `history.scrollRestoration = 'manual'` only while active and restores the previous browser setting when stopped.

Custom and memory adapters remain browser-independent by default and opt into browser scrolling explicitly.

---

# Feature design and remaining proposals

Proposal numbers preserve their original design identifiers. Proposals 1 through 5 are implemented as features 18 through 22 above. The title, hash-scrolling, and history-restoration layers of proposal 6 are implemented as features 23 and 26; focus management remains. Proposal 7 is implemented as feature 25 below so its transaction and recovery contract remains recorded beside the original rationale.

## Proposed 6. Browser navigation polish

### Problem

Matching, rendering, document titles, fragment scrolling, and history restoration are functional. The remaining browser-polish layer is predictable focus after navigation.

### Design

Deliver this feature in small optional layers rather than placing browser behavior in `RouteContext`.

Titles, scrolling, restoration, and opt-in focus management observe the same completed rendered tree rather than maintaining independent timing heuristics.

### Focus management

- Navigation may focus an explicitly marked target in the incoming branch.
- A safe fallback can focus the main heading or route container without forcing application-specific semantics.
- Focus behavior is opt-in or configurable and must not steal focus during background URL updates.

### Acceptance criteria

- Keyboard focus moves only under the configured policy.
- All browser behavior is implemented outside `RouteContext` and can be disabled.
- Accessibility-focused browser tests cover focus behavior.

## 25. Declarative guards and navigation transactions

Route declarations can participate in navigation without requiring a routed component view-model. Callback expressions use Aurelia v2 function bindings so the application binding context is retained; `.call` is not supported:

```html
<au-route
  path="products/:id"
  can-load.bind="() => canOpenProduct()"
  can-unload.bind="() => canLeaveProduct()">
  ...
</au-route>
```

The guard API belongs to each individual `<au-route>`. A route returning `false` cancels the complete navigation by default, preserving the outgoing URL, history, and rendered tree. Applications can opt a particular incoming route into local denial when its parent owns a meaningful fallback UI:

```html
<au-route path="portal" can-load.bind="() => isSignedIn()">
  <au-route
    path="admin"
    exact
    can-load.bind="() => isAdmin()"
    guard-failure="local">
    <admin-panel></admin-panel>
  </au-route>

  <au-route path="*" fallback>
    <access-denied></access-denied>
  </au-route>
</au-route>
```

`guard-failure="navigation"` is the default. `guard-failure="local"` applies only to `can-load` returning `false`: the denied route and its descendants are excluded for the remainder of that transaction, matching runs again at its immediate parent, and accepted ancestors and other selected branches may commit. A sibling fallback can therefore render at the requested URL. Redirect results remain redirects, thrown errors remain errors, and `can-unload` denial remains transaction-wide because retaining a child while removing its ancestor cannot produce a coherent committed tree.

Local denial commits the requested URL and resolves `load()` with `true`, because the route tree successfully committed its local fallback. If no sibling route or fallback can handle the residue, the accepted parent still commits with an empty child stage and development builds warn about the missing local recovery route. The exclusion exists only for the current transaction, so a later retry reevaluates the denied route normally.

Router HTML does not need to reproduce the component router's global phase ordering exactly. The component router can discover its complete configured route tree before activation, while nested, conditional, or repeated `<au-route>` declarations may not exist until their parent template is staged. Router HTML instead guarantees progressive ordering along each selected declarative branch:

1. run the incoming route's `canLoad`;
2. run its `loading`;
3. stage its template, discovering the selected nested route;
4. repeat the same sequence for that child;
5. commit the URL and staged branch only after the complete discovered branch succeeds;
6. run `loaded` while unwinding children-first.

Outgoing `canUnload` callbacks still run deepest-first before incoming work begins. This protects child scope while it is inspected and ensures a parent is not approved for removal before a child refuses to leave.

The resulting contract keeps the useful semantics of Aurelia's component router without imposing a static route-tree assumption:

- `canUnload` runs deepest-first for active routes that would leave and returns `boolean | Promise<boolean>`;
- `canLoad` runs parent-first for incoming routes and may return `boolean`, a redirect target, or a promise of either;
- `false` cancels the complete navigation without committing a new route tree or browser-history entry unless that route explicitly selects `guard-failure="local"`;
- a `canLoad` redirect uses Router HTML's normal contextual target syntax rather than component-router viewport instructions;
- the implemented `loading` and `loaded` callbacks surround activation after guards approve the navigation;
- unchanged route contexts do not rerun hooks merely because a descendant changes;
- a newer navigation supersedes stale asynchronous guard or lifecycle work safely.

Because a parent `loading` callback may complete before staging reveals a child that later denies navigation, successful loading side effects are not compensated automatically. The staged route tree is discarded atomically, and cancellable application work should use the transition's abort signal.

Guard support uses a navigation transaction boundary ahead of adapter mutation. It is not implemented as a late rendering toggle from `AuRoute.isActive`, because that would commit denied browser history and leave a matched URL partially rendered.

### Loading error recovery

Loading failure is distinct from a guard returning `false`. A thrown error or rejected promise from `loading` fails the navigation and preserves the original error for the caller and navigation-error reporting.

The transaction provides the following recovery behavior:

- retain the outgoing location and rendered branch until every incoming `loading` callback succeeds;
- do not push or replace browser history until guards and loading have completed;
- do not run `loaded` for the failed route or any ancestor waiting for that route;
- discard any staged incoming view and route state, leaving selected links and `$route` state on the outgoing location;
- allow a later navigation, including a retry of the same target, to proceed normally;
- never attempt to roll back arbitrary application state changed by a loading callback. Applications remain responsible for their own side effects and cancellation;
- reject the programmatic navigation result with the original error. Link-triggered navigation must report the same error through one router error-notification path rather than create an unhandled rejection.

If several nested loading callbacks are involved, earlier successful callbacks are not called again as compensation. The route tree is recovered atomically, but application work should use an abort signal supplied by the transition when it needs cancellable network or background activity.

The coordinator delays adapter mutation while the candidate branch is discovered. Outgoing contexts remain mounted during asynchronous guard and loading work. Failed candidates are discarded and the previous route state is reapplied; successful candidates commit history once before outgoing deactivation completes.

### Error recovery

Status: implemented.

Local guard denial provides the matching primitive needed for local error recovery, but loading errors should not silently reuse guard semantics. A denial is an expected authorization decision; an exception carries diagnostic data, must preserve its original identity, and needs an explicit owner.

The error-boundary API should use an Aurelia callback binding on the route that owns the recovery UI:

```html
<au-route
  path="workspace"
  on-error.bind="failure => recoverWorkspace(failure)">
  <au-route path="reports" loading.bind="() => loadReports()">
    <reports-panel></reports-panel>
  </au-route>

  <au-route path="*" fallback>
    Error: ${$route.parent.failure.error.message}
  </au-route>
</au-route>
```

The bindable is named `onError` in TypeScript and maps to `on-error` in markup. The `on-` prefix makes it clear that this is a callback, while `$route.failure` is reserved for observable recovery state. It remains an Aurelia function binding rather than a DOM event, so `.bind="failure => ..."` retains the surrounding binding context.

The public types are:

```ts
type RouteFailurePhase = 'can-load' | 'loading' | 'activation' | 'loaded';

interface RouteFailure {
  readonly error: unknown;
  readonly source: IRouteContext;
  readonly boundary: IRouteContext;
  readonly recovery: IRouteContext;
  readonly phase: RouteFailurePhase;
  readonly signal: AbortSignal;
}

type RouteErrorResult =
  | string
  | false
  | null
  | undefined
  | RouteGuardRedirect
  | { readonly recover: 'local' };

type RouteErrorHandler = (
  failure: RouteFailure,
) => RouteErrorResult | Promise<RouteErrorResult>;
```

`false`, `null`, or `undefined` means that boundary did not handle the error, so resolution continues at its parent. `{ recover: 'local' }` handles the failure without changing the requested URL. A redirect object uses the same contextual target, parameters, and replace options as a guard redirect. An explicit object is preferable to `true`, which does not explain what recovery action the router should perform.

When a descendant guard, `loading`, or pre-commit view activation throws, the router walks from the failing route toward the root and invokes registered boundaries nearest-first. A local recovery excludes only the failing subtree and rematches at the failed route's immediate parent using the transaction-local exclusion mechanism already used by local guard denial.

The recovery UI needs a deliberate data channel. Add read-only `failure: RouteFailure | null` to `IRouteContext`, `RouteState`, and the template `$route`. The failed route's immediate parent is the recovery context and is the single owner of this value; `RouteFailure.boundary` separately identifies which `on-error` handler accepted it. The failure clears when a retry successfully replaces the failed subtree, the recovery context becomes inactive, or the recovery context is disposed. Markup directly owned by the recovery context reads `$route.failure`; a sibling fallback has its own `$route`, so it reads `$route.parent.failure` as shown above.

#### Transaction flow

1. Tag failures with their source route and phase before they reach the coordinator's generic rejection path.
2. Ignore internal navigation cancellation and an already-aborted superseded transaction.
3. Starting at the source, find the nearest route context with an `on-error` callback.
4. Await that callback inside the existing transaction pending count and pass the transaction's abort signal.
5. On an unhandled result, continue to the next ancestor.
6. On a redirect, use the existing redirect transaction path and loop detection.
7. On local recovery, set `failure.recovery` and store the value on the source parent, transaction-locally exclude the source subtree, and rematch that parent.
8. Stage and await the selected fallback normally, including its guards, loading, activation, and loaded callbacks.
9. Commit accepted ancestors, fallback UI, URL, title, selected links, and history once.
10. If no boundary handles the failure, retain today's atomic rollback and reject with the original error.

The coordinator currently receives one combined activation callback, so phase attribution must be added deliberately. `AuRoute` should wrap `loading`, synthetic-view activation, and `loaded` separately with a small internal tagged failure rather than infer the phase from stack traces. `can-load` already executes in the coordinator with its source context available.

Important constraints for that implementation are:

- aborted superseded navigation is cancellation, not a recoverable error;
- `can-unload` errors occur before an incoming transaction and must leave the old tree intact rather than partially recover;
- a recovery callback that throws rejects with an `AggregateError` containing both the original and handler errors;
- `loaded` currently participates in the pre-commit activation boundary, so it can use the same recovery pipeline, while post-commit animation errors cannot safely roll navigation back;
- successful application side effects are never automatically compensated;
- async recovery callbacks increment the existing transaction pending count and observe the same abort signal;
- error boundaries need loop protection when a fallback or recovery view also fails;
- unhandled errors retain today's behavior: atomic rollback, rejected programmatic navigation, and `au-route-navigation-error` for link-triggered navigation.

This is worth introducing only with the failure metadata and nearest-boundary contract together. A boolean `error-failure="local"` without an error owner would render a fallback but make the underlying failure difficult to inspect, log, retry, or present safely.

#### Delivered scope

The coherent pre-commit error-boundary contract ships these behaviors together:

- `on-error.bind` callback registration and nearest-ancestor resolution;
- source and phase attribution for `can-load`, `loading`, activation, and `loaded`;
- unhandled propagation, contextual redirects, and explicit `{ recover: 'local' }` results;
- read-only `$route.failure` state with deterministic clearing on retry, deactivation, and disposal;
- synchronous and asynchronous handlers using the transaction AbortSignal;
- recovery-loop protection and preservation of the original error for unhandled failures;
- Node and real-browser coverage before documenting the feature as implemented.

The following concerns should remain separate follow-up features:

- `can-unload` error boundaries, because they run before the incoming transaction;
- post-commit animation error reporting, because committed navigation cannot roll back;
- router-owned retry counts, delays, backoff, or automatic retries;
- a global logging or telemetry service;
- dedicated error template slots or router-provided error components;
- application-specific status codes, messages, and authorization-error conventions.

This keeps the first public API complete enough to be predictable without coupling recovery to unrelated reporting, retry, or presentation policy.

#### Implementation notes

The implementation tags each pre-commit phase before coordinator error handling, resolves boundaries nearest-first inside the active navigation transaction, and reuses transaction-local exclusion for local recovery. A boundary that already recovered during the transaction is skipped if its fallback fails, allowing the failure to reach the next ancestor without a recovery loop. Node, matcher, standalone browser, and docs playground coverage exercise the complete contract.

### Acceptance criteria

- Synchronous callbacks preserve the existing void fast path; promises are awaited only when returned.
- Nested ordering matches the existing Aurelia router.
- Cancellation leaves the current URL, selected links, rendered branch, and history index unchanged.
- Local `can-load` denial excludes only its subtree, commits accepted ancestors and the requested URL, and allows a sibling fallback to render.
- Relative and root-absolute guard redirects use the same resolution rules as `$route.load()`.
- Node tests cover callback binding context, sync and async hooks, nesting order, cancellation, redirects, and stale navigation.
- Node tests cover synchronous throws and asynchronous loading rejection without changing the committed route.
- Browser tests cover cancellation and redirect history behavior through the browser adapter.

---

# Recommended implementation sequence

1. Add opt-in focus management on the shared settled-navigation boundary.

The complete location model, active-link API, injectable adapter boundary, and declarative redirects are now in place. Browser polish can remain outside the matching tree.

# Deferred features

The following remain deliberately outside the immediate roadmap:

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
