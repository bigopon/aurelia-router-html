# Router HTML: Features and Roadmap

## Purpose

Router HTML is a declarative router for Aurelia. Application route structure lives in templates, beside the links, layout, bindings, and content it controls.

The package is designed for applications that do not want to maintain the same route tree twice: once as JavaScript configuration and again as rendered HTML. TypeScript remains the home of application behavior such as data loading, state, and permissions; HTML owns the route topology.

```html
<nav>
  <a au-link="products">Products</a>
  <a au-link="account">Account</a>
</nav>

<au-route path="products">
  <product-list></product-list>
</au-route>

<au-route path="account">
  <account-shell>
    <au-route path="profile">
      <profile-editor></profile-editor>
    </au-route>
  </account-shell>
</au-route>
```

## Design principles

1. HTML is the primary route configuration format.
2. Template nesting defines route nesting, parameter scope, and URL residue.
3. Router features compose with Aurelia bindings, template controllers, scopes, slots, and components.
4. Route matching and state remain independent of browser APIs.
5. Adapters own location, history, and host integration.
6. Links and matching use symmetrical path and parameter syntax.
7. Synchronous views remain synchronous; animation and asynchronous work are opt-in.
8. Navigation either commits a coherent route tree or preserves the previous one.
9. Public behavior requires node coverage and browser coverage where the browser is involved.

## Core model

Each `<au-route>` creates a route context. A context matches the path supplied by its parent, consumes its segment, and gives the remaining residue to its children.

For `/account/security`:

```html
<au-route path="account">
  <h1>Account</h1>
  <au-route path="security">Security settings</au-route>
</au-route>
```

The parent consumes `account`; the child receives and consumes `security`. Parent markup remains mounted while child routes change.

Route declarations are always contextual, even when their `path` begins with `/`. Navigation targets are different: `reviews` and `./reviews` resolve from the current context, while `/products` starts at the root context.

## Route declarations

### Static, index, and dynamic paths

```html
<au-route path="products">Products</au-route>
<au-route path="./products">Equivalent contextual path</au-route>
<au-route path="/">Current parent index</au-route>

<au-route path.bind="routePath">Dynamic path</au-route>
<au-route path.to-view="routePath">Dynamic path</au-route>
<au-route :path="routePath">Dynamic path</au-route>
```

In declarations, `/`, `.`, and `./` mean the current parent index. Other plain and `./` paths are equivalent. Dynamic paths must use binding syntax; interpolation-like static paths produce a development warning.

Changing a bound path updates the existing context and rematches the current parent residue. An invalid replacement is rejected without discarding the previous valid matcher.

### Parameters and constraints

```html
<au-route path="products/:id">Required ID</au-route>
<au-route path="offers/:id?">Optional ID</au-route>
<au-route path="archive/:year{{^\d{4}$}}?">Optional four-digit year</au-route>
```

Parameters are decoded after matching and encoded during href generation. Each route owns only the parameters it captures; a child reads an ancestor parameter through `$route.parent.$params`.

`{{pattern}}` constrains one encoded URL segment with JavaScript regular-expression semantics. It cannot consume `/`. Href generation applies the same constraint, and invalid expressions fail when the route is registered or its dynamic path changes.

### Wildcards and terminal paths

```html
<au-route path="date/*/summary">
  Date: ${$params['*']}
</au-route>

<au-route path="files/**">
  File: ${$params['**']}
  Residue: ${$route.residue}
</au-route>
```

- `*` consumes and captures exactly one segment.
- `**` consumes and captures every remaining segment.
- A terminal route leaves `/` for an index child; a non-index child cannot match.
- A pattern cannot repeat the same anonymous wildcard because its capture key would be ambiguous. Use named parameters for multiple varying segments.
- Optional leading slashes do not change wildcard behavior in route declarations.

### Exact and fallback matching

Routes normally accept a matching prefix and pass residue to children. `exact` requires the complete path supplied by the parent to be consumed.

