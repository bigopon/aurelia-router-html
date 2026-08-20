# Router HTML Design

## Purpose

Router HTML is an HTML-first router for Aurelia. Templates own route topology;
TypeScript owns application behavior such as data access, permissions, and state.

The package is independent from Aurelia's viewport router. Its model is a
declarative route tree, a small navigation coordinator, and an environment
adapter. Each part has one boundary:

- route contexts match paths and hold route-local state;
- route elements connect contexts to Aurelia views and lifecycle expressions;
- the coordinator owns navigation transactions;
- path adapters own host locations and history.

Small does not mean that asynchronous navigation may expose an incoherent
result. A navigation commits once or preserves the last successful location.

## Design invariants

1. The template route tree is the source of route structure.
2. Matching is independent of browser globals.
3. Parent routes consume path segments and pass residue to their children.
4. Route state and host history settle to the same location.
5. Internal navigation writes history only after guards and lifecycle work
   succeed.
6. Rejected traversal across router-managed history, including the adjacent
   entry from which the router started, restores the prior cursor without
   overwriting either entry.
7. A newer navigation aborts and supersedes older asynchronous work.
8. Each navigation reaches one terminal outcome: completed, cancelled, failed,
   or superseded.
9. Synchronous navigation remains synchronous when application work is
   synchronous.
10. A route that remains matched follows its declared transition policy without
    surprising changes to view identity.

## Route tree

Routes are declared with nested `<au-route>` elements:

```html
<au-route path="store">
  <h1>Store</h1>

  <au-route path="/" exact>
    Choose a product
  </au-route>

  <au-route path="products/:id" exact>
    Product: ${$params.id}
  </au-route>
</au-route>
```

Each element creates one `RouteContext`. A context:

- stores its parent and registered children;
- compiles and applies one route pattern;
- exposes `active`, `$path`, `$params`, `$query`, and `$hash`;
- passes its unmatched `residue` to child contexts;
- owns route metadata, lifecycle data, and local recovery state;
- resolves contextual links and programmatic navigation.

Parameters belong to the context that captures them. Query and hash values
describe the complete location and are shared by every active context.

The root context applies a location from parent to child. A parent view can
therefore register nested routes before its remaining residue is matched.
Fallback selection remains local to a sibling set.

## HTML primitives

### `au-router`

`au-router` would create a nested router boundary for the `au-route` and
`au-link` elements declared inside it. Unlike `au-route`, which contributes one
route context into an existing tree, `au-router` would start a new route tree
with its own root context, coordinator, navigation state, and path adapter.

This is intended for embedded flows such as tab panels, previews, editors,
multi-step widgets, or side-by-side panels where multiple independent route
trees may exist on one page.

First step:

```html
<au-router current-path.bind="panelPath">
  <au-route path="list" exact>...</au-route>
  <au-route path="detail/:id" exact>...</au-route>
</au-router>
```

In that first step, `au-router` is an isolated memory-backed router. No `mode`
or adapter selection is needed yet.

`current-path` is the router's external state surface. It is a two-way binding:

- changing it from outside requests a normal router navigation;
- successful navigation writes the committed path back to the bound value;
- rejected navigation preserves the previous committed value;
- the value is the nested router's internal route location, for example
  `/detail/42?tab=specs`.

Future extensions may add URL-backed and custom-adapter variants, but they are
not part of the first `au-router` step.

If later route metadata is exposed publicly, nested and match-all routing should
not be modeled as one singular "active route chain". A parent may have multiple
active descendants at once through sibling matches, pathless groups, and local
fallback rematching. The more accurate shape is an active match graph that can
be projected as:

- a flat active-match list for metadata aggregation and diagnostics;
- one or more active branches for breadcrumb-like consumers that need
  root-to-leaf paths.

That should be available both from a router and from any route-context subtree.
The capability is better expressed as a committed snapshot than as a live
mutable graph:

