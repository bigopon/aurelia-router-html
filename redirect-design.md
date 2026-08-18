# Redirect Design

## Status

This document records the current redirect model, its interaction with local
guard and error recovery, known coverage, unresolved ambiguity, and the
recommended contract for competing redirect requests.

The central scope rule is:

> Only explicit local recovery is local. Every redirect starts a complete
> navigation to a new location.

Route nesting changes how a contextual destination is resolved and may allow
shared ancestors to remain mounted at the destination. It does not make the
redirect branch-local.

## Current outcomes

Legend:

- **Complete** means the behavior is implemented and directly covered.
- **Partial** means the behavior is documented or implied but lacks focused
  interaction coverage.
- **Missing** means the contract, implementation, or both still need work.

| Trigger | Modifier or result | URL outcome | Route-tree outcome | Coverage |
| --- | --- | --- | --- | --- |
| `canLoad` returns `true` | Any `guard-failure` | Commit requested URL | Commit candidate tree | Complete |
| `canLoad` returns `false` | Default `navigation` | Keep previous URL | Restore previous tree | Complete |
| `canLoad` returns `false` | `guard-failure="local"` | Commit requested URL | Exclude denied subtree and rematch its siblings | Complete |
| `canLoad` returns a redirect | Default `navigation` | Navigate to redirect target | Replace candidate with target tree | Complete |
| `canLoad` returns a redirect | `guard-failure="local"` | Navigate to redirect target | Complete redirect; `local` has no effect | Partial: documented, no focused interaction test |
| `canUnload` returns `false` | Any `guard-failure` | Keep previous URL | Keep complete previous tree | Complete |
| Lifecycle callback throws | No accepting `on-error` | Keep previous URL | Roll back candidate tree | Complete |
| Lifecycle callback throws | `on-error` returns `{ recover: 'local' }` | Commit requested URL | Exclude failed subtree and rematch its siblings | Complete |
| Lifecycle callback throws | `on-error` returns a redirect | Navigate to redirect target | Replace candidate with target tree | Complete |
| Declarative `redirect-to` | Any matching redirect route | Navigate to redirect target | Redirect route renders nothing; target tree wins | Complete |
| A local fallback is itself a redirect route | Local denial or recovery | Expected to navigate to the fallback redirect target | Local rematch triggers a subsequent complete redirect | Partial: not explicitly documented or tested |

The focused guard-failure guide states that local mode applies only when
`canLoad` returns `false`; redirects remain redirects, exceptions use error
recovery, and `canUnload` remains navigation-wide.

## Influencing factors

| Factor | Possibilities | What it influences | What it does not influence |
| --- | --- | --- | --- |
| Redirect source | `redirect-to`, `canLoad`, `on-error` | When and why a redirect is requested | Redirect scope; all are complete navigations |
| Destination form | Root `/login`, contextual `login`, future `../login`, `?x`, or `#x` | Destination resolution | Transaction scope |
| Route nesting | Root or nested redirect | Contextual base and retained shared ancestors | Whether the redirect is complete or local |
| Parameters | Static, inherited, or explicitly supplied | Concrete destination | Redirect arbitration |
| History mode | Default replace or explicit push | Whether the source remains in history | Matching or redirect scope |
| Matching kind | Regular, exact, or fallback | When the redirect route is selected | Destination semantics |
| Guard failure mode | `navigation` or `local` | Only the meaning of `canLoad` returning `false` | Redirects, errors, and `canUnload` |
| Error result | Bubble, local recovery, or redirect | Error recovery strategy | Guard-failure behavior |
| Navigation source | Link/load, initial URL, or Back/Forward | Adapter commit and rollback mechanics | Redirect scope |
| Transition kind | Entry, rerun, or replacement | Which `canLoad` invocation produced the redirect | Final complete-navigation behavior |
| Concurrent matches | One or several matched siblings | Number of possible redirect requests | Currently lacks complete arbitration |
| Redirect chain | Single, multi-hop, or loop | Final destination and loop detection | Local recovery behavior |

## Coverage matrix

| Scenario | Implementation | Node test | Browser test | Docs or example | Status |
| --- | --- | --- | --- | --- | --- |
| Static declarative redirect | Yes | Yes | Yes | Yes | Complete |
| Parameterized redirect | Yes | Yes | Yes | Yes | Complete |
| Contextual nested redirect | Yes | Yes | Yes | Yes | Complete |
| Root-absolute redirect | Yes | Yes | Yes | Yes | Complete |
| Nested index redirect | Yes | Yes | Yes | Yes | Complete |
| Fallback redirect | Yes | Yes | Yes | Yes | Complete |
| Dynamic bound redirect | Yes | Yes | Limited | Yes | Good |
| Default replace history | Yes | Yes | Yes | Yes | Complete |
| Explicit push history | Yes | Yes | Partial | Yes | Good |
| Multi-hop chain | Yes | Yes | Yes | Yes | Complete |
| Redirect-loop detection | Yes | Yes | Limited | Yes | Good |
| Guard redirect | Yes | Yes | Yes | Yes | Complete |
| Error-boundary redirect | Yes | Yes | Indirect | Yes | Good |
| Redirect after external traversal | Yes | Yes | Indirect | Limited | Good |
| Redirect adapter-commit failure | Yes | Yes | No | Checklist only | Good |
| `guard-failure="local"` plus guard redirect | Expected to be complete-navigation | No | Browser example has separate cases | One sentence | Missing interaction test |
| Local guard fallback that redirects | Likely composes with current behavior | No | No | No | Missing contract and tests |
| Local error fallback that redirects | Likely composes with current behavior | No | No | No | Missing contract and tests |
| Redirect during retained rerun | Supported by the stated API | No focused test | No | Generic lifecycle docs | Missing interaction test |
| Redirect during replacement | Supported by the stated API | No focused test | No | Generic lifecycle docs | Missing interaction test |
| Redirect plus ordinary matching sibling | Incidental transaction cancellation | No | No | No | Needs explicit rule |
| Two matching redirects with the same target and mode | Later requests can overwrite | No | No | No | Undefined arbitration |
| Two matching redirects with different targets | Later requests can overwrite | No | No | No | Correctness gap |
| Same target with different push/replace modes | No conflict rule | No | No | No | Correctness gap |
| Declarative and guard redirects competing | No conflict rule | No | No | No | Correctness gap |
| Guard and error redirects competing | No conflict rule | No | No | No | Correctness gap |
| `../`, query-only, and hash-only redirect targets | No | No | No | Roadmap only | Planned in relative URL resolution |
| Traversal beyond the route root | Not defined | No | No | Roadmap flags the decision | Planned in relative URL resolution |

