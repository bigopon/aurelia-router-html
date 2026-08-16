import template from './overview-page.html?raw';

interface OverviewFeature {
  title: string;
  summary: string;
  path: string;
  playgroundId: string;
  syntax: string;
  language?: 'html' | 'typescript';
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
      summary: 'Declare contextual routes, then link within the current route or from the root.',
      path: '/features/basic',
      playgroundId: 'basic-routes',
      syntax: '<au-route path="products">Products</au-route>\n<a\n  href="/products"\n  class.bind="$route.isActive(\'/products\', {}, { exact: true }) ? \'is-active\' : \'\'">\n  Native URL\n</a>\n<a au-link="products">Contextual route</a>\n<a au-link="/products">Root route</a>',
    },
    {
      title: 'Nested Routes',
      summary: 'Keep a parent layout mounted while child routes change.',
      path: '/features/nested',
      playgroundId: 'nested-routes',
      syntax: '<au-route path="account">\n  <au-route path="profile">Profile</au-route>\n</au-route>',
    },
    {
      title: 'Params',
      summary: 'Give each nested route its own URL parameters and access ancestors explicitly.',
      path: '/features/params',
      playgroundId: 'route-params',
      syntax: '<au-route path="users/:userId">\n  User: ${$params.userId}\n  <au-route path="posts/:postId">\n    Post: ${$params.postId}\n    User: ${$route.parent.$params.userId}\n  </au-route>\n</au-route>',
    },
    {
      title: 'Query, Hash & URL Modes',
      summary: 'Carry URL state separately from matching and choose how routes appear in the browser address bar.',
      path: '/features/url-state',
      playgroundId: 'url-state',
      syntax: '<au-route path="products/:productId">\n  Sort: ${$query.get(\'sort\')}\n  Section: ${$hash}\n</au-route>',
    },
    {
      title: 'Active Links',
      summary: 'Generate hrefs and selected navigation state from the same registered route target.',
      path: '/features/active-links',
      playgroundId: 'active-links',
      syntax: '<a au-link="reviews">Reviews</a>\n<a au-link="/products">All products</a>',
    },
    {
      title: 'Programmatic Navigation',
      summary: 'Navigate from application logic through the same contextual API available as $route.',
      path: '/features/programmatic',
      playgroundId: 'programmatic-navigation',
      language: 'typescript',
      syntax: 'private readonly route = resolve(IRouteContext);\n\nthis.route.load(\n  \'/products/:id/reviews\',\n  { id },\n  { query: { sort: \'recent\' } }\n);',
    },
    {
      title: 'Routing Adapters',
      summary: 'Run the same route tree with browser history, memory history, or an application-specific location host.',
      path: '/features/adapters',
      playgroundId: 'memory-adapter',
      language: 'typescript',
      syntax: 'const adapter = new MemoryPathAdapter(\'/dashboard\');\n\nRouting.customize({\n  adapter\n});',
    },
    {
      title: 'Conditional Routes',
      summary: 'Add and remove routes with Aurelia template controllers.',
      path: '/features/conditional',
      playgroundId: 'conditional-routes',
      syntax: '<au-route if.bind="canEdit" path="edit">Edit</au-route>',
    },
    {
      title: 'Repeated Routes',
      summary: 'Generate route branches from application data.',
      path: '/features/repeated',
      playgroundId: 'repeated-routes',
      syntax: '<template repeat.for="tab of tabs">\n  <au-route path.bind="tab.path">${tab.label}</au-route>\n</template>',
    },
    {
      title: 'Exact & Fallback Matching',
      summary: 'Choose complete matches or recover when every regular sibling misses.',
      path: '/features/matching',
      playgroundId: 'exact-fallback',
      syntax: '<au-route path="products/:id" exact>Required ID</au-route>\n<au-route path="offers/:id?" exact>Optional ID</au-route>\n<au-route path="*" fallback>Not found</au-route>',
    },
    {
      title: 'Wildcard Paths',
      summary: 'Capture one segment or consume every remaining segment with symmetrical link parameters.',
      path: '/features/wildcards',
      playgroundId: 'wildcard-paths',
      syntax: '<au-route path="date/*/summary" exact>\n  Date: ${$params[\'*\']}\n</au-route>\n<au-route path="files/**">\n  Terminal segment: ${$params[\'**\']}\n  Remaining: ${$route.residue}\n</au-route>',
    },
    {
      title: 'Swap Order',
      summary: 'Coordinate outgoing and incoming sibling views in parallel.',
      path: '/features/swap',
      playgroundId: 'swap-order',
      syntax: '<au-route path="products/:id" swap-order="parallel">\n  <au-route path="specs">Specs</au-route>\n  <au-route path="reviews">Reviews</au-route>\n</au-route>',
    },
    {
      title: 'Animations',
      summary: 'Opt individual routes into CSS-driven enter and leave transitions.',
      path: '/features/animation',
      playgroundId: 'route-animations',
      syntax: '<au-route path="panel" animate>Animated panel</au-route>',
    },
    {
      title: 'Shared State',
      summary: 'Bind routed views to the same application state without route-specific plumbing.',
      path: '/features/shared-state',
      playgroundId: 'shared-state',
      syntax: '<au-route path="cart">\n  Items: ${state.totalQty}\n</au-route>',
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