```ts
interface ActiveRouteSnapshot {
  readonly path: string;
  readonly matches: readonly ActiveRouteMatchSnapshot[];
  readonly branches: readonly ActiveRouteBranchSnapshot[];
}

interface ActiveRouteBranchSnapshot {
  readonly matches: readonly ActiveRouteMatchSnapshot[];
}

interface ActiveRouteMatchSnapshot {
  readonly id: string;
  readonly pattern: string;
  readonly fullPath: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: string;
  readonly hash: string;
  readonly title: string | null;
}
```

Candidate APIs:

- `router.getActiveSnapshot()`
- `route.getActiveSnapshot()`

The router-level form would capture the committed active graph for the whole
tree. The route-context form would capture the committed active graph rooted at
that subtree while preserving stable route identity such as `fullPath`.

### `au-route`

`au-route` turns a route context into a structural view. It reads route
declarations, creates a child context, activates the captured template when the
context matches, and supplies these scope values:

- `$route`: the nearest route context;
- `$params`: parameters captured by that context;
- `$query`: read-only query values;
- `$hash`: the fragment without `#`;
- `$navigation`: the coordinator's immutable navigation snapshot;
- `$lifecycle`: the phase-local lifecycle context while an expression runs.

Nested Aurelia composition remains valid. Conditional routes, repeated routes,
components, slots, and template controllers create and dispose route contexts
through normal Aurelia lifecycles.

### `au-link`

`au-link` resolves its target through the nearest route context, writes a real
`href`, initiates client-side navigation for an unmodified primary click, and
maintains active state.

```html
<a au-link="reviews">Reviews</a>

<a au-link.bind="{
  target: '/products/:id',
  params: { id: product.id },
  options: { query: { tab: 'details' } },
  activeClass: 'selected',
  pendingClass: 'is-loading'
}">
  Product
</a>
```

While the link's resolved href is the pending destination, it receives its
`pendingClass` (default `is-pending`) and `aria-busy="true"`. Exact active
links receive `aria-current="page"`.

## Location model

An internal route location has three parts:

```ts
interface RouteLocation {
  readonly pathname: string;
  readonly query: RouteQuery;
  readonly hash: string;
}
```

Only the pathname participates in route matching. Query and hash remain
reactive URL state. Adapters translate the internal location into pathname,
hash, query-key, memory, or host-specific forms.

Route declarations are contextual even when their pattern begins with `/`.
Navigation targets are different: a leading slash resolves from the root,
while a plain or `./` target resolves from the calling context.

For a future nested `au-router`, the same internal route-location model should
remain the public state shape even if later extensions map it to query, hash,
pathname slices, or another host-specific representation.

## Navigation transaction

The coordinator owns at most one navigation transaction. A transaction contains
the requested location, previous committed location, navigation ID, abort
controller, route-tree snapshots, adapter settlement, pending asynchronous work,
redirect intent, and terminal result.

A navigation proceeds through these observable phases:

1. **guarding** — normalize the target and run outgoing and incoming guards;
2. **loading** — prepare entering, replacing, and rerunning routes;
3. **activating** — activate incoming Aurelia views;
4. **settling** — wait for nested branches and post-activation work;
5. **committing** — settle host history and publish the successful location.

Route contexts use a transaction snapshot while candidate state is applied.
That candidate state lets nested matching, bindings, and lifecycle callbacks
use the destination values. Cancellation or failure restores the
previous route values, lifecycle data, failure state, rendered branch, and host
location before the transaction settles.

Programmatic navigation does not call adapter `push` or `replace` until all
pre-commit work succeeds. Application callbacks receive the transaction's
`AbortSignal`. Their promises are raced against it, so a newer navigation can
continue without waiting for stale work to settle. The underlying application
operation may still finish, but its late value is ignored by the router.

Aurelia view activation is a framework transition rather than an application
callback. If cancellation arrives after that transition has begun, a newer
transaction may prepare its destination, but it does not commit until the
aborted view has settled and its DOM has been removed. This keeps preemption
from publishing a location over partially activated content.

## Entering, transitioning, and leaving routes

