export interface PlaygroundExample {
  id: string;
  title: string;
  description: string;
  entry: string;
  initialFile?: string;
  initialPath: string;
  files: Record<string, string>;
}

interface RouterExampleOptions {
  id: string;
  title: string;
  description: string;
  initialPath: string;
  appHtml: string;
  appTs?: string;
  appCss?: string;
  extraFiles?: Record<string, string>;
  routingMode?: 'path' | 'hash' | 'query';
  routeQueryKey?: string;
}

const baseCss = `:root {
  font-family: Inter, system-ui, sans-serif;
  color: #17202c;
}

body {
  margin: 0;
  background: #f3f7f5;
}

#app {
  display: block;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

a,
button {
  padding: 9px 12px;
  border: 1px solid #9cbab4;
  border-radius: 999px;
  color: #075f57;
  background: white;
}

a {
  text-decoration: none;
}

main,
.stage,
.room-shell {
  display: block;
  min-height: 120px;
  padding: 22px;
  border: 1px solid #cbdad7;
  border-radius: 18px;
  background: white;
}

h1,
h2 {
  margin-top: 0;
}`;

const featureExamples: PlaygroundExample[] = [
  routerExample({
    id: 'basic-routes',
    title: 'Basic routes',
    description: 'Map simple URLs directly to their rendered markup.',
    initialPath: '/welcome',
    appHtml: `<nav>
  <a href="/welcome">Welcome</a>
  <a href="/about">About</a>
</nav>
<main>
  <au-route path="/welcome">
    <h1>Welcome</h1>
    <p>Your first declarative route is running.</p>
  </au-route>
  <au-route path="/about">
    <h1>About</h1>
    <p>Each URL owns the markup it displays.</p>
  </au-route>
</main>`,
  }),
  routerExample({
    id: 'nested-routes',
    title: 'Nested routes',
    description: 'Keep an account layout mounted while its child route changes.',
    initialPath: '/account/profile',
    appHtml: `<au-route path="/account">
  <h1>Account</h1>
  <nav>
    <a href="/account/profile">Profile</a>
    <a href="/account/security">Security</a>
  </nav>
  <au-route path="/profile">
    <h2>Profile</h2>
    <p>Update your public details.</p>
  </au-route>
  <au-route path="/security">
    <h2>Security</h2>
    <p>Review your sign-in settings.</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'route-params',
    title: 'Nested route parameters',
    description: 'Keep each route parameter local and reach parent parameters explicitly when a child needs them.',
    initialPath: '/users/ada/posts/routing-basics',
    appHtml: `<nav>
  <a href="/users/ada/posts/routing-basics">Ada / Routing</a>
  <a href="/users/grace/posts/compiler-design">Grace / Compilers</a>
</nav>
<au-route path="/users/:userId">
  <h1>Parent user: \${$params.userId}</h1>
  <p>This view owns <code>$params.userId</code>.</p>
  <au-route path="/posts/:postId">
    <h2>Child post: \${$params.postId}</h2>
    <p>This view owns <code>$params.postId</code>.</p>
    <p>Parent user from child: \${$route.parent.$params.userId}</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'url-state',
    title: 'Path mode with URL state',
    description: 'Change query and fragment state without changing the matched product route.',
    initialPath: '/products/ice-cream?sort=popular#reviews',
    appHtml: `<au-route path="/products/:productId" exact>
  <nav>
    <a href.bind="$route.href($route, $params, { query: { sort: 'popular' }, hash: 'reviews' })">
      Popular reviews
    </a>
    <a href.bind="$route.href($route, $params, { query: { sort: 'price' }, hash: 'details' })">
      Price details
    </a>
  </nav>
  <h1>Product: \${$params.productId}</h1>
  <p>Sort: <strong>\${$query.get('sort')}</strong></p>
  <p>Section: <strong>\${$hash}</strong></p>
  <p>The same route remains active while URL state changes.</p>
</au-route>`,
  }),
  routerExample({
    id: 'hash-routing',
    title: 'Hash-only routing',
    description: 'Keep the complete application route after the browser hash for static hosting.',
    initialPath: '#products/ice-cream/overview',
    routingMode: 'hash',
    appHtml: `<au-route path="/products/:productId">
  <h1>Product: \${$params.productId}</h1>
  <nav>
    <a href.bind="$route.href('/overview')">Overview</a>
    <a href.bind="$route.href('/reviews')">Reviews</a>
  </nav>
  <au-route path="/overview" exact>
    <p>Ice cream overview</p>
  </au-route>
  <au-route path="/reviews" exact>
    <p>Ice cream reviews</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'query-routing',
    title: 'Query-key routing',
    description: 'Store the complete application route under a configurable query-string key.',
    initialPath: '?app=products/ice-cream/overview',
    routingMode: 'query',
    routeQueryKey: 'app',
    appHtml: `<au-route path="/products/:productId">
  <h1>Product: \${$params.productId}</h1>
  <nav>
    <a href.bind="$route.href('/overview')">Overview</a>
    <a href.bind="$route.href('/reviews')">Reviews</a>
  </nav>
  <au-route path="/overview" exact>
    <p>Ice cream overview</p>
  </au-route>
  <au-route path="/reviews" exact>
    <p>Ice cream reviews</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'active-links',
    title: 'Active links',
    description: 'Generate link URLs and selected navigation state from the same route targets.',
    initialPath: '/products/ice-cream/reviews?sort=recent#comments',
    appHtml: `<au-route path="/products/:productId">
  <section class="active-link-demo">
    <au-route path="/overview" exact>
      <article>
        <h1>\${$params.productId} overview</h1>
      </article>
    </au-route>
    <au-route path="/reviews" exact>
      <article>
        <h1>\${$params.productId} reviews</h1>
        <p>Sort: \${$query.get('sort') || 'default'}</p>
        <p>Section: \${$hash || 'none'}</p>
      </article>
    </au-route>
    <nav>
      <a
        href.bind="$route.href('/overview')"
        class.bind="$route.isActive('/overview', {}, { exact: true }) ? 'selected' : ''"
        aria-current.bind="$route.isActive('/overview', {}, { exact: true }) ? 'page' : null">
        Overview
      </a>
      <a
        href.bind="$route.href('/reviews')"
        class.bind="$route.isActive('/reviews', {}, { exact: true }) ? 'selected' : ''"
        aria-current.bind="$route.isActive('/reviews', {}, { exact: true }) ? 'page' : null">
        Reviews
      </a>
      <a
        href.bind="$route.href('/reviews', {}, { query: { sort: 'recent' } })"
        class.bind="$route.isActive('/reviews', {}, { query: { sort: 'recent' }, matchQuery: true }) ? 'selected' : ''">
        Recent reviews
      </a>
      <a
        href.bind="$route.href('/reviews', {}, { hash: 'comments' })"
        class.bind="$route.isActive('/reviews', {}, { hash: 'comments', matchHash: true }) ? 'selected' : ''">
        Review comments
      </a>
    </nav>
  </section>
</au-route>`,
    appCss: `.active-link-demo {
  display: flex;
  flex-direction: column;
}

.active-link-demo nav {
  order: -1;
}

.active-link-demo a.selected {
  color: white;
  background: #08766b;
}`,
  }),
  routerExample({
    id: 'conditional-routes',
    title: 'Conditional routes',
    description: 'Use Aurelia template controllers to add and remove a route.',
    initialPath: '/edit',
    appTs: `export class App {
  public canEdit = true;
}`,
    appHtml: `<button click.trigger="canEdit = !canEdit">\${canEdit ? 'Disable' : 'Enable'} editing</button>
<nav>
  <a href="/view">View</a>
  <a href="/edit">Edit</a>
</nav>
<au-route path="/view">
  <h1>Read-only view</h1>
</au-route>
<au-route if.bind="canEdit" path="/edit">
  <h1>Editor enabled</h1>
</au-route>
<au-route path="*" fallback>
  <h1>No available route matched</h1>
</au-route>`,
  }),
  routerExample({
    id: 'repeated-routes',
    title: 'Repeated routes',
    description: 'Generate route links and branches from the same application data.',
    initialPath: '/overview',
    appTs: `export class App {
  public tabs = [
    { path: '/overview', label: 'Overview' },
    { path: '/activity', label: 'Activity' },
    { path: '/settings', label: 'Settings' },
  ];
}`,
    appHtml: `<nav>
  <a repeat.for="tab of tabs" href.bind="tab.path">\${tab.label}</a>
</nav>
<template repeat.for="tab of tabs">
  <au-route path.bind="tab.path">
    <h1>\${tab.label}</h1>
    <p>Generated from <code>tabs</code>.</p>
  </au-route>
</template>`,
  }),
  routerExample({
    id: 'exact-fallback',
    title: 'Exact, fallback, and terminal matching',
    description: 'Choose complete matches, recover from misses, or consume every remaining URL segment.',
    initialPath: '/products',
    appHtml: `<nav>
  <a href="/products">Products</a>
  <a href="/products/camera">Camera</a>
  <a href="/known/details">Known details</a>
  <a href="/files/guides/router/start.html">Terminal file path</a>
  <a href="/missing">Missing</a>
</nav>
<au-route path="/products" exact>
  <h1>Product catalog</h1>
</au-route>
<au-route path="/products/:productId" exact>
  <h1>Product: \${$params.productId}</h1>
</au-route>
<au-route path="/known">
  <h1>Known prefix matched</h1>
  <p>The remaining <code>/details</code> residue can be handled by a nested route.</p>
</au-route>
<au-route path="/files/**">
  <h1>Terminal file route</h1>
  <p>Path presented: <code>\${$route.$path}</code></p>
  <p>Terminal segment: <code>\${$params['**']}</code></p>
  <p>Residue after <code>**</code>: <code>\${$route.residue}</code></p>
  <au-route path="/" exact>
    <p>The nested route receives <code>/</code>.</p>
  </au-route>
</au-route>
<au-route path="*" fallback>
  <h1>Nothing matched this URL</h1>
</au-route>`,
  }),
  routerExample({
    id: 'swap-order',
    title: 'Parallel swap order',
    description: 'Coordinate outgoing and incoming sibling product views in parallel.',
    initialPath: '/products/camera/specs',
    appHtml: `<au-route path="/products/:productId" swap-order="parallel">
  <h1>Camera</h1>
  <nav>
    <a href="/products/camera/specs">Specs</a>
    <a href="/products/camera/reviews">Reviews</a>
  </nav>
  <div class="stage">
    <au-route path="/specs" animate>
      <h2>Specs</h2>
      <p>24 MP · 4K video · 410 g</p>
    </au-route>
    <au-route path="/reviews" animate>
      <h2>Reviews</h2>
      <p>Customers rate this camera 4.8/5.</p>
    </au-route>
  </div>
</au-route>`,
    appCss: `.stage > .au-route-enter-active,
.stage > .au-route-leave-active {
  transition: opacity 180ms ease;
}

.stage > .au-route-enter-from,
.stage > .au-route-leave-active {
  opacity: 0;
}`,
  }),
  routerExample({
    id: 'route-animations',
    title: 'Route animations',
    description: 'Opt sibling routes into CSS-driven enter and leave transitions.',
    initialPath: '/rooms/sunny',
    appHtml: `<au-route path="/rooms" swap-order="parallel">
  <nav>
    <a href="/rooms/sunny">Sunny room</a>
    <a href="/rooms/moon">Moon room</a>
  </nav>
  <div class="stage animated-stage">
    <au-route path="/sunny" animate>
      <article class="room sunny">
        <h1>Sunny room</h1>
      </article>
    </au-route>
    <au-route path="/moon" animate>
      <article class="room moon">
        <h1>Moon room</h1>
      </article>
    </au-route>
  </div>
</au-route>`,
    appCss: `.animated-stage > .au-route-enter-active,
.animated-stage > .au-route-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.animated-stage > .au-route-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.animated-stage > .au-route-leave-active {
  opacity: 0;
  transform: translateY(-12px);
}

.room {
  padding: 28px;
  border-radius: 18px;
}

.sunny {
  background: #fff1b8;
}

.moon {
  background: #dce5ff;
}`,
  }),
  routerExample({
    id: 'shared-state',
    title: 'Shared state',
    description: 'Bind multiple routed views to the same application state.',
    initialPath: '/cart',
    appTs: `export class App {
  public state = {
    totalQty: 2,
  };
}`,
    appHtml: `<nav>
  <a href="/shop">Shop</a>
  <a href="/cart">Cart (\${state.totalQty})</a>
</nav>
<button click.trigger="state.totalQty = state.totalQty + 1">Add item</button>
<au-route path="/shop">
  <h1>Shop</h1>
  <p>Your cart already has \${state.totalQty} items.</p>
</au-route>
<au-route path="/cart">
  <h1>Cart</h1>
  <p>Items: \${state.totalQty}</p>
</au-route>`,
  }),
  routerExample({
    id: 'kitchen-sink',
    title: 'Kitchen sink',
    description: 'Compose repeated routes with VM scope, let bindings, two-way interaction, and named slots.',
    initialPath: '/sunny',
    appTs: `export class App {
  public rooms = [
    { path: '/sunny', name: 'Sunny room', visits: 0 },
    { path: '/moon', name: 'Moon room', visits: 0 },
  ];
}`,
    appHtml: `<import from="./room-shell"></import>
<nav>
  <a repeat.for="room of rooms" href.bind="room.path">\${room.name}</a>
</nav>
<template repeat.for="room of rooms">
  <au-route path.bind="room.path">
    <let greeting.bind="'Welcome to ' + room.name"></let>
    <room-shell room.bind="room">
      <strong au-slot="title">\${greeting}</strong>
      <button click.trigger="room.visits = room.visits + 1">Visits: \${room.visits}</button>
    </room-shell>
  </au-route>
</template>`,
    extraFiles: {
      '/src/room-shell.ts': `export class RoomShell {
  public static readonly bindables = ['room'];
  public room = {
    name: '',
    visits: 0,
  };
}`,
      '/src/room-shell.html': `<article class="room-shell">
  <header>
    <au-slot name="title"></au-slot>
  </header>
  <p>VM scope: \${room.name}</p>
  <au-slot></au-slot>
</article>`,
    },
  }),
];