```html
<au-route path="products/:id" exact>Product</au-route>
<au-route path="*" fallback>Not found</au-route>
```

A fallback participates only when no regular sibling matches in the same parent context. Nested fallback behavior is therefore scoped to its active parent.

### Aurelia template composition

Conditional and repeated routes use ordinary Aurelia template features:

```html
<au-route if.bind="canEdit" path="edit">
  <editor-panel></editor-panel>
</au-route>

<template repeat.for="tab of tabs">
  <au-route path.bind="tab.path">
    <tab-panel tab.bind="tab"></tab-panel>
  </au-route>
</template>
```

Adding a matching route checks the current residue immediately. Removing an active route disposes its view and context without disturbing sibling render locations.

## Links and navigation

`au-link` resolves a registered route target, writes the native `href`, applies an active class, and sets `aria-current="page"` for an exact match.

```html
<a au-link="reviews">Contextual reviews</a>
<a au-link="./reviews">Explicitly contextual reviews</a>
<a au-link="/products">Root products</a>

<a au-link.bind="{
  target: '/products/:id',
  params: { id: product.id },
  options: { exact: true },
  activeClass: 'selected',
  pendingClass: 'is-loading'
}">
  Product
</a>
```

The route context provides the lower-level APIs:

```ts
route.href(target, params, options);
route.isActive(target, params, options);
await route.load(target, params, options);
await route.reload();
await route.reload({ plan: 'replace' });
route.getPaths();
```

`href()`, `isActive()`, redirects, and `load()` share contextual and root-absolute resolution. Active ancestor parameters are reused when possible. `getPaths()` lists currently registered routes below any context, including conditional and repeated declarations.

Active matching uses pathname-prefix semantics by default, allowing a parent link to stay selected for descendants. `exact`, `matchQuery`, and `matchHash` opt into stricter comparison. The root target `/` is always exact.

Plain same-origin anchors may be intercepted with `interceptLinks: true`. `au-link` does not require interception and preserves normal anchor behavior for modified clicks, downloads, external URLs, and non-self targets. A link whose href is the pending destination receives its `pendingClass` (default `is-pending`) and `aria-busy="true"`.

## Route context

Every routed template receives the nearest context as `$route`, with convenience scope values including `$params`, `$query`, `$hash`, and the immutable `$navigation` snapshot.

Important context state includes:

- `active`, `pattern`, `fullPath`, `$path`, and `residue`;
- `$params`, `$query`, and `$hash`;
- `parent`, `children`, and `root`;
- `title` and `failure`;
- `href()`, `isActive()`, `load()`, `reload()`, and `getPaths()`.

Parameters remain local to their declaring route. Query and hash state represent the complete current route location and are shared by active contexts.

## Navigation lifecycle

### Loading and loaded

```html
<au-route
  path="products/:id"
  loading.bind="loadProduct()"
  loaded.bind="productReady()">
  ...
</au-route>
```

Lifecycle bindings are Aurelia expressions, evaluated once per applicable lifecycle pass in the route's live binding scope. `loading` runs parent-first before activation, replacement, or rerun work. `loaded` runs children-first after the complete nested branch and its applicable Aurelia activation or rerun work have settled. An expression may return any value; promises are awaited only when returned. Fulfilled values are exposed in the route template as `$route.data.loading` and `$route.data.loaded`.

Pass the phase-local `$lifecycle` value when an expression needs that context, for example `loading.bind="loadProduct($lifecycle)"`. It contains `kind`, immutable `from`, `to`, and `changes` snapshots, the route, destination params, query and hash, the abort signal, and `previousData`. `kind` is `enter`, `replace`, or `rerun`. The router deliberately does not cache lifecycle results: applications can use `previousData` or their own cache to decide whether a request is needed.

Cancelled and unhandled failed navigations restore lifecycle data to its pre-navigation values. A locally recovered failure may leave the failed route context's last fulfilled lifecycle result available through `previousData`; local recovery does not currently clear that route state.

### Transitioning a matched route

