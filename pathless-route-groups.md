# Pathless Route Groups

Status: design proposal for roadmap item 6. The `group` syntax and revised
zero-segment matching rules are not implemented yet.

## Short version

This proposal defines two route declarations that consume no URL segment but
have deliberately different selection rules:

- `path="/"`, `path="."`, and `path="./"` are normal zero-segment routes.
  With `exact`, they match only the parent index. Without `exact`, they match
  unconditionally beneath the parent and forward the complete residue.
- `<au-route group>` is a structural route branch. It is selected only when a
  descendant matches the unchanged parent residue.

Omitted and empty paths normalize to `/`, so they follow the same `exact` rule.
That keeps one meaning for every zero-segment path spelling.

A group inserts a route boundary into the template and route tree without
inserting another segment into the URL.

It can own:

- shared layout;
- `can-load` and `can-unload` guards;
- `loading`, `loaded`, and transition policy;
- a title contribution;
- an `on-error` boundary;
- a nested fallback stage;
- component-local layout state.

Its children still own the paths that select the branch. For example, this
proposed markup:

```html
<au-route group can-load.bind="transition => requireSession(transition)">
  <header>Signed-in application</header>

  <au-route path="dashboard" exact>Dashboard</au-route>
  <au-route path="projects/:id" exact>Project</au-route>
</au-route>
```

would recognize `/dashboard` and `/projects/42`. It would not produce URLs such
as `/group/dashboard`, and the group would not be active for an unrelated route
such as `/sign-in`.

The important word is **group**. A normal non-exact zero-segment route is
selected from its own pattern and remains selected even when none of its
children match. A group is selected by its descendants. The router does not
backtrack through the former to make it behave like the latter.

## Why this is useful

Normal template nesting couples a layout boundary to a URL segment:

```html
<au-route path="admin">
  <admin-layout>
    <au-route path="users">Users</au-route>
    <au-route path="roles">Roles</au-route>
  </admin-layout>
</au-route>
```

That produces `/admin/users` and `/admin/roles`, which is correct when `admin`
is part of the public URL.

Sometimes the application wants the boundary but not the prefix. Examples
include:

- `/dashboard` and `/projects/42` sharing an authenticated application shell;
- `/login` and `/register` sharing an anonymous layout;
- a collection of settings pages sharing one authorization guard;
- several reports sharing one loading policy and error boundary;
- an organization route adding a settings boundary without producing an extra
  `/settings-shell` segment;
- two independently rendered route regions that are selected by the same URL.

A plain `<template>`, `<div>`, or custom element can share visual layout, but it
does not create a `RouteContext`. It therefore cannot independently own router
guards, titles, route lifecycle data, error recovery, or a child fallback stage.

## Two zero-segment tools

The syntax should make the intended selection rule visible.

| Declaration | Selection | Residue | Typical use |
| --- | --- | --- | --- |
| `<au-route path="/" exact>` | Only when the parent residue is `/` | `/` | An index route |
| `<au-route path="/">` | Whenever the parent is active | Forwarded unchanged | An unconditional layout or policy boundary |
| `<au-route group>` | Only when a descendant matches | Forwarded unchanged | A layout or policy boundary for selected child routes |

`.` and `./` are contextual aliases for `/`. An omitted path and `path=""`
also normalize to `/`; they do not mean `group`.

### Normal zero-segment prefix route

Without `exact`, a zero-segment path is an ordinary prefix route:

```html
<au-route path="/" title="Application frame">
  <app-frame></app-frame>

  <au-route path="dashboard" exact>Dashboard</au-route>
  <au-route path="projects/:id" exact>Project</au-route>
</au-route>

<au-route path="sign-in" exact>Sign in</au-route>
```

At `/dashboard`, `/projects/42`, and `/sign-in`, the zero-segment route is
active. It consumes nothing and gives each child the original residue. The
direct `sign-in` sibling may also be active because the router preserves its
normal match-all sibling behavior.

There is no descendant backtracking. If no child of the zero-segment route
matches, the route does not become inactive and ask its parent to choose a
different branch. It was already a successful regular match. A fallback beside
it is therefore not a substitute for a missing child; put that fallback inside
the zero-segment route when it belongs to that stage.

