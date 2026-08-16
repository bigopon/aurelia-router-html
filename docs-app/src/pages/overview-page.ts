import template from './overview-page.html?raw';

interface OverviewFeature {
  title: string;
  summary: string;
  path: string;
  playgroundId: string;
  syntax: string;
}

export class OverviewPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'overview-page',
    template,
  } as const;

  public readonly features: OverviewFeature[] = [
    {
      title: 'Basic Routes',
      summary: 'Map a URL directly to the markup visitors should see.',
      path: '/features/basic',
      playgroundId: 'basic-routes',
      syntax: '<au-route path="/welcome">Welcome</au-route>',
    },
    {
      title: 'Nested Routes',
      summary: 'Keep a parent layout mounted while child routes change.',
      path: '/features/nested',
      playgroundId: 'nested-routes',
      syntax: '<au-route path="/account">\n  <au-route path="/profile">Profile</au-route>\n</au-route>',
    },
    {
      title: 'Params',
      summary: 'Give each nested route its own URL parameters and access ancestors explicitly.',
      path: '/features/params',
      playgroundId: 'route-params',
      syntax: '<au-route path="/users/:userId">\n  User: ${$params.userId}\n  <au-route path="/posts/:postId">\n    Post: ${$params.postId}\n    User: ${$route.parent.$params.userId}\n  </au-route>\n</au-route>',
    },
    {
      title: 'Query, Hash & URL Modes',
      summary: 'Carry URL state separately from matching and choose how routes appear in the browser address bar.',
      path: '/features/url-state',
      playgroundId: 'url-state',
      syntax: '<au-route path="/products/:productId">\n  Sort: ${$query.get(\'sort\')}\n  Section: ${$hash}\n</au-route>',
    },
    {
      title: 'Conditional Routes',
      summary: 'Add and remove routes with Aurelia template controllers.',
      path: '/features/conditional',
      playgroundId: 'conditional-routes',
      syntax: '<au-route if.bind="canEdit" path="/edit">Edit</au-route>',
    },
    {
      title: 'Repeated Routes',
      summary: 'Generate route branches from application data.',
      path: '/features/repeated',
      playgroundId: 'repeated-routes',
      syntax: '<template repeat.for="tab of tabs">\n  <au-route path.bind="tab.path">${tab.label}</au-route>\n</template>',
    },
    {
      title: 'Exact, Fallback & Terminal Paths',
      summary: 'Choose complete matches, recover when siblings miss, or consume the complete remaining URL.',
      path: '/features/matching',
      playgroundId: 'exact-fallback',
      syntax: '<au-route path="/products" exact>Products</au-route>\n<au-route path="*" fallback>Not found</au-route>\n<au-route path="/files/**">\n  Terminal segment: ${$params[\'**\']}\n  Remaining: ${$route.residue}\n</au-route>',
    },
    {
      title: 'Swap Order',
      summary: 'Coordinate outgoing and incoming sibling views in parallel.',
      path: '/features/swap',
      playgroundId: 'swap-order',
      syntax: '<au-route path="/products/:id" swap-order="parallel">\n  <au-route path="/specs">Specs</au-route>\n  <au-route path="/reviews">Reviews</au-route>\n</au-route>',
    },
    {
      title: 'Animations',
      summary: 'Opt individual routes into CSS-driven enter and leave transitions.',
      path: '/features/animation',
      playgroundId: 'route-animations',
      syntax: '<au-route path="/panel" animate>Animated panel</au-route>',
    },
    {
      title: 'Shared State',
      summary: 'Bind routed views to the same application state without route-specific plumbing.',
      path: '/features/shared-state',
      playgroundId: 'shared-state',
      syntax: '<au-route path="/cart">\n  Items: ${state.totalQty}\n</au-route>',
    },
    {
      title: 'Kitchen Sink',
      summary: 'Build simple rooms and pages from Aurelia scopes, slots, bindings, and repeated routes.',
      path: '/features/kitchen-sink',
      playgroundId: 'kitchen-sink',
      syntax: '<template repeat.for="room of rooms">\n  <au-route path.bind="room.path">\n    <room-shell>...</room-shell>\n  </au-route>\n</template>',
    },
  ];

  public playgroundPath(feature: OverviewFeature): string {
    return `/playground/${feature.playgroundId}`;
  }
}