```html
<au-route
  path="account"
  can-load.bind="transition => canOpen(transition)"
  loading.bind="loadAccount($lifecycle)"
  loaded.bind="accountReady($lifecycle)"
  can-unload.bind="transition => canLeave(transition)">
  ...
</au-route>
```

- `canUnload` runs deepest-first on routes absent from the target branch and on
  current views selected for replacement.
- `canLoad` runs before an entering route or a selected matched-route
  transition.
- `loading` prepares that route before activation or in-place refresh.
- `loaded` runs after its complete nested branch settles.
- `false` cancels the transaction.
- `canLoad` may return a contextual or root-absolute redirect.

`guard-failure="local"` applies only to `canLoad`. It excludes the denied
subtree for that transaction and rematches siblings at the immediate parent.
`canUnload` denial remains navigation-wide.

## Matched-route transitions

When an active `au-route` also matches the destination, its transition policy
decides whether selected URL changes rerun its lifecycle, replace its view, or
only update reactive route state:

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

`transition-on` accepts `params`, `query`, `hash`, `all`, or `none`. The
`params`, `query`, and `hash` inputs may be combined with spaces or commas;
`all` and `none` are standalone values. It defaults to `params`; query and
hash transitions are opt-in because those values are shared by the active tree.

`transition-plan` accepts:

- `rerun` (the default), which preserves the route context, view, component,
  controller, and DOM nodes while running `canLoad`, `loading`, and `loaded`
  again;
- `replace`, which runs `canUnload` on the current view, prepares the candidate
  through `canLoad` and `loading`, replaces the routed view and its descendant
  branch with fresh instances, and then runs `loaded`;
- `none`, which updates `$params`, `$query`, and `$hash` without rerunning route
  lifecycle callbacks or replacing the view.

Replacement `canUnload` guards run deepest-first. Every affected guard on an
already-declared route then completes before any selected transition begins
loading or changes the rendered tree. Descendants declared inside a fresh
replacement view do not exist during that preflight; they run their normal
entry `canLoad` as the candidate activates. A denial, redirect, or failure in
that candidate branch still rolls back the complete replacement.

The same frozen `RouteLifecycleContext` is available to `canLoad`, `loading`,
and `loaded`:

```ts
type RouteLifecycleKind = 'enter' | 'replace' | 'rerun';

interface RouteLifecycleContext {
  readonly kind: RouteLifecycleKind;
  readonly from: RouteValueSnapshot | null;
  readonly to: RouteValueSnapshot;
  readonly changes: readonly ('params' | 'query' | 'hash' | 'reload')[];
  readonly route: IRouteContext;
  readonly params: RouteParams;
  readonly query: RouteQuery;
  readonly hash: string;
  readonly signal: AbortSignal;
  readonly previousData: RouteLifecycleData;
}
```

`kind` is `enter` for initial activation, `rerun` for an in-place lifecycle
pass, and `replace` when the matched view is recreated. `from` is `null` for an
entry and a snapshot for a matched-route transition. `to`, `params`, `query`,
and `hash` reflect the destination. `changes` lists every actual params, query,
and hash difference, even when only one of them intersected `transition-on` and
caused the plan to run.

Lifecycle data keeps one vocabulary across all three kinds. Fulfilled
`loading` and `loaded` values replace `$route.data.loading` and
`$route.data.loaded`; `previousData` lets the next pass inspect the prior
values. A rerun invokes the callbacks in the retained view's live binding
scope. A replacement rebuilds that view normally, and newly declared children
enter through their own lifecycle.

`route.reload()` forces the configured transition plan at the route's current
location, preserves its query and hash, replaces the current history entry,
and reports `reload` in `changes`. `route.reload({ plan: 'rerun' })` and
`route.reload({ plan: 'replace' })` override the policy for that attempt. The
coordinator equivalent is `load(path, { reload: true })`.

## Lifecycle data and errors

`loading` and `loaded` expressions may return any value or promise. Fulfilled
values live in `$route.data`. Their lifecycle context also contains:

- the owning route;
- destination params, query, and hash;
- the transaction abort signal;
- a snapshot of prior lifecycle data.

Errors are attributed to one of `can-load`, `loading`, `activation`, or
`loaded`. An `on-error` callback may let the error bubble, redirect, or return
`{ recover: 'local' }` to exclude the failing subtree and rematch a sibling.
Unhandled failures reject programmatic navigation with the original error and
roll back the transaction.

The router does not cache application data or compensate application side
effects. Applications use `previousData`, their own cache, and the supplied
abort signal where appropriate.

## Observable navigation state

The coordinator publishes one immutable `RouteNavigationState` through its
`navigation` property and `subscribeNavigation()`. The nearest route scope
also exposes it as `$navigation`.

```ts
interface RouteNavigationState {
  readonly id: number;
  readonly pending: boolean;
  readonly phase:
    | 'idle'
    | 'guarding'
    | 'loading'
    | 'activating'
    | 'settling'
    | 'committing';
  readonly source: 'initial' | 'load' | 'external' | 'redirect' | null;
  readonly from: RouteLocation;
  readonly to: RouteLocation | null;
  readonly href: string | null;
  readonly signal: AbortSignal | null;
  readonly result: RouteNavigationResult | null;
}
```

Observers can render progress, disable duplicate actions, announce changes, or
record telemetry without controlling the transaction. Existing path
subscriptions remain commit-only.

## Path adapter settlement

`IPathAdapter` is the host boundary:

```ts
interface IPathAdapter {
  getCurrentPath(): string;
  formatHref(path: string): string;
  push(path: string): void;
  replace(path: string): void;
  subscribe(
    callback: (path: string, navigation?: PathNavigation) => void,
  ): () => void;
}
```

The optional `PathNavigation` describes host-originated work:

- `intent` is an intercepted link whose host location has not changed;
- `traverse` is Back/Forward movement whose host cursor changed first;
- `commit()` applies an intent or accepts a traversal;
- `rollback()` abandons an intent or restores the accepted traversal entry.

The browser adapter gives its entries a private key and monotonic index in
`history.state` while preserving application-owned state. A rejected traversal
uses compensating `history.go()` and suppresses the resulting internal
`popstate`. Replacing the traversed URL is not a valid rollback because it
would destroy an entry and corrupt later Back/Forward behavior.

When the host exposes Navigation API entry indexes, the adapter can also
compensate exact multi-entry movement into same-document history that predates
router startup. With the plain History API, which exposes neither direction nor
distance for an unmarked entry, the defined fallback is the immediately
preceding startup entry. Other unmarked jumps are outside router-managed SPA
history.

The memory adapter follows the same settlement model with its entry array and
cursor. Custom adapters that omit navigation metadata retain the callback-only
contract; precise rollback is the responsibility of adapters that report
host-first movement.

## Base path and nested routers

`basePath` belongs to the outer browser adapter that mounts the application
below an origin-relative prefix such as `/my-app`. Its job is to keep the
deployment prefix outside the internal route tree.

That concern is different from nested `au-router` composition.

- `basePath` strips and restores an application mount prefix at the browser
  boundary;
- a nested router should own only the portion of location state delegated to
  it by its adapter;
- a nested router should not reinterpret application deployment prefixes.

For that reason, the first `au-router` step should stay memory-backed and avoid
tying nested-router composition to `basePath`.

If later extensions add URL-backed nested routers, they should define explicit
ownership of a delegated location slot rather than reuse deployment `basePath`
semantics. Examples include:

- one named query entry for a nested route location;
- exclusive ownership of the document hash by one nested router;
- a delegated pathname slice from an existing router or custom adapter.

That keeps deployment prefixes, route residue, and nested router boundaries as
separate concerns.

## Browser settlement

Title, scroll, focus, and animation work remain outside route matching. They use
the complete route-tree settlement boundary:

- titles compose metadata from the active branch;
- fragment scrolling and history restoration run after routed views settle;
- focus targets newly attached route content;
- enter animation begins only for the committed incoming view.