## Competing redirects

The coordinator currently stores one redirect intent on the active transaction:

```ts
transaction.redirect = {
  path,
  replace,
};
```

A later request can overwrite the earlier intent. Because Router HTML preserves
match-all sibling behavior, competing redirect requests can therefore depend on
callback or activation order. Rendering matches can compose; redirect commands
cannot.

Redirect arbitration should use normalized destinations and history modes:

| Requests in one transaction | Required result |
| --- | --- |
| One redirect | Accept it |
| Multiple redirects to the same normalized target with the same history mode | Coalesce them and issue a development warning |
| Same normalized target with different history modes | Fail with an ambiguous redirect error |
| Different normalized targets | Fail with an ambiguous redirect error |
| Redirect plus ordinary matching sibling | Redirect wins the transaction, but no sibling candidate view may commit |
| Redirect plus local recovery from independently matched work | Treat as ambiguous unless ordering makes one result obsolete before the other can be produced |

Arbitration must cover every redirect source, not only declarative
`redirect-to`. Guard redirects and error-boundary redirects from simultaneously
matched branches can conflict in the same way.

An ambiguity error should identify the requested location, each redirect
source, its resolved destination, and its history mode. For example:

```text
Ambiguous redirects for "/legacy":
- route "/legacy" -> "/login" (replace)
- route "/legacy" -> "/home" (replace)
```

## Local-only redirects

A local-only redirect needs careful definition because Router HTML has one
committed location and derives the complete active route tree from it. Changing
the URL for only one branch would leave other matched branches derived from a
different location, violating transaction and route-state coherence.

Three requests can sound like a local redirect but already have distinct
solutions:

| Application intent | Existing mechanism |
| --- | --- |
| Keep the requested URL but render a sibling such as an access-denied panel | `guard-failure="local"` plus a sibling fallback |
| Keep the requested URL but recover a failed subtree with sibling UI | `on-error` returning `{ recover: 'local' }` |
| Navigate to a sibling URL such as `/area/private` to `/area/login` while retaining the shared `/area` shell | A contextual redirect to `login`; it is still a complete navigation, and normal matching retains the shared ancestor |

A fourth interpretation—changing a branch's route without changing the
committed URL—is composition or local state, not a redirect. Aurelia template
controllers, conditional composition, or a local state machine are a better
fit. Naming that operation a redirect would obscure the invariant that URL
state selects the route tree.

### Recommendation

Do not add a local-only redirect to the current routing model.

- Keep redirects as complete navigations.
- Keep local recovery at the same URL as sibling rematching.
- Use contextual targets when a complete redirect should remain within a
  subtree and naturally retain its shared ancestors.
- Reconsider branch-local navigation only if Router HTML later introduces
  independently addressed outlets or auxiliary route state. That would require
  its own location model, active-state rules, history serialization, and link
  syntax rather than an option on the existing redirect result.

The boundary should be stated explicitly in public documentation:

> `local` changes recovery scope, not URL scope. A redirect always selects a
> new complete route location.

## Missing tests in priority order

1. Two matching redirects to different targets fail as ambiguous.
2. Two redirects to the same target and history mode coalesce.
3. The same target with `push` and `replace` fails as ambiguous.
4. A declarative redirect competing with a guard redirect fails as ambiguous.
5. `guard-failure="local"` on a route whose `canLoad` returns a redirect proves
   that the redirect remains complete-navigation.
6. A locally denied route whose sibling fallback is a redirect establishes
   whether that composition is supported.
7. A locally recovered error whose sibling fallback is a redirect establishes
   the corresponding error-recovery behavior.
8. A guard redirect during `transition-plan="rerun"` rolls back retained work
   before starting the redirect.
9. A guard redirect during `transition-plan="replace"` restores the previous
   view before starting the redirect.
10. Relative redirects receive the complete feature-4 target matrix, including
    `../`, repeated parent traversal, query-only targets, hash-only targets, and
    traversal beyond the route root.

The first four items close correctness gaps. The remaining items make existing
or planned interactions explicit and protect them from regression.

## Relevant current coverage

- Declarative redirect tests: `tests/au-route.spec.ts`, under
  `au-route redirects`.
- Guard redirect and local guard recovery tests: `tests/au-route.spec.ts`, under
  `au-route navigation guards`.
- Error redirect and local error recovery tests: `tests/au-route.spec.ts`, under
  `au-route error recovery`.
- Redirect adapter settlement tests: `tests/path-adapter.spec.ts`.
- Browser guard redirect and local recovery flow: `playwright/app.spec.ts`, test
  `A8 browser navigation commits only after guards approve, redirect, or
  recover locally`.
- Focused guides: `docs-app/src/pages/feature-redirects-page.html`,
  `docs-app/src/pages/feature-guard-failure-page.html`, and
  `docs-app/src/pages/feature-error-recovery-page.html`.