This behavior is useful for a shell that genuinely applies to every location
below a parent. It is not the right declaration for a shell that should exist
only for a selected subset of child routes.

### Descendant-selected group

The same children under a group have different behavior:

```html
<au-route group title="Signed-in application">
  <app-frame></app-frame>

  <au-route path="dashboard" exact>Dashboard</au-route>
  <au-route path="projects/:id" exact>Project</au-route>
</au-route>

<au-route path="sign-in" exact>Sign in</au-route>
<au-route path="*" fallback>Not found</au-route>
```

The group is active at `/dashboard` and `/projects/42`. It is inactive at
`/sign-in`. At `/missing`, its subtree produces no match, so the parent fallback
may be selected. This descendant-aware selection is the feature that requires
the group marker and inactive-child discovery.

For the examples above, the distinction is:

| URL | `path="/" exact` | `path="/"` | `group` with dashboard/project children |
| --- | --- | --- | --- |
| `/` | Active | Active | Inactive unless it declares a matching index or fallback child |
| `/dashboard` | Inactive | Active | Active through the dashboard child |
| `/projects/42` | Inactive | Active | Active through the project child |
| `/sign-in` | Inactive | Active, even with no matching child | Inactive |
| `/missing` | Inactive | Active; no parent fallback backtracking | Inactive, so the parent fallback may run |

## Proposed syntax

Use an explicit boolean attribute:

```html
<au-route group>
  ...child routes...
</au-route>
```

`group` is separate from every spelling of a zero-segment path:

- path declarations are selected by their own matcher;
- groups are selected by descendant matches;
- dynamic paths may temporarily need an internal placeholder;
- explicit syntax produces useful validation errors;
- changing `exact` on a path must never turn it into a group.

`pathless` would also be a defensible attribute name. This document uses
`group` because it describes the user-facing purpose rather than the matching
mechanism.

The proposed first-release validation is:

```html
<!-- Valid -->
<au-route group title="Account">...</au-route>

<!-- Invalid: a context cannot be both pathless and path-owning -->
<au-route group path="account">...</au-route>

<!-- Invalid: matching modifiers have no group-level pattern to modify -->
<au-route group exact>...</au-route>
<au-route group fallback>...</au-route>

<!-- Invalid: redirecting the structural group would make its children
     unreachable. Redirect from a child or a guard instead. -->
<au-route group redirect-to="sign-in"></au-route>
```

`path.bind`, `path.to-view`, and `:path` are likewise mutually exclusive with
`group`.

## Current behavior and migration

The current runtime normalizes all of these declarations to the same `/`
pattern:

```html
<au-route></au-route>
<au-route path=""></au-route>
<au-route path="/"></au-route>
<au-route path="."></au-route>
<au-route path="./"></au-route>
```

Today that pattern matches only the parent index residue, whether or not the
route has `exact`. In other words, `exact` currently makes no observable
difference for these aliases.

The proposal makes zero-segment paths consistent with every other normal route:

| Declaration | Current runtime | Proposed behavior |
| --- | --- | --- |
| `path="/" exact` | Index only | Index only |
| `path="." exact` / `path="./" exact` | Index only | Index only |
| `path="/"` | Index only | Unconditional zero-segment prefix |
| omitted path / `path=""` | Index only | Unconditional zero-segment prefix |
| `<au-route group>` | Not supported | Descendant-selected structural branch |

Applications that intend an index route should declare `exact`. Existing
`path="/" exact`, `path="." exact`, and `path="./" exact` declarations migrate
without a behavior change. An omitted, empty, or explicit zero-segment path
without `exact` is the compatibility-sensitive case: it becomes active for all
residue below its parent.

This should be treated as an intentional matching change, called out in release
notes, examples, and diagnostics. A compatibility release may warn when a
non-exact zero-segment declaration has no child routes, because that shape was
often written as an implicit index route. It should not silently retain the old
index-only behavior for some aliases; doing so would make `/`, `.`, `./`, empty,
and omitted paths disagree after normalization.

## Recommended contract