Cancelled work is discarded before it can publish stale browser effects.

## Activation lifecycle audit

The repeated-sibling freeze uncovered a sensitive boundary in commit ordering:
route registry churn can still happen while a navigation is being finalized.
That suggests the following adjacent risk areas need explicit coverage and
possibly stricter coordinator invariants:

- **Commit-time registry callbacks against stale location**.
  A route may unregister or refresh descendants during view commit, rollback, or
  deferred deactivation. The coordinator must not let registry listeners reapply
  the previous committed path while the new transaction is still finalizing.
  Covered by regression tests for repeated nested siblings, redirect settlement,
  and local error recovery under registration churn.

- **Parent loaded before descendant activation is truly stable**.
  If a parent route settles or publishes `loaded` while a child branch is still
  mounting, replacing, or recovering, the tree can observe a partially committed
  state.
  Covered by nested lifecycle ordering tests that assert parent-first `loading`,
  child-first `loaded`, and grandchild settlement before ancestor `loaded`.

- **Replacement transitions that clear the active transaction too early**.
  A replace-plan navigation can dispose the previous branch, activate the new
  branch, and trigger descendant registration changes in the same window. The
  transaction must remain authoritative until both route-tree state and browser
  location are coherent.
  Covered by same-declaration replacement tests, including rollback, supersession,
  and never-settling descendant replacement cases.

- **Redirect and local recovery during descendant registration churn**.
  Redirects and error recovery can invalidate one candidate branch and register
  another. Those flows need to preserve the destination chosen by the active
  transaction rather than whichever branch registry notifications happen to
  re-run first.
  Covered by redirect regressions, local recovery regressions, and teardown
  regressions that assert no extra route churn is introduced while stopping.

- **Deferred deactivation interacting with repeated or conditional routes**.
  Repeated `au-route` declarations and conditional child routes can remove the
  outgoing branch while the incoming one is still becoming visible. The tree
  must not end up with both siblings inactive or with the old sibling revived
  by a stale refresh.
  Covered by repeated nested sibling regressions, conditional/group discovery
  tests, and in-flight `au-router` current-path supersession cases.

- **Tear-down after a successful navigation**.
  Fixture disposal and application stop should not observe a half-finalized
  transaction. If stop/dispose runs after route commit but before all route-owned
  view work is quiescent, Aurelia lifecycle teardown can fail or hang.
  Covered by explicit teardown regressions after redirect commit and local
  recovery commit.

- **Commit-only browser effects observing pre-commit tree state**.
  Title, scroll, focus, and transition settlement are designed to be commit-only.
  They should continue to read the finalized branch, not an intermediate tree
  caused by registry callbacks, late rollback, or superseded descendant work.
  Indirectly covered by existing title, scroll, focus, and transition-settlement
  suites. Keep this item as an ongoing watch point whenever commit ordering changes.

### Audit coverage summary

- Implemented regressions currently cover:
  repeated sibling replacement, nested lifecycle ordering, replacement rollback
  and supersession, redirect settlement, local error recovery, conditional route
  churn, and teardown after successful redirect or recovery.

- Remaining audit value is mostly in combination growth rather than a single
  missing invariant:
  whenever commit ordering, deferred deactivation, or route-owned teardown
  changes, rerun and extend the above clusters before adding new features on top.

## Non-goals

The coordinator is not:

- a second route registry;
- an application data cache;
- a retry or offline policy;
- a global logger or analytics service;
- a browser-history implementation;
- a guard for full-document reload, tab close, or navigation away through
  `beforeunload`;
- an adapter over Aurelia's viewport router.

The route tree remains the routing model. Transactions and adapters exist to
keep that model coherent across asynchronous work and host navigation.
`canUnload` protects SPA navigation coordinated by Router HTML. Applications
that need a generic browser prompt for unsaved state own that integration
separately; full-document unloading cannot await the router's asynchronous
guard contract or provide the same destination and rollback semantics.