export const playgroundExamples: PlaygroundExample[] = [
  {
    id: 'router-starter',
    title: 'Router starter',
    description: 'A conventional Aurelia app with params, fallback routing, bindings, and plain CSS.',
    entry: '/src/main.ts',
    initialPath: '/',
    files: {
      '/src/main.ts': createMainSource(),
      '/src/app.ts': `export class App {
  public products = [
    { id: 'camera', name: 'Camera' },
    { id: 'speaker', name: 'Speaker' },
  ];
}`,
      '/src/app.html': `<header class="hero">
  <span class="eyebrow">Router HTML playground</span>
  <h1>Build routes where the view lives.</h1>
</header>

<nav>
  <a href="/">Home</a>
  <a repeat.for="product of products" href="/products/\${product.id}">\${product.name}</a>
  <a href="/missing">Missing route</a>
</nav>

<main>
  <au-route path="/" exact>
    <h2>Welcome</h2>
    <p>Edit any file, then run the project again.</p>
  </au-route>

  <au-route path="/products/:productId" exact>
    <h2>Product: \${$params.productId}</h2>
    <p>The URL parameter is available directly in the routed template scope.</p>
  </au-route>

  <au-route path="*" fallback>
    <h2>Nothing matched</h2>
    <p>The fallback appears only after regular sibling routes miss.</p>
  </au-route>
</main>`,
      '/src/app.css': `:root {
  font-family: Inter, system-ui, sans-serif;
  color: #17202c;
}

body {
  margin: 0;
  background: #f3f7f5;
}

#app {
  display: block;
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 24px;
}

.hero {
  margin-bottom: 24px;
}

.eyebrow {
  color: #08766b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}

h1 {
  max-width: 560px;
  margin: 10px 0;
  font-size: clamp(2rem, 7vw, 4rem);
  line-height: 1;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

a {
  padding: 9px 12px;
  border: 1px solid #9cbab4;
  border-radius: 999px;
  color: #075f57;
  text-decoration: none;
  background: white;
}

main {
  min-height: 180px;
  padding: 24px;
  border: 1px solid #cbdad7;
  border-radius: 20px;
  background: white;
}`,
    },
  },
  {
    id: 'nested-conventions',
    title: 'Nested conventions',
    description: 'An imported conventional custom element composed inside routed markup.',
    entry: '/src/main.ts',
    initialPath: '/status',
    files: {
      '/src/main.ts': `import Aurelia from 'aurelia';
import { Routing } from 'aurelia-v2-router-html';
import { App } from './app';
import { UpperValueConverter } from './upper';

void Aurelia.register(Routing, UpperValueConverter).app({
  host: document.querySelector('#app')!,
  component: App,
}).start();`,
      '/src/app.ts': `export class App {
  public services = ['Compiler', 'Router', 'Preview'];
}`,
      '/src/app.html': `<import from="./status-card"></import>
<import from="./status-badge.html"></import>
<nav>
  <a href="/status">Status</a>
  <a href="/about">About</a>
</nav>
<au-route path="/status">
  <div class="cards">
    <status-card repeat.for="service of services" name.bind="service | upper"></status-card>
    <status-badge></status-badge>
  </div>
</au-route>
<au-route path="/about">
  <h2>Everything here compiled in your browser.</h2>
</au-route>`,
      '/src/status-card.ts': `export class StatusCard {
  public name = '';
}`,
      '/src/status-card.html': `<template bindable="name">
  <article>
    <strong>\${name}</strong>
    <span>Ready</span>
  </article>
</template>`,
      '/src/status-badge.html': `<article class="badge-card">
  <strong>HTML-only element</strong>
  <span>Ready</span>
</article>`,
      '/src/upper.ts': `import { valueConverter } from 'aurelia';

@valueConverter('upper')
export class UpperValueConverter {
  public toView(value: string): string {
    return value.toUpperCase();
  }
}`,
      '/src/app.css': `:root {
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  padding: 32px;
  background: #f4f4ee;
}

nav {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

a {
  color: #09685e;
}

.cards {
  display: grid;
  gap: 10px;
}

article {
  display: flex;
  justify-content: space-between;
  padding: 18px;
  border-radius: 14px;
  background: white;
  box-shadow: 0 8px 30px #19342d14;
}

article span {
  color: #08766b;
}

.badge-card {
  border: 1px dashed #08766b;
}`,
    },
  },
  ...featureExamples,
];