| Concern | Proposed behavior |
| --- | --- |
| Selection | The group is selected when at least one currently declared descendant route matches the unchanged parent residue. |
| URL | The group contributes no pathname segment. |
| Residue | Children receive exactly the residue that the group received. |
| Params | The group captures no local params; ancestor and child params remain on their owning contexts. |
| Query and hash | The group observes the same query and hash as the rest of the active branch. |
| Rendering | The group renders its projected content as a layout around the selected descendants. |
| Identity | The group view remains mounted while navigation switches between matching descendants. |
| Guards | Group entry guards run before descendant loading; exit guards run after descendant exit guards. |
| Lifecycle | `loading` is parent-first and `loaded` is child-first, exactly like a path-owning route. |
| Title | An active group contributes a title between its parent and selected descendants. |
| Errors | `on-error` is the nearest boundary for failures in its descendant branch. |
| Addressability | The group itself is structural and has no standalone URL target. |
| Discovery | Path listings omit the group but include its addressable descendants. |

## Example: authenticated routes without an `/app` prefix

```html
<au-route
  group
  title="Application"
  can-load.bind="transition => requireSession(transition)"
  can-unload.bind="transition => confirmLeavingApp(transition)">

  <header>
    <strong>Acme</strong>
    <nav>
      <a au-link="dashboard">Dashboard</a>
      <a au-link="projects/42">Current project</a>
    </nav>
  </header>

  <main>
    <au-route path="dashboard" exact title="Dashboard">
      <h1>Dashboard</h1>
    </au-route>

    <au-route path="projects/:id" exact title.bind="projectTitle">
      <h1>Project ${$params.id}</h1>
    </au-route>
  </main>
</au-route>

<au-route path="sign-in" exact title="Sign in">
  <sign-in-form></sign-in-form>
</au-route>

<au-route path="*" fallback title="Not found">
  <h1>Not found</h1>
</au-route>
```

Expected selection is:

| URL | Active branch |
| --- | --- |
| `/dashboard` | application group → dashboard |
| `/projects/42` | application group → project 42 |
| `/sign-in` | sign-in route; application group inactive |
| `/missing` | root fallback; application group inactive |

Entering `/dashboard` from `/sign-in` runs the group guard and the dashboard
guard before either route starts loading. Moving from `/dashboard` to
`/projects/42` retains the group and its header DOM, unloads the dashboard, and
enters the project route. Leaving for `/sign-in` runs descendant `can-unload`
first and group `can-unload` second.

This is the central benefit: the authenticated boundary follows a set of child
routes without forcing those routes under `/app`.

## Example: preserving layout-local state

```html
<au-route group>
  <aside>
    <label>
      Filter
      <input value="This value survives child navigation">
    </label>
  </aside>

  <au-route path="orders" exact>Orders</au-route>
  <au-route path="customers" exact>Customers</au-route>
</au-route>
```

Navigating from `/orders` to `/customers` replaces the selected child view but
does not recreate the group view. The input element, its value, focus state,
and any component-local layout state remain intact.

This is ordinary active-branch identity, not route-view caching. If navigation
leaves the complete group, the layout deactivates normally. A future retained
view policy could cache it, but that is a separate feature.

## Example: a nested authorization boundary

```html
<au-route path="organizations/:orgId">
  <h1>Organization ${$params.orgId}</h1>

  <au-route
    group
    title="Administration"
    can-load.bind="() => requireOrgAdmin($route.parent.$params.orgId)">

    <nav>
      <a au-link="members">Members</a>
      <a au-link="billing">Billing</a>
    </nav>

    <au-route path="members" exact title="Members">
      Organization members
    </au-route>

    <au-route path="billing" exact title="Billing">
      Billing settings
    </au-route>
  </au-route>
</au-route>
```

The resulting URLs remain:

```text
/organizations/acme/members
/organizations/acme/billing
```

There is no `/administration` segment. The `orgId` parameter belongs to the
path-owning parent. The group has an empty local `$params`; it accesses the
ancestor parameter through `$route.parent.$params`.

Switching from members to billing retains the administration layout. The group
guard protects entry into the administration branch, while child guards may
still enforce page-specific permissions.

## Example: an error boundary and local fallback

