# Retained Route Views

Status: design proposal for roadmap item 5. Retained routed views are not
implemented yet.

## Short version

This proposal adds an opt-in route-level policy that keeps a deactivated routed
view alive instead of disposing it immediately.

Possible spellings:

- `retain`
- `cache-view`

The feature is intended for editors, multistep flows, tabbed workspaces, and
similar UI where a route should temporarily leave the active branch without
losing component-local state.

The first version should stay narrow:

- opt in per route;
- cache by route declaration plus normalized params by default;
- keep one bounded cache per router boundary;
- expose explicit invalidation;
- preserve the existing route lifecycle instead of inventing a new resume
  lifecycle immediately.

## Why this is useful

Some routed views are expensive or stateful in ways that are awkward to rebuild
on every leave and re-entry:

- a draft editor with unsaved text and selection state;
- a wizard that should preserve intermediate client-side state;
- a split workspace with several visited panels;
- a product detail page with local tabs, expanded sections, or scroll state;
- a report screen that should stay warm while the user checks adjacent routes.

Today, leaving the route tears down the routed view and its controller. The
application can preserve state elsewhere, but that pushes a view-management
concern into general application state even when the desired behavior is simply
"put this routed view aside for a while."

## Goals

- Preserve component, controller, DOM, and local binding state across route
  deactivation and later reactivation.
- Make retention explicitly opt-in and bounded.
- Keep route matching, navigation transactions, and URL ownership unchanged.
- Compose with nested routes, `au-router`, guards, rerun/replace transitions,
  and local recovery without inventing a second routing model.

## Non-goals

- Router-owned data caching, retries, or stale-while-revalidate policy.
- Unlimited route retention.
- A permanent "keep everything alive" mode.
- Retaining routes by default.
- Solving application data persistence beyond the routed view boundary.

## Proposed surface

The feature should be route-local:

```html
<au-route path="drafts/:id" retain>
  <draft-editor></draft-editor>
</au-route>
```

or:

```html
<au-route path="drafts/:id" cache-view>
  <draft-editor></draft-editor>
</au-route>
```

Both spellings communicate the intent, but they emphasize different tradeoffs:

- `retain` emphasizes behavior from the application point of view;
- `cache-view` emphasizes that the router is holding an inactive view instance.

`retain` is the cleaner name unless later options grow into a broader cache
policy object.

An extended form may follow later:

```html
<au-route
  path="drafts/:id"
  retain.bind="{ max: 5, key: $params.id }">
  <draft-editor></draft-editor>
</au-route>
```

The first version should not require this richer form.

## Default cache key

The cache key should distinguish retained instances that are meaningfully
different to the application.

Recommended default:

- route declaration identity;
- normalized route params.

That means `/drafts/42` and `/drafts/99` are different retained entries for the
same retained route declaration.

Query and hash should not be part of the default key.

Reason:

- query and hash often describe in-view state that should update through rerun
  or reactive bindings, not multiply cached instances;
- including them would create many accidental retained copies of the same
  screen;
- applications that need finer control can later opt into an explicit key.

## Cache ownership and bounds

Each router boundary should own its own retained-view cache:

- the root router owns root-route retained entries;
- each nested `au-router` owns its own retained entries.

That keeps retention local to the same place that already owns route contexts,
navigation, and view lifetimes.

The cache must be bounded. Recommended initial policy:

- LRU eviction;
- small default max, for example `10` retained views per router;
- optional per-route or router-level override later if needed.

Eviction should dispose the retained view normally.

## Lifecycle expectations

The first version should preserve existing lifecycle meanings as much as
possible.

Recommended model:

- leaving a retained route does not dispose its view;
- re-entering a retained route reuses the retained view instance;
- route values (`$params`, `$query`, `$hash`, `$route.data`, and active state)
  still update normally for the committed navigation;
- rerun and replace semantics continue to mean rerun and replace.

Important consequence:

- retention is primarily about deactivation and later reactivation;
- it should not silently turn `replace` into `rerun`;
- a route configured to replace on selected URL changes should still behave as a
  replacement within the active branch.

The main open question is what callbacks run when a retained inactive view is
reactivated.

Conservative first answer:

- no new special resume callback;
- ordinary route matching and state application make the view current again;
- route lifecycle callbacks run only when a transition plan or navigation path
  already requires them.

That keeps v1 smaller. If applications later need a dedicated resume signal,
that can be added intentionally instead of guessing too early.

## Relationship to `transition-plan`

Retention overlaps with transition behavior, but the two features answer
different questions.

`transition-plan` answers:

- what should happen while the same route declaration remains active and the URL
  change selects more work for that same route.

Retention answers:

- what should happen after a route declaration stops being active and is later
  activated again.

That yields a clean split:

- `rerun`: keep the current active route instance and rerun lifecycle work;
- `replace`: keep the same route declaration active but build a fresh routed
  view instance;
- `none`: keep the same route active and update reactive route values only;
- `retain`: when the route leaves the active tree, keep its deactivated view in
  a cache instead of disposing it immediately.

Important consequence:

- retention should not redefine `rerun`, `replace`, or `none`;
- `transition-plan` remains the rule while the route is active;
- retention matters only when the route deactivates and on a later re-entry.

Example:

```html
<au-route
  path="drafts/:id"
  retain
  transition-on="params"
  transition-plan="replace">
  <draft-editor></draft-editor>
</au-route>
```

Recommended behavior:

- `/drafts/1` to `/drafts/2` keeps the same route declaration active, so
  `transition-plan="replace"` wins and creates a fresh active view;
- `/drafts/1` to `/home` deactivates the route, so `retain` decides whether the
  leaving view is cached or disposed;
- `/home` back to `/drafts/1` may restore the retained entry for the matching
  cache key.

The feature should therefore be described as:

- `transition-plan` is intra-activation behavior;
- `retain` is post-deactivation behavior.

This rule is important because retained views must not silently turn
`replace` into `rerun`.

## Interaction rules

### Guards

- Leaving an active retained route still runs the same `can-unload` checks as
  any other leave.
- Entering or re-entering a retained route still runs the same `can-load`
  checks required by the selected transition.
- A denied navigation does not change the retained cache.

Retention must not bypass navigation policy.

### Replace and rerun

- `transition-plan="rerun"` still reruns the active route; retention is not
  involved because the route never deactivates.
- `transition-plan="replace"` still replaces the active view; if the route is
  retained and then later left, the replacement result may itself become the
  retained entry.
- `reload()` should follow the same rule as the chosen plan and should not use a
  retained inactive instance as a shortcut.

### Nested routes

If a retained parent route owns nested child routes, the retained entry should
preserve the whole routed subtree it owns at the moment it is deactivated.

That means a retained parent route likely restores:

- its own component tree;
- its active nested child branch;
- nested local UI state inside that retained subtree.

This is the main value proposition for tab, editor, and workspace screens.

### Local recovery and fallback rematching

Retention should not interfere with guard-failure local rematching or
error-recovery local rematching.

The safe rule is:

- retention applies only to views that were part of the last committed active
  tree;
- failed candidate work is never retained;
- local recovery may leave a sibling active at the requested URL, but the
  failed candidate does not become a retained cache entry.

### Nested routers

Each `au-router` boundary should retain only its own routed views. A parent
router should not directly cache the internal views of a nested router as
independent entries; they remain part of the retained subtree owned by the
parent route that contains that nested router.

## Invalidation

An application needs a way to discard stale retained entries.

Required capability:

- explicit invalidation by route context or router API.

Possible shapes:

```ts
route.invalidateRetained();
router.invalidateRetained();
router.invalidateRetained('/drafts/:id', { id: '42' });
```

The exact public API can wait, but the feature should not ship without an
explicit invalidation story.

At minimum, eviction and explicit invalidation should both dispose the retained
view normally.

## Why not application-managed state only

Application state can preserve data, but it does not automatically preserve:

- DOM state;
- local component fields not intentionally externalized;
- in-progress composition state;
- nested routed subtree state;
- view-local scroll or selection state.

Retained views solve a different problem than shared application data.

## Open questions

1. Should the HTML-first API be `retain`, `cache-view`, or a value form of one
   of them?
2. Should the default key be route identity plus params only, or should query be
   optionally included?
3. What should the default per-router cache bound be?
4. Do we need a dedicated resume lifecycle, or is that avoidable in v1?
5. Should invalidation live on `IRouteContext`, `IRouteCoordinator`, both, or a
   dedicated service?
6. How should retained entries appear in active snapshot or future devtools
   introspection, if at all?
7. Should a retained route be allowed to opt out of retaining its nested child
   subtree?

## Recommended v1 direction

If implemented soon, the smallest coherent version is:

- route-local `retain` boolean syntax;
- default key = route declaration identity + normalized params;
- per-router bounded LRU cache;
- explicit invalidation API;
- no dedicated resume lifecycle yet;
- no query/hash keying by default;
- no candidate-view retention before commit.

That keeps the feature useful for common editor and workspace flows while
avoiding a large second-order lifecycle model on the first pass.