```html
<au-route
  path="products/:id"
  transition-on="params query"
  transition-plan="rerun"
  can-load.bind="transition => canOpenProduct(transition)"
  loading.bind="loadProduct($lifecycle)"
  loaded.bind="productReady($lifecycle)">
  ...
</au-route>
```

When the same route declaration remains active, `transition-on` selects the URL inputs that start a transition. It accepts `params`, `query`, `hash`, `all`, or `none`. The `params`, `query`, and `hash` inputs may be combined with spaces or commas; `all` and `none` are standalone values. Parameters are selected by default; query and hash changes are opt-in.

`transition-plan` chooses the behavior and defaults to `rerun`:

- `rerun` preserves the route context, component, controller, view, and DOM nodes while running `canLoad`, `loading`, and `loaded` again;
- `replace` runs `canUnload` on the current view, prepares the candidate through `canLoad` and `loading`, swaps in a fresh routed view and child branch, and then runs `loaded`;
- `none` updates reactive route values without rerunning lifecycle callbacks or replacing the view.

Every selected transition reuses the normal lifecycle callbacks. They receive one `RouteLifecycleContext`: `kind` distinguishes `enter`, `replace`, and `rerun`; `from` and `to` describe the snapshots; and `changes` lists every actual params, query, and hash difference, not only the inputs that intersected `transition-on`. Fulfilled values continue to use `$route.data.loading` and `$route.data.loaded`, so an application can share one loading function across entry and later parameter changes.

Replacement `canUnload` guards run deepest-first. Every affected guard on an already-declared route then approves before any selected route begins loading or changes its rendered tree. Descendants created inside a fresh replacement run their normal entry guards as that candidate activates; denial or failure still restores the prior URL, route values, view identity, and lifecycle data.

`route.reload()` forces the configured plan at the current location, preserves query and hash state, replaces the current history entry, and reports `reload` in `changes`. `route.reload({ plan: 'rerun' })` or `route.reload({ plan: 'replace' })` overrides the configured plan for that attempt. `load(path, { reload: true })` provides the coordinator-level equivalent.

### Guards and transactions

```html
<au-route
  path="account"
  can-load.bind="() => canOpenAccount()"
  can-unload.bind="() => canLeaveAccount()">
  ...
</au-route>
```

- `canUnload` runs deepest-first for outgoing routes and views selected for replacement.
- `canLoad` runs parent-first for incoming routes and selected matched-route transitions.
- `false` cancels navigation without changing the URL, history, selected links, or rendered tree.
- `canLoad` may return a contextual or root-absolute redirect.
- A newer navigation aborts stale guard and lifecycle work.

The coordinator stages incoming work before mutating the adapter. Successful navigation commits history and route state once; failure preserves the outgoing tree. A denied Back or Forward traversal across router-managed entries restores the prior history cursor instead of replacing the traversed entry, so the forward/back stack remains intact. Navigation API indexes extend exact compensation to older same-document entries; plain History supports the adjacent pre-router predecessor without overwriting it.

`guard-failure="local"` changes only a `canLoad` denial. It excludes the denied subtree for that transaction and rematches siblings at the immediate parent, allowing a fallback to render at the requested URL. `canUnload` denial remains navigation-wide.

### Observable navigation state

`IRouteCoordinator.navigation`, `subscribeNavigation()`, and route-scoped `$navigation` expose one immutable snapshot. It identifies the attempt, pending destination and href, source, abort signal, current phase, and terminal result. Phases are `guarding`, `loading`, `activating`, `settling`, and `committing`; terminal outcomes are `completed`, `cancelled`, `failed`, and `superseded`.

Navigation state is observation rather than policy. Applications may use it for progress, duplicate-action prevention, accessibility announcements, or telemetry. Existing coordinator path subscriptions remain commit-only.

### Error recovery

```html
<au-route
  path="workspace"
  on-error.bind="failure => recover(failure)">
  <au-route path="reports" loading.bind="loadReports()">
    <reports-panel></reports-panel>
  </au-route>

  <au-route path="*" fallback>
    Error: ${$route.parent.failure.error.message}
  </au-route>
</au-route>
```