```html
<au-route
  group
  title="Reports"
  on-error.bind="failure => recoverReports(failure)">

  <section class="reports-shell">
    <au-route
      path="reports/daily"
      exact
      loading.bind="loadDailyReport($lifecycle)">
      Daily report
    </au-route>

    <au-route
      path="reports/monthly"
      exact
      loading.bind="loadMonthlyReport($lifecycle)">
      Monthly report
    </au-route>

    <au-route path="*" fallback>
      <p>That report is unavailable.</p>
    </au-route>
  </section>
</au-route>
```

The group is the nearest error boundary for both report routes. A local recovery
rematches the group's child stage, allowing its fallback to render inside the
reports shell instead of replacing an unrelated part of the application.

A child fallback is different from a fallback beside the group. The child
fallback belongs to the group's stage; an outer fallback belongs to the
parent's stage.

## Example: index and fallback ownership

```html
<au-route group title="Documentation">
  <docs-header></docs-header>

  <au-route path="/" exact>Documentation home</au-route>
  <au-route path="guides/:name" exact>Guide</au-route>
  <au-route path="*" fallback>Unknown documentation page</au-route>
</au-route>
```

The group is selected at `/` because its index child matches. It is selected at
`/guides/routing` because the guide child matches. Its own fallback deliberately
claims other URLs for this branch.

If the application wants an outer fallback to handle unknown URLs, omit the
group-local fallback:

```html
<au-route group>
  <au-route path="/" exact>Home</au-route>
  <au-route path="guides/:name" exact>Guide</au-route>
</au-route>

<au-route path="*" fallback>Application not found page</au-route>
```

At `/missing`, no regular descendant selects the group, so the parent fallback
may activate.

## Matching model

The conceptual match operation is recursive:

```text
matchGroup(group, parentResidue):
  matches = match group descendants against parentResidue

  if matches is empty:
    group is inactive
  else:
    group is active
    group consumes nothing
    selected descendants receive parentResidue unchanged
```

The actual implementation must produce one complete candidate tree before
guards, lifecycle callbacks, or live DOM mutation begin.

### Regular and fallback matches

A group does not count as a regular match merely because it exists. It counts
only when its subtree produces a match. This is necessary so an inactive group
does not suppress a fallback beside it.

Fallback selection remains local to each child stage:

1. inspect regular descendants of the group;
2. if none match, consider the group's fallback descendants;
3. if the group subtree still has no match, let the parent continue its own
   fallback decision.

### Multiple and nested groups

Groups may be nested. Each group forwards the same residue until a path-owning
descendant consumes part of it.

The router currently permits multiple regular sibling matches. Pathless groups
should preserve that rule: if two group subtrees match the same location, both
may be active and render parallel branches. A future exclusive matching mode
could compare the selected descendants' specificity; the groups themselves add
zero specificity.

## Route context and URL APIs

A normal zero-segment path route remains a path-owning `RouteContext`. Its
`fullPath` and generated target are the parent's URL base, just as for an index
route. With `exact` it is active only at that base; without `exact` it may remain
active while a descendant URL is current. Relative links still resolve through
its child registry against the unchanged base.

A group is also a real `RouteContext`, but it is not an addressable destination.

Recommended API behavior is:

| Operation | Group behavior |
| --- | --- |
| `group.active` | Reports whether a descendant currently selects the group. |
| `group.href('child')` | Resolves the child relative to the same URL base as the parent. |
| `group.load('child')` | Navigates contextually to the child. |
| `group.reload()` | Reloads the complete current location using the group's configured transition plan. |
| `isActive(group)` | For the object overload, returns the group's actual context activity. |
| `href(group)` / `load(group)` | Throws: the group alone does not identify a complete destination. |
| `getPaths()` | Omits the structural group entry and includes its addressable descendants. |
| Child redirect | Resolves through the group's unchanged URL base. |
| Group `redirect-to` | Rejected; use a guard redirect or a path-owning child redirect. |

The group's logical URL base is the same as its parent's, but it should not
publish a duplicate or phantom path. Context identity must remain object-based;
`fullPath` alone cannot distinguish a parent, a normal zero-segment route, and
one or more pathless groups.

Links inside the group remain natural:

```html
<au-route group>
  <a au-link="overview">Overview</a>
  <a au-link="settings/profile">Profile</a>

  <au-route path="overview">...</au-route>
  <au-route path="settings/profile">...</au-route>
</au-route>
```

