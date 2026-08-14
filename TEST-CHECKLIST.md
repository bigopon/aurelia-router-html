# Test Checklist

- [x] `A0` Initial load at `/store` renders the parent route and the nested index route.
- [x] `A0` Initial load at `/store/123/order` renders nested parameter and lazy order content.
- [x] `A0` Anchor navigation updates the visible route branch and URL together.
- [x] `A0` Browser back and forward navigation restore the expected route branch.
- [x] `A1` Markup between nested `au-route` elements remains visible while the parent route is active.
- [x] `A1` The `/store` index branch is not shown when `/store/:storeId` is active.
- [x] `A1` Route params are exposed to the matching branch and to lazy loaded content.