Pre-commit failures from `canLoad`, `loading`, activation, or `loaded` walk route boundaries from nearest to root. A handler may:

- return nothing to pass the failure to its parent;
- return a redirect;
- return `{ recover: 'local' }` to exclude the failed subtree and rematch its siblings.

The failed route's parent owns the observable `$route.failure`; the failure also identifies its source, accepting boundary, recovery context, phase, and abort signal. Recovery is loop-protected. Unhandled failures preserve the original error and atomic rollback; a throwing handler reports both errors with `AggregateError`.

Router HTML does not compensate application side effects from successful callbacks. Applications should use the supplied abort signal for cancellable work.

## Rendering and browser experience

### Swap order and animation

Sibling replacement supports `attach-next-detach-current`, `detach-current-attach-next`, and `parallel` orders. A route may override the configured default:

```html
<au-route path="products/:id" swap-order="parallel">
  <au-route path="specs">Specs</au-route>
  <au-route path="reviews">Reviews</au-route>
</au-route>
```

Animation is opt-in through route markup or configuration. Animated views receive route enter and leave classes; parallel swap permits both animations to overlap. Frame and timer work use Aurelia's injected platform and scheduler.

### Titles, scrolling, and focus

Browser-facing features wait for the complete routed view tree through one injectable settlement boundary.

- `title` contributes static or bound route metadata to `document.title`.
- Scrolling handles fragments and per-history-entry restoration after rendering settles.
- `au-route-focus` marks the preferred focus target for an incoming route.

Titles and scrolling are enabled for the default browser adapter and configurable or replaceable. Focus management is opt-in. Custom and memory adapters remain browser-independent unless browser services are explicitly enabled.

## Location adapters

`IPathAdapter` is the environment boundary:

```ts
interface IPathAdapter {
  getCurrentPath(): string;
  formatHref(path: string): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(
    callback: (path: string, navigation?: PathNavigation) => void
  ): () => void;
}
```

The optional `PathNavigation` transaction distinguishes an uncommitted intercepted-link `intent` from a host-first Back/Forward `traverse`. Its `commit()` accepts the destination and its `rollback()` restores the last accepted host location. Adapters without this metadata retain the callback-only contract, while adapters that report host-first movement own precise rollback.

The built-in browser adapter supports three URL forms:

```text
path:  example.com/products/ice-cream
hash:  example.com#products/ice-cream
query: example.com?app=products/ice-cream
```

Matching always receives the internal pathname. Query values and an internal hash remain URL state. Query mode reserves a configurable key for the route pathname.

Applications may supply an adapter instance, DI key, pre-registered implementation, or factory. `MemoryPathAdapter` supports non-browser hosts, tests, and embedded previews.

```ts
Routing.customize({ routingMode: 'hash' });

Routing.customize({
  routingMode: 'query',
  routeQueryKey: 'app',
});

Routing.customize({ adapter: new MemoryPathAdapter('/dashboard') });
```

The browser adapter also keeps deployment prefixes outside the internal route tree:

```html
<base href="/my-app/">
```

```ts
Routing.customize({ basePath: '/my-app' });
```

An explicit `basePath` takes precedence; otherwise a same-origin `<base href>` supplies it. The adapter removes the prefix before matching and restores it for generated hrefs. Hash and query modes target the mounted document, and intercepted links outside the mount are left to the browser.

The browser adapter marks router-managed history entries while preserving other `history.state` fields. It delays intercepted-link pushes until navigation succeeds and uses compensating history traversal when Back or Forward is rejected. The memory adapter uses the same commit/rollback semantics with an in-process stack.

## Redirects

Redirect routes render no intermediate view:

```html
<au-route path="/" redirect-to="welcome"></au-route>
<au-route path="legacy/:id" redirect-to="/products/:id"></au-route>
```