The group adds an ownership context for finding descendants, not a URL segment.

## Guards, lifecycle, and transitions

The normal route transaction ordering applies to groups.

For entry:

1. determine the complete candidate branch, including groups and descendants;
2. run all affected `can-load` guards before loading or DOM mutation;
3. run `loading` parent-first;
4. activate group layouts and descendant views;
5. run `loaded` child-first.

For exit:

1. run descendant `can-unload` guards deepest-first;
2. run the group `can-unload` guard;
3. deactivate the descendant and group views transactionally.

A denied group guard leaves the previous URL, route state, and DOM unchanged.
If `guard-failure="local"` is supported on a group, denial excludes the group at
its parent's selection stage. Local denial on a child instead rematches siblings
inside the group.

### Switching children

When `/dashboard` changes to `/projects/42`, an application-shell group remains
active. Its ordinary entry lifecycle does not rerun just because a different
descendant matched. This is what preserves the shell's identity and keeps a
group guard from repeatedly authenticating every child navigation.

The group has no local path params, so the default `transition-on="params"` has
nothing to observe. Existing policies still apply:

```html
<au-route
  group
  transition-on="query hash"
  transition-plan="rerun"
  loading.bind="refreshShell($lifecycle)">
  ...
</au-route>
```

`group.reload()` forces the configured plan at the current descendant URL.
`transition-plan="replace"` replaces the group layout and its complete
descendant branch. Parameter-dependent data should normally live on the route
that owns that parameter; a later design could add an explicit descendant- or
ancestor-change trigger if real use cases justify it.

## What a pathless group is not

It is not:

- a normal zero-segment route: `path="/" exact` is index-only, while `path="/"`
  without `exact` is an unconditional prefix route with no descendant
  backtracking;
- an optional parameter: an optional parameter still participates in matching;
- a wildcard: a wildcard is an addressable pattern and may consume input;
- a plain layout wrapper: a group owns router lifecycle and boundaries;
- a named route: it has identity but no standalone destination;
- route caching: it remains mounted only while its descendant branch is active;
- exclusive matching: overlapping group descendants follow the router's normal
  sibling matching policy;
- a hidden URL token such as `(admin)`: no synthetic segment appears in hrefs or
  browser history.

## The HTML-first implementation constraint

Configuration-tree routers know every child route before navigation. Router
HTML currently discovers nested route contexts when the parent synthetic view
activates. That creates a chicken-and-egg problem:

1. descendant-aware matching needs the child routes to decide whether the group
   should activate;
2. the child route instances do not yet exist because the group has not
   activated.

Adding a transparent matcher alone would implement the proposed non-exact
zero-segment path behavior, not a group. It would activate for every residue
under its parent, coexist with unrelated direct siblings, and suppress parent
fallbacks even when none of its eventual children match.

### Implementation choices

#### 1. Use a normal zero-segment prefix route

Declare `path="/"` without `exact`, activate it whenever its parent is active,
and forward residue unchanged. This is the proposed normal-route behavior and
supports dynamic child registration without inactive discovery. In the
authenticated example it would also activate the application shell at
`/sign-in`.

This is the right tool for an unconditional layout. It should not be presented
as descendant-selected `group` behavior, and a failed child match must not cause
backtracking.

#### 2. Speculative activation

Create or attach the group view, wait for children to register, and deactivate
it again when no child matches.

This risks binding and lifecycle side effects, guard execution, layout flashes,
and disagreement between the live DOM and the transaction's candidate tree. It
is not recommended.

#### 3. An explicit match hint

Require the group to duplicate the patterns that may select it:

```html
<au-route group match="dashboard, projects/**">
  <au-route path="dashboard">...</au-route>
  <au-route path="projects/:id">...</au-route>
</au-route>
```

This is deterministic and could be an honest MVP, but duplicated patterns can
drift from dynamic or conditional children. If used, `match` must be documented
as a selection hint that consumes no residue.

#### 4. Eager route declaration metadata

Separate route declaration from routed-view activation. The template compiler
or a registration layer would expose enough inactive child metadata for the
coordinator to build a complete candidate tree without binding or attaching the
group's content.

