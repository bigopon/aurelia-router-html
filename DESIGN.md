# HTML Router Design

See [Router HTML Features and Roadmap](./FEATURES-AND-ROADMAP.md) for the complete implemented feature inventory and the design of the next six features.

## Goal

Build a new router package where HTML is the primary way to author routes.

This router is intentionally independent from Aurelia's existing `packages/router`.
It may overlap in capability, but it should stay simpler, smaller, and easier to
reason about.

## Core Idea

The route tree is the router.

`RouteContext` is the main primitive:

- it matches a path against a pattern
- it stores active state
- it exposes route params
- it tracks unmatched residue for child routes
- it propagates updates to child contexts

There is no heavy central router runtime required for core behavior. The root
`RouteContext` tree is the routing engine.

## HTML Authoring Model

Routes are authored with nested `<au-route>` elements.

Example:

```html
<au-route path="/store">
  <au-route path="/">
    Store index
  </au-route>

  <au-route path="/:storeId">
    Store id: ${$params.storeId}

    <au-route path="/order">
      Order page
    </au-route>
  </au-route>
</au-route>
```

Semantics:

- each `au-route` declares one route segment or nested route scope
- parent routes consume part of the path
- child routes match against the parent's residue
- markup inside an active route renders as part of that route branch
- route params are exposed to the branch as `$params`

## Main Pieces

### `RouteContext`

The domain model for routing state.

Responsibilities:

- store `parent` and child contexts
- compile and apply a route pattern
- derive `active`, `$params`, and `residue`
- notify subscribers when match state changes
- propagate residue to connected child contexts

### `au-route`

The view primitive for HTML-authored routes.

Responsibilities:

- read the `path` attribute
- create a child `RouteContext`
- capture its inner content as the branch view
- activate/deactivate that view based on the child context
- provide route-scoped state like `$params` to descendants

### Environment Adapter

Browser integration should stay outside `RouteContext`.

Responsibilities:

- read the current location
- subscribe to external location changes
- push or replace history entries
- forward resolved paths into the root `RouteContext`

This can be backed by:

- real browser history
- memory history for tests
- other host-specific implementations later

## Architectural Boundary

Keep these concerns out of `RouteContext`:

- direct `window` access
- `history.pushState` / `replaceState`
- click interception
- host-specific URL policy

Those belong in the adapter/wiring layer.

Keep these concerns inside `RouteContext`:

- path matching
- route activation state
- params and residue
- nested propagation

## Intended Shape

The implementation should feel like:

- a small path-matching tree
- a structural rendering primitive for matched branches
- a thin adapter layer for browser or test environments

Not like:

- a large navigation transaction engine
- a viewport-based orchestration system
- an adapter over the existing Aurelia router

## Initial Scope

Start with:

- nested routes
- parameter segments like `/:id`
- index routes via `path="/"`
- browser back/forward support
- normal anchor navigation support
- programmatic navigation through a thin coordinator or adapter

Defer until needed:

- route generation by name
- redirects
- guards and lifecycle parity with the main router
- advanced path syntax
- full query/hash handling

## Non-Goals

- reuse `packages/router` internals
- match the main router architecture
- chase feature parity before the core model is solid

## Working Principle

If a feature makes the route tree harder to understand, it should be questioned.

The main measure of success is that the full routing model can still be understood
by reading:

- `RouteContext`
- `au-route`
- the environment adapter