Relative targets resolve from the redirect route's parent; a leading slash starts at the root. Active parameters are reused. Redirects replace history by default, may opt into push behavior, support dynamic bindings, and detect normalized redirect loops.

## Documentation playground

The docs playground compiles conventional Aurelia file pairs in a browser worker and runs them in a sandboxed iframe. It uses the same example sources as focused documentation pages so displayed code and behavior cannot drift apart.

The playground is documentation infrastructure, not a separate router runtime. It must not introduce playground-only routing semantics.

## Configuration surface

```ts
Routing.customize({
  swapOrder: 'parallel',
  animations: true,
  routingMode: 'path',
  interceptLinks: false,
  titles: true,
  scrolling: { restoration: 'restore' },
  focus: { fallback: 'heading' },
});
```

The public configuration covers rendering order, opt-in animation, browser URL mapping, optional plain-anchor interception, titles, scrolling, focus, and custom adapters. Route-specific markup can override behavior that belongs to an individual branch.

## Roadmap

Navigation lifecycle v2 items 1-3 delivered matched-route transitions,
observable navigation state, and transactional cancellation and history
settlement. The next feature sequence is:

4. **Real relative URL resolution.** Give route targets URL-like navigation
   semantics across `au-link`, redirects, `href()`, `isActive()`, and `load()`.
   A plain target such as `reviews` remains a descendant of the calling route;
   `./reviews` is its explicit form; `../reviews` removes one URL segment from
   that contextual base; repeated `../` segments remove further segments; and
   `/reviews` starts at the route root. A query-only target such as `?page=2`
   retains the current pathname and replaces its query, while `#comments`
   retains the current pathname and query and replaces only the hash.
   Resolution must be shared by registered route targets and concrete paths,
   normalize `.` and `..`, and define attempts to traverse above the route
   root.

5. **Retained route views.** Add an opt-in `retain` or `cache-view` policy for
   deactivated routed views so editors, wizards, and tabs can preserve
   component-local state. Define cache keys, parameter sensitivity, lifecycle
   behavior, explicit invalidation, and bounded LRU eviction before exposing
   the API.

6. **Pathless route groups.** Allow a route context to contribute layout,
   guards, titles, and error boundaries without consuming a URL segment.
   Template nesting must remain the source of ownership and child residue.

7. **Route metadata and active-match introspection.** Add bound metadata and a
   public active route chain for breadcrumbs, generated navigation,
   permissions, and analytics. Stable route names may follow if contextual
   paths and metadata do not provide sufficient identity.

8. **Opt-in exclusive matching.** Preserve match-all sibling behavior by
   default, while allowing a parent to select one best regular match through a
   mode such as `match-mode="best"` or `exclusive`. Specificity, ties,
   fallbacks, constraints, and dynamic route registration require deterministic
   rules.

9. **Accessibility-aware transitions.** Announce settled route changes, honor
   `prefers-reduced-motion`, and complete transitions from actual animation or
   transition completion while retaining a bounded fallback for missing
   browser events.

The following broader ideas remain deliberately deferred:

- Named-route registries, until context and path-based generation prove insufficient.
- Router-owned data loading, retries, backoff, or caching.
- Global logging and telemetry policy.
- Error template slots or router-provided error components.
- Router-specific replacements for Aurelia composition or lazy import features.
- A broader path-pattern language beyond parameters, constraints, and wildcards.

These should be introduced only for concrete application needs that cannot be expressed cleanly through route contexts, adapters, and existing Aurelia features.

Release hardening under the `aurelia-router-html` package name continues
alongside this sequence.

## Definition of done

A public feature is complete when:

1. Its syntax, meaning, and TypeScript API are documented.
2. Matching remains independent of browser globals.
3. Route-context tests cover matching and state transitions.
4. Aurelia node tests cover binding scope and lifecycle behavior.
5. Browser tests cover history, links, rendering, and accessibility where relevant.
6. The docs overview includes a compact syntax example.
7. A focused documentation page includes an editable example where useful.
8. `TEST-CHECKLIST.md` records the delivered coverage.