This is the recommended full design because it provides the expected semantics
without speculative UI work. It is also the largest implementation:

- static descendants need lightweight descriptors;
- `path.bind`, conditional routes, and repeated routes need a defined way to
  update inactive declarations;
- registry notifications must invalidate group selection;
- matching, candidate guard analysis, leaving analysis, href discovery, and
  active-link checks must use one shared group-aware traversal;
- the live `RouteContext` instances created during activation must correspond to
  the descriptors used during preflight.

If inactive dynamic and conditional descendants cannot be represented
faithfully, an explicit `match` MVP is safer than silently giving `group` the
normal non-exact `/` semantics.

## Suggested implementation shape

The implementation should be designed as a route-tree feature, not a special
case in `AuRoute.updateView()`.

1. Make `/`, `.`, `./`, empty, and omitted paths use one zero-segment matcher:
   `exact` accepts only `/`; non-exact accepts every residue and returns it
   unchanged.
2. Add an immutable `group` flag to compiled instruction data and
   `RouteContextOptions`.
3. Reject incompatible group attributes during template processing.
4. Represent inactive descendant declarations or require an explicit match
   hint for the first release.
5. Extend one shared matching traversal with pathless branch selection.
6. Use that traversal for live refresh, candidate match collection, parameter
   collection, leaving analysis, guard preflight, and fallback selection.
7. Keep both forms' input residue unchanged and omit the group from URL
   generation.
8. Make structural contexts non-addressable in `href`, `load`, `_findContext`,
   and path listings.
9. Reuse the existing transactional guard, lifecycle, replacement, settlement,
   title, focus, and error-boundary pipelines once the candidate tree is known.
10. Ensure conditional registration and disposal can activate or deactivate a
   matching group for the current URL without leaving stale registry entries.

## Acceptance criteria

A complete implementation needs executable coverage for at least these cases:

1. `/`, `.`, `./`, empty, and omitted paths are equivalent zero-segment aliases.
2. Exact zero-segment routes match only `/`; non-exact zero-segment routes match
   every parent residue and forward it unchanged.
3. A non-exact zero-segment route remains selected when none of its descendants
   match; matching does not backtrack to a parent fallback.
4. Existing index declarations with `exact` retain their behavior, while the
   compatibility change for non-exact aliases is documented and diagnosed.
5. A group contributes no segment to matching, href generation, redirects, or
   browser history.
6. A group that has never activated can still be selected by a matching child.
7. An unrelated direct sibling does not activate the group.
8. An unmatched group does not suppress a parent fallback.
9. Group-local index and fallback routes remain scoped to the group.
10. Nested groups preserve residue and lifecycle ordering.
11. Multiple matching groups retain the router's match-all sibling behavior.
12. Child navigation retains group DOM and component-local state.
13. Entry guards run before any loading; exit guards run deepest-first.
14. Guard denial, redirect, lifecycle failure, and supersession are atomic.
15. Titles and nearest error boundaries include the group in hierarchy order.
16. Local guard denial and local error recovery rematch the intended stage.
17. Query/hash transitions and `group.reload({ plan })` follow normal transition
    semantics.
18. `href`, `load`, `reload`, `isActive`, active links, and `getPaths` follow the
    structural-context rules above.
19. Direct navigation to a group produces a clear error instead of a misleading
    parent URL.
20. Relative child links and redirects use the parent's URL base.
21. Static, bound, conditional, and repeated child declarations have explicit,
    tested discovery behavior before first group activation.
22. Adding or removing a group while its descendant matches updates the active
    tree without duplicate layout activation.
23. Browser Back/Forward denial restores both the URL and the complete grouped
    view tree.

## Recommended decision

Adopt both zero-segment tools with distinct names and contracts:

- a normal zero-segment path follows `exact`: index-only with it,
  unconditional prefix matching without it, and never descendant backtracking;
- `group` means **descendant-selected, zero-URL structural branch**.

The second behavior is what unlocks authenticated shells, grouped
authorization, titles, and error boundaries for selected routes without URL
prefixes. Do not blur it with the first behavior. If inactive child discovery is
too large for the first group release, introduce an explicit `match` hint as a
constrained MVP and keep the full descendant-aware contract as the target.
