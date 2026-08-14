# Test Checklist

- [x] `A0` Initial load at `/store` renders the parent route and the nested index route.
- [x] `A0` Initial load at `/store/123/order` renders nested parameter and lazy order content.
- [x] `A0` Anchor navigation updates the visible route branch and URL together.
- [x] `A0` Browser back and forward navigation restore the expected route branch.
- [x] `A1` Markup between nested `au-route` elements remains visible while the parent route is active.
- [x] `A1` The `/store` index branch is not shown when `/store/:storeId` is active.
- [x] `A1` Route params are exposed to the matching branch and to lazy loaded content.
- [x] `A1` `RouteContext` exact static match activates and leaves `/` residue when fully consumed.
- [x] `A1` `RouteContext` parameter match extracts params and forwards remaining residue.
- [x] `A1` `RouteContext` non-match deactivates the branch and clears params.
- [x] `A1` Child contexts update when the parent residue changes across successive `apply()` calls.
- [x] `A2` Trailing slash input normalizes to the same match state as the non-trailing form.
- [x] `A2` Repeated `apply()` with the same path preserves stable state for params and residue.
- [x] `A2` Disposed child contexts stop receiving parent updates.
