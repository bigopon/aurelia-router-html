# Route Animation Design

Status: active design note for roadmap item 9. The current router now supports
the transition-settlement foundation of the unified `animate` API: route-level
animate normalization, compatibility with the existing CSS-class path,
callback-based completion, real CSS end-event settlement, bounded fallback
timing, router-owned reduced-motion handling, and abort-aware supersession
handling. The broader accessibility announcement work remains for later.

## Short version

The current route animation surface is intentionally small:

```html
<au-route path="details" animate>
  ...
</au-route>
```

That works well for CSS transitions driven by route enter and leave classes.

The next step should not grow a separate "CSS mode" API and "JavaScript mode"
API. The better direction is one `animate` property that accepts a few
different shapes and normalizes them internally.

Current direction:

- keep `animate` as the single route-level entry point;
- continue supporting simple CSS-driven animation;
- allow callback-driven animation through the same property;
- keep reduced-motion behavior part of the router-supported transition story
  when the router owns animation settlement.

## Implemented foundation

The first implementation pass stayed narrower than the full roadmap item, and
that foundation is now in place:

1. `animate` normalizes into one internal animation descriptor;
2. the CSS-class workflow runs through that normalized descriptor;
3. callback-based animation completion is supported;
4. abort and supersession cancellation run through the same contract;
5. CSS settlement prefers real end events and falls back only when those
   signals never arrive.

That means the router is now ready to support both CSS and callback animation
under one route-level property without trying to solve every transition and
accessibility concern in the same change. Settled announcements and the
broader accessibility contract remain the follow-up scope.

## Why a single property is better

If route animation stays on one concept, the API remains easier to teach:

- `animate` means "this route participates in transition choreography";
- the value decides how that choreography runs.

That is cleaner than splitting the idea into several unrelated properties such
as:

- `animate`;
- `animation-name`;
- `animation-callback`;
- `animation-mode`;
- `reduced-motion`.

One route-level concept also makes later documentation easier. The route either
opts into animation or it does not.

## Proposed shapes

Possible forms:

```html
<au-route path="a" animate>
<au-route path="b" animate="fade">
<au-route path="c" animate.bind="animateRoute">
<au-route path="d" animate.bind="{ kind: 'css', name: 'fade' }">
<au-route path="e" animate.bind="{ kind: 'js', run: animateRoute }">
```

The intended meaning:

- bare `animate` uses the default built-in CSS behavior;
- a string selects a CSS preset or class naming variant;
- a function uses a JavaScript callback;
- an object form is the explicit advanced shape.

## Proposed normalized internal model

One possible internal shape:

```ts
type RouteAnimation =
  | boolean
  | string
  | RouteAnimationCallback
  | RouteAnimationConfig;

type RouteAnimationCallback =
  (context: RouteAnimationContext) => void | Promise<void>;

interface RouteAnimationConfig {
  kind?: 'css' | 'js';
  name?: string;
  run?: RouteAnimationCallback;
  fallbackMs?: number;
}
```

Normalization would then be simple:

- `true` becomes `{ kind: 'css', name: 'default' }`;
- `'fade'` becomes `{ kind: 'css', name: 'fade' }`;
- a function becomes `{ kind: 'js', run: fn }`;
- an object remains the explicit descriptor.

The first version should likely choose one route animation source per route. If
combined CSS plus callback behavior is ever useful later, it can be added
explicitly rather than by accident. The current implementation keeps one
animation source per route so the settlement contract stays simple.

For the immediate slice, the important part is normalization itself:

- route declarations keep using one public `animate` property;
- internal code consumes one descriptor shape;
- CSS and callback animation both settle through that shared internal model.

## Callback direction

Callback animation should be the stronger primitive rather than
an afterthought layered under CSS classes.

Possible context shape:

```ts
interface RouteAnimationContext {
  readonly signal: AbortSignal;
  readonly reducedMotion: boolean;
  readonly swapOrder: 'attach-next-detach-current'
    | 'detach-current-attach-next'
    | 'parallel';
  readonly currentElement: Element | null;
  readonly nextElement: Element | null;
  readonly from: unknown | null;
  readonly to: unknown | null;
}
```

Why the callback direction is useful:

- exact completion through promise settlement;
- straightforward support for the Web Animations API or external animation
  libraries;
- natural cancellation through `AbortSignal`;
- direct reduced-motion branching without forcing CSS media-query-only designs;
- less dependence on guessed timing.

For the implemented foundation, callback support only needs one
completion rule:

- the callback may return nothing for synchronous completion;
- or return a promise that resolves when the route transition is done.

That is enough to establish a real callback-based settlement point without
locking in a richer handle API yet.

## Relationship to CSS class animation

CSS class animation should remain the low-friction convenience path:

- easy to read in templates;
- easy to style in docs and simple apps;
- no JavaScript callback required.

But callback animation is the better long-term primitive for precise
settlement, cancellation, and accessibility-aware behavior.

So the likely layering is:

- callback or normalized `animate` descriptor is the core model;
- CSS classes are one built-in animation strategy;
- router settlement waits on whichever strategy is active.

This also keeps backward compatibility straightforward for the current pass:

- existing `animate` routes keep receiving CSS classes;
- the router just reaches that behavior through normalization instead of a
  separate CSS-only branch;
- callback animation becomes an additive capability rather than a replacement.

## Reduced motion

Because the router owns transition settlement, reduced-motion support is part
of the router-supported transition model rather than being entirely delegated
to every application.

The shipped foundation keeps the safe path built in:

- CSS-based animation can pair with `@media (prefers-reduced-motion: reduce)`
  without opting out of router settlement;
- callback animation can branch on the reduced-motion-aware context instead of
  re-discovering platform preference independently;
- the built-in behavior does not force unnecessary motion when the platform has
  explicitly requested less motion.

## Real completion and fallback timing

Route settlement needs a reliable completion point, and the current
implementation now prefers actual completion semantics:

- `transitionend` / `animationend` for CSS-driven transitions;
- promise completion for callback-driven transitions.

It still keeps a bounded fallback when browser completion events do not arrive.
That fallback remains important because CSS events can be skipped or lost when
transitions are interrupted or elements detach early.

Cancellation is also part of the contract:

- when a navigation is superseded, route animation work stops participating in
  the old settlement path;
- callback animation receives an `AbortSignal`;
- CSS-based settlement also stops waiting on an obsolete transition once that
  navigation has been cancelled or replaced.

## Recommendation for later work

When roadmap item 9 is picked up:

- keep `animate` as the single public route-level entry point;
- preserve today's CSS class workflow;
- keep callback and object forms on the normalized API, not parallel APIs;
- keep final settlement on real completion semantics, with bounded fallback only
  as a safety net;
- add settled announcements and the remaining accessibility feedback policy on
  top of the already shipped reduced-motion support.
