# Exclusive Matching

Status: design proposal for roadmap item 8. Exclusive matching is not
implemented yet.

## Short version

Router HTML currently uses child-driven, match-all sibling behavior:

- a parent exposes residue to its children;
- each child independently tries to match that residue;
- every matching sibling may become active.

That model is deliberate. It fits pathless groups, overlapping matches,
parallel branches, and the active-branch snapshot API.

If the router ever adds an exclusive mode, it should not quietly replace that
model. The feature needs to remain opt-in, local, and explicit about the fact
that it changes how one sibling set settles.

The current direction is:

- do not make exclusivity the default;
- do not frame it as "the router finally picking one correct route";
- prefer a child-level exclusivity declaration over a parent-owned ranking
  policy;
- leave declaration timing and exact tie behavior open until there is stronger
  application pressure.

## Why this is hard in this router

The clean matching story today is:

1. a parent owns scope and residue;
2. children request residue from that parent;
3. children decide whether they match;
4. rendering is the result of matching children, not parent arbitration.

That means the current mental model is structural and child-driven. The parent
does not inspect its children and choose a winner.

An exclusive feature risks introducing a second model:

1. children still match normally;
2. some extra rule filters the successful sibling set;
3. rendering becomes "who matched and won" rather than simply "who matched."

That is a meaningful conceptual cost. Even if the implementation is only a
small post-processing step, the semantics are different.

## Parent-owned mode versus child-owned declaration

One possible shape is a parent-level mode:

```html
<au-route path="products" match-mode="best">
  <au-route path="new" exact>New</au-route>
  <au-route path=":id" exact>Details</au-route>
</au-route>
```

This is easy to describe, but it shifts too much control to the parent:

- the parent is no longer only exposing residue;
- the parent is now arbitrating among successful children;
- "best match" requires a ranking algorithm that becomes a parent concern.

That feels at odds with the router's current model.

A better fit is a child-owned declaration:

```html
<au-route path="new" exact exclusive>New</au-route>
<au-route path=":id" exact>Details</au-route>
```

That keeps the story closer to the current design:

- the parent still exposes residue;
- children still decide whether they match;
- a child may additionally declare that its match is exclusive within the
  sibling set;
- the parent only enforces the sibling constraint after ordinary matching.

This is still a semantic extension, but it is less of a mental-model break than
`match-mode="best"` on the parent.

## Current preferred framing

If the feature is added later, it should be framed as:

- an opt-in sibling-conflict declaration;
- local to one parent context;
- preserving match-all behavior by default;
- not changing ancestor or descendant ownership rules;
- not pretending there is always one singular active route chain.

The intended meaning is not "only one route in the entire router may match." It
is narrower:

> Within one sibling set, a matching exclusive route suppresses other regular
> sibling matches that would otherwise stay active.

## Open questions

### 1. Surface spelling

The simplest spelling is likely route-local:

```html
<au-route path="new" exact exclusive>New</au-route>
```

Other spellings are possible, but the main requirement is that the declaration
should read as a property of that route, not as a hidden global policy shift.

### 2. Declaration timing

We do not need to lock this down yet.

One plausible implementation direction is for an exclusive child to signal its
parent early during construction or route-context registration, so the parent
already knows which children carry exclusivity metadata before matching runs.

That said, the important design choice is not the exact timing. The important
choice is ownership:

- child declares;
- parent enforces locally.

Timing can be decided later.

### 3. What does exclusivity suppress?

A first version should probably suppress only regular matching siblings in the
same parent context.

It should not:

- suppress ancestors;
- suppress descendants outside the chosen branch;
- change fallback semantics globally;
- rewrite matching in unrelated sibling sets.

### 4. What if two exclusive siblings both match?

This is the hardest contract question.

Possible outcomes:

- development-time error when multiple exclusive siblings match;
- deterministic declaration-order winner;
- a more formal specificity rule.

The safest initial stance is that multiple successful exclusive siblings should
probably be treated as a design error unless a clearly better rule emerges.

### 5. What if one exclusive sibling and one non-exclusive sibling both match?

The current design direction would be:

- both children match normally;
- the exclusive sibling suppresses the non-exclusive sibling at that parent
  level.

This is the core behavior that makes the feature useful without requiring a
full ranking system.

### 6. How do fallbacks behave?

Fallback should remain fallback:

- regular sibling matching settles first;
- fallback participates only when no regular sibling remains after exclusivity
  filtering.

The feature should not make fallback part of a generic "best match" ranking
algorithm.

### 7. How do constraints, exact routes, and dynamic registration interact?

This is where a parent-owned "best match" mode becomes expensive:

- constrained params versus unconstrained params;
- static versus dynamic segments;
- exact versus prefix matches;
- routes added or removed later through conditional or repeated markup.

The child-owned `exclusive` concept avoids some of that complexity because it
does not need the router to infer a total ordering across all siblings. It only
needs to honor explicitly declared exclusivity.

## Recommendation for later work

If exclusive matching ever becomes necessary, treat it as a narrow composition
feature rather than a general correction to the router's matching model.

Recommended design bar:

- keep match-all sibling behavior as the default;
- prefer child-level `exclusive` over parent `match-mode="best"`;
- define exclusivity as a sibling-set constraint, not a global ranking engine;
- reject or loudly define multiple-exclusive conflicts;
- document clearly that the router still supports multiple active branches in
  general.

Until there is stronger application pressure, this should remain a design note
rather than an implementation target.