export function cloneExample(example: PlaygroundExample): PlaygroundExample {
  return {
    ...example,
    files: { ...example.files },
  };
}

function routerExample(options: RouterExampleOptions): PlaygroundExample {
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    entry: '/src/main.ts',
    initialFile: '/src/app.html',
    initialPath: options.initialPath,
    files: {
      '/src/main.ts': createMainSource(options.routingMode, options.routeQueryKey),
      '/src/app.ts': options.appTs ?? 'export class App {}',
      '/src/app.html': options.appHtml,
      '/src/app.css': `${baseCss}\n${options.appCss ?? ''}`,
      ...options.extraFiles,
    },
  };
}

function createMainSource(routingMode: 'path' | 'hash' | 'query' = 'path', routeQueryKey?: string): string {
  const modeLines = routingMode === 'path'
    ? ''
    : `,\n    routingMode: '${routingMode}'${routeQueryKey == null ? '' : `,\n    routeQueryKey: '${routeQueryKey}'`}`;
  return `import Aurelia from 'aurelia';
import { Routing } from 'aurelia-v2-router-html';
import { App } from './app';

void Aurelia
  .register(Routing.customize({
    interceptLinks: true,
    animations: false${modeLines}
  }))
  .app({ host: document.querySelector('#app')!, component: App })
  .start();`;
}
