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
  initialFile?: string;
  appHtml: string;
  appTs?: string;
  appCss?: string;
  mainTs?: string;
  extraFiles?: Record<string, string>;
  routingMode?: 'path' | 'hash' | 'query';
  routeQueryKey?: string;
  scrolling?: boolean;
  focus?: boolean;
  interceptLinks?: boolean;
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

a.is-active {
  border-color: #075f57;
  color: white;
  background: #075f57;
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

const errorBoundaryCss = `.boundary-box,
.route-box,
.fallback-box,
.child-stage {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 14px;
}

.boundary-box {
  border: 2px solid #7654a8;
  background: #f7f2ff;
}

.boundary-box.parent {
  border-color: #19766e;
  background: #edf9f7;
}

.boundary-box.neutral {
  border-color: #6695a8;
  background: #f0f8fb;
}

.child-stage {
  border: 2px dashed #95a7a3;
  background: #ffffffa8;
}

.route-box {
  border: 2px solid #b96a25;
  background: #fff6e9;
}

.fallback-box {
  border: 2px solid #b94848;
  background: #fff1f1;
}

.layer-label {
  width: fit-content;
  padding: 4px 8px;
  border-radius: 999px;
  color: white;
  background: #263c38;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.boundary-box > h1,
.boundary-box > h2,
.route-box > h1,
.route-box > h2,
.route-box > h3,
.fallback-box > h1,
.fallback-box > h2,
.fallback-box > h3 {
  margin-bottom: 0;
}

.relationship {
  margin: 0;
  color: #425b55;
}`;

const featureExamples: PlaygroundExample[] = [
  routerExample({
    id: 'basic-routes',
    title: 'Basic routes',
    description: 'Map simple URLs directly to their rendered markup.',
    initialPath: '/welcome',
    appHtml: `<nav>
  <a au-link="/welcome">Welcome</a>
  <a au-link="/about">About</a>
</nav>
<main>
  <au-route path="welcome">
    <h1>Welcome</h1>
    <p>Your first declarative route is running.</p>
  </au-route>
  <au-route path="about">
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
    appHtml: `<au-route path="account">
  <h1>Account</h1>
  <nav>
    <a au-link="profile">Profile</a>
    <a au-link="security">Security</a>
  </nav>
  <au-route path="profile">
    <h2>Profile</h2>
    <p>Update your public details.</p>
  </au-route>
  <au-route path="security">
    <h2>Security</h2>
    <p>Review your sign-in settings.</p>
  </au-route>
  </au-route>`,
  }),
  routerExample({
    id: 'nested-router-memory',
    title: 'Nested router boundary',
    description: 'Keep browser routing outside while an inner panel uses its own memory-backed route state.',
    initialPath: '/workspace',
    appTs: `export class App {
  public panelPath = '/drafts';
}`,
    appHtml: `<au-route path="workspace" exact>
  <section class="workspace-shell">
    <header>
      <h1>Workspace</h1>
      <p>The browser route stays on <code>/workspace</code>.</p>
    </header>

    <nav>
      <a au-link="/workspace">Workspace</a>
      <a au-link="/reports">Reports</a>
    </nav>

    <section class="panel-shell">
      <div class="panel-toolbar">
        <strong>Inspector panel</strong>
        <code>\${panelPath}</code>
      </div>

      <au-router current-path.bind="panelPath">
        <nav class="panel-nav">
          <a au-link="drafts" active-class="selected">Drafts</a>
          <a au-link="drafts/42" active-class="selected">Draft 42</a>
          <a au-link="settings" active-class="selected">Settings</a>
        </nav>

        <au-route path="drafts" exact>
          <article>
            <h2>Drafts</h2>
            <p>The nested router starts from a memory path.</p>
          </article>
        </au-route>

        <au-route path="drafts/:id" exact>
          <article>
            <h2>Draft \${$params.id}</h2>
            <p>Only <code>panelPath</code> changes as the inner route moves.</p>
          </article>
        </au-route>

        <au-route path="settings" exact>
          <article>
            <h2>Settings</h2>
            <p>The outer browser route still owns the document location.</p>
          </article>
        </au-route>
      </au-router>
    </section>
  </section>
</au-route>

<au-route path="reports" exact>
  <main>
    <h1>Reports</h1>
    <p>Leaving the workspace changes the browser route again.</p>
  </main>
</au-route>`,
    appCss: `.workspace-shell,
.panel-shell {
  display: grid;
  gap: 16px;
}

.panel-shell {
  padding: 16px;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  border-radius: 18px;
}

.panel-toolbar,
.panel-nav {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.panel-nav a.selected {
  color: white;
  background: #1d6b57;
  border-color: #1d6b57;
}

.panel-shell article {
  display: block;
}`,
  }),
  routerExample({
    id: 'route-groups',
    title: 'Route groups',
    description: 'Share branch markup and behavior without creating another URL segment.',
    initialPath: '/projects',
    appTs: `export class App {
  public access = 'member';
  public branchLoads = 0;

  public canOpenWorkspace(): boolean {
    return this.access !== 'guest';
  }

  public loadWorkspace(): string {
    this.branchLoads += 1;
    return \`Workspace load #\${this.branchLoads}\`;
  }
}`,
    appHtml: `<nav>
  <a au-link="/projects">Projects</a>
  <a au-link="/reports">Reports</a>
  <a au-link="/sign-in">Sign in</a>
</nav>

<au-route
  group
  can-load.bind="() => canOpenWorkspace()"
  loading.bind="loadWorkspace()">
  <section class="workspace-shell">
    <header>
      <h1>Workspace</h1>
      <p>\${$route.data.loading}</p>
    </header>

    <nav>
      <a au-link="projects" active-class="selected">Projects</a>
      <a au-link="reports" active-class="selected">Reports</a>
    </nav>

    <au-route path="projects" exact>
      <main>
        <h2>Projects</h2>
        <p>The group provides the shared shell and lifecycle.</p>
      </main>
    </au-route>

    <au-route path="reports" exact>
      <main>
        <h2>Reports</h2>
        <p>This sibling reuses the same structural parent.</p>
      </main>
    </au-route>
  </section>
</au-route>

<au-route path="sign-in" exact>
  <main>
    <h1>Sign in</h1>
    <p>This route is outside the grouped branch.</p>
  </main>
</au-route>`,
    appCss: `.workspace-shell {
  display: grid;
  gap: 16px;
}

.workspace-shell > header,
.workspace-shell > main {
  display: block;
}

.workspace-shell a.selected {
  color: white;
  background: #08766b;
}`,
  }),
  routerExample({
    id: 'route-params',
    title: 'Nested route parameters',
    description: 'Keep each route parameter local and reach parent parameters explicitly when a child needs them.',
    initialPath: '/users/ada/posts/routing-basics',
    appHtml: `<nav>
  <a au-link.bind="{
    target: '/users/:userId/posts/:postId',
    params: { userId: 'ada', postId: 'routing-basics' }
  }">
    Ada / Routing
  </a>
  <a au-link.bind="{
    target: '/users/:userId/posts/:postId',
    params: { userId: 'grace', postId: 'compiler-design' }
  }">
    Grace / Compilers
  </a>
</nav>
<au-route path="users/:userId">
  <h1>Parent user: \${$params.userId}</h1>
  <p>This view owns <code>$params.userId</code>.</p>
  <au-route path="posts/:postId">
    <h2>Child post: \${$params.postId}</h2>
    <p>This view owns <code>$params.postId</code>.</p>
    <p>Parent user from child: \${$route.parent.$params.userId}</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'segment-constraints',
    title: 'Segment constraints',
    description: 'Constrain one named URL segment with an Aurelia-compatible regular expression.',
    initialPath: '/products/42',
    appHtml: `<nav>
  <a au-link="/products/42">Numeric product</a>
  <a au-link="/products/ice-cream">Named product</a>
  <a au-link="/products/42-camera">No matching constraint</a>
  <a au-link="/archive">All archive years</a>
  <a au-link="/archive/2026">Archive 2026</a>
  <a au-link="/calendar/2026-08-17/summary">Daily summary</a>
</nav>

<au-route path="products/:id{{^\\d+$}}" exact>
  <h1>Numeric product \${$params.id}</h1>
  <p>The <code>id</code> segment contains digits only.</p>
</au-route>

<au-route path="products/:slug{{^[a-z-]+$}}" exact>
  <h1>Named product \${$params.slug}</h1>
  <p>The <code>slug</code> segment contains lowercase letters and hyphens.</p>
</au-route>

<au-route path="archive/:year{{^\\d{4}$}}?" exact>
  <h1>Archive \${$params.year || 'all years'}</h1>
  <p>The constrained year remains optional.</p>
</au-route>

<au-route path="calendar/:date{{^\\d{4}-\\d{2}-\\d{2}$}}/summary" exact>
  <h1>Summary for \${$params.date}</h1>
  <p>A constrained parameter can appear in the middle of a path.</p>
</au-route>

<au-route path="*" fallback>
  <h1>No constrained route matched</h1>
  <p>The URL did not satisfy any regular sibling constraint.</p>
</au-route>`,
  }),
  routerExample({
    id: 'url-state',
    title: 'Path mode with URL state',
    description: 'Change query and fragment state without changing the matched product route.',
    initialPath: '/products/ice-cream?sort=popular#reviews',
    appHtml: `<au-route path="products/:productId" exact>
  <nav>
    <a au-link.bind="{
      target: $route,
      params: $params,
      options: {
        query: { sort: 'popular' },
        hash: 'reviews',
        matchQuery: true,
        matchHash: true
      }
    }">
      Popular reviews
    </a>
    <a au-link.bind="{
      target: $route,
      params: $params,
      options: {
        query: { sort: 'price' },
        hash: 'details',
        matchQuery: true,
        matchHash: true
      }
    }">
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
    appHtml: `<au-route path="products/:productId">
  <h1>Product: \${$params.productId}</h1>
  <nav>
    <a au-link="overview">Overview</a>
    <a au-link="./reviews">Reviews</a>
  </nav>
  <au-route path="overview" exact>
    <p>Ice cream overview</p>
  </au-route>
  <au-route path="reviews" exact>
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
    appHtml: `<au-route path="products/:productId">
  <h1>Product: \${$params.productId}</h1>
  <nav>
    <a au-link="overview">Overview</a>
    <a au-link="./reviews">Reviews</a>
  </nav>
  <au-route path="overview" exact>
    <p>Ice cream overview</p>
  </au-route>
  <au-route path="reviews" exact>
    <p>Ice cream reviews</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'hash-scrolling',
    title: 'Hash scrolling',
    description: 'Wait for asynchronous route content, then scroll its decoded fragment target into view.',
    initialPath: '/welcome',
    scrolling: true,
    appTs: `export class App {
  public status = 'Choose the API section';

  public async prepareApi(): Promise<void> {
    this.status = 'Preparing the API section';
    await new Promise(resolve => setTimeout(resolve, 300));
    this.status = 'API section ready';
  }
}`,
    appHtml: `<nav>
  <a au-link="welcome">Welcome</a>
  <a au-link="guide#api-reference">
    Static API link
  </a>
  <a au-link.bind="{
    target: 'guide',
    options: { hash: 'api-reference' }
  }">
    Bound API link
  </a>
</nav>
<au-route path="welcome" exact>
  <main>
    <h1>Documentation home</h1>
    <p>Open the API reference to render and scroll in one navigation.</p>
  </main>
</au-route>
<au-route
  path="guide"
  exact
  loading.bind="prepareApi()">
  <main>
    <h1>Product guide</h1>
    <p>\${status}</p>
    <div class="reading-space" aria-hidden="true"></div>
    <section id="api-reference">
      <h2>API reference</h2>
      <p>The router found this target after the route finished rendering.</p>
    </section>
    <div class="reading-tail" aria-hidden="true"></div>
  </main>
</au-route>`,
    appCss: `.reading-space {
  height: 700px;
}

.reading-tail {
  height: 350px;
}

#api-reference {
  padding: 18px;
  border-radius: 14px;
  background: #e8f6f3;
}`,
  }),
  routerExample({
    id: 'focus-management',
    title: 'Focus management',
    description: 'Move keyboard focus to a marked heading after the incoming route has finished rendering.',
    initialPath: '/welcome',
    focus: true,
    appHtml: `<nav>
  <a au-link="welcome">Welcome</a>
  <a au-link="account">Account</a>
</nav>

<p class="focus-demo-note">
  <strong>Focus indicator:</strong>
  after a route change, look for the dashed violet border and glow around the new heading.
</p>

<au-route path="welcome" exact>
  <main>
    <h1 class="route-focus-target" au-route-focus>Welcome</h1>
    <p>Initial loading does not move focus by default.</p>
  </main>
</au-route>

<au-route path="account" exact>
  <main>
    <h1 class="route-focus-target" au-route-focus>Account settings</h1>
    <p>The heading receives focus after this routed view settles.</p>
    <a au-link.bind="{
      target: 'account',
      options: { query: { panel: 'security' } }
    }">
      Show security settings
    </a>
    <p>Panel: \${$query.get('panel') || 'profile'}</p>
  </main>
</au-route>`,
    appCss: `.focus-demo-note {
  margin: 16px 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f3efff;
  color: #3f2a70;
}

.route-focus-target {
  padding: 8px 10px;
  border-radius: 10px;
  outline: 3px dashed transparent;
  outline-offset: 4px;
  transition:
    outline-color 150ms ease,
    box-shadow 150ms ease,
    background 150ms ease;
}

.route-focus-target:focus {
  outline-color: #7655d9;
  background: #faf8ff;
  box-shadow: 0 0 0 7px rgb(118 85 217 / 18%);
}`,
  }),
  routerExample({
    id: 'active-links',
    title: 'Active links',
    description: 'Generate link URLs and selected navigation state from the same route targets.',
    initialPath: '/products/ice-cream/reviews?sort=recent#comments',
    interceptLinks: true,
    appHtml: `<au-route path="products/:productId">
  <section class="active-link-demo">
    <au-route path="overview" exact>
      <article>
        <h1>\${$params.productId} overview</h1>
      </article>
    </au-route>
    <au-route path="./reviews" exact>
      <article>
        <h1>\${$params.productId} reviews</h1>
        <p>Sort: \${$query.get('sort') || 'default'}</p>
        <p>Section: \${$hash || 'none'}</p>
      </article>
    </au-route>
    <nav>
      <a au-link.bind="{
        target: 'overview',
        options: { exact: true },
        activeClass: 'selected'
      }">
        Overview
      </a>
      <a au-link.bind="{
        target: './reviews',
        options: { exact: true },
        activeClass: 'selected'
      }">
        Reviews
      </a>
      <a au-link.bind="{
        target: 'reviews',
        options: { query: { sort: 'recent' }, matchQuery: true },
        activeClass: 'selected'
      }">
        Recent reviews
      </a>
      <a au-link.bind="{
        target: 'reviews',
        options: { hash: 'comments', matchHash: true },
        activeClass: 'selected'
      }">
        Review comments
      </a>
      <a
        href.bind="$route.href('reviews')"
        class.bind="$route.isActive('reviews', {}, { exact: true }) ? 'selected' : ''">
        Low-level reviews
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
    id: 'relative-targets',
    title: 'Relative targets',
    description: 'Resolve descendant, parent, root, query-only, and hash-only targets from one route context.',
    initialPath: '/products/aster-pack/reviews?sort=recent#comments',
    initialFile: '/src/app.html',
    appTs: `import { resolve } from '@aurelia/kernel';
import { IRouteContext } from 'aurelia-router-html';

export class App {
  private readonly route = resolve(IRouteContext);

  public openSupport(): void {
    this.route.load('../../../../support');
  }

  public openQueryOnly(): void {
    this.route.load('?page=2');
  }

  public openHashOnly(): void {
    this.route.load('#specs');
  }
}`,
    appHtml: `<au-route path="products/:productId">
  <section class="relative-demo">
    <h1>Product \${$params.productId}</h1>
    <p>Current pathname: <code>\${$route.root.$path}</code></p>
    <p>Query: <code>\${$query.toString() || '(none)'}</code></p>
    <p>Hash: <code>\${$hash || '(none)'}</code></p>

    <nav>
      <a au-link="overview" active-class="selected">Overview</a>
      <a au-link="./reviews" active-class="selected">Reviews</a>
      <a au-link="/support" active-class="selected">Root support</a>
      <a au-link="?page=2" active-class="selected">Query only</a>
      <a au-link="#specs" active-class="selected">Hash only</a>
    </nav>

    <div class="button-row">
      <button click.trigger="openSupport()">Load root support</button>
      <button click.trigger="openQueryOnly()">Load query only</button>
      <button click.trigger="openHashOnly()">Load hash only</button>
    </div>

    <au-route path="overview" exact>
      <article class="route-card">
        <h2>Overview</h2>
      </article>
    </au-route>

    <au-route path="./reviews" exact>
      <article class="route-card">
        <h2>Reviews</h2>
      </article>
    </au-route>
  </section>
</au-route>

<au-route path="support" exact>
  <article class="route-card">
    <h1>Support</h1>
    <p>Repeated <code>../</code> traversal clamps at the route root before loading this route.</p>
  </article>
</au-route>`,
    appCss: `.relative-demo {
  display: grid;
  gap: 16px;
}

.relative-demo a.selected {
  color: white;
  background: #08766b;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.route-card {
  display: block;
}`,
  }),
  routerExample({
    id: 'relative-targets-nested-router',
    title: 'Relative targets inside au-router',
    description: 'Keep relative resolution inside a nested memory router while the outer browser route stays unchanged.',
    initialPath: '/workspace',
    initialFile: '/src/app.html',
    appTs: `export class App {
  public panelPath: string = '/items/42/reviews?sort=recent#comments';
}`,
    appHtml: `<au-route path="workspace" exact>
  <section class="nested-relative-shell">
    <h1>Workspace</h1>
    <p>Outer route: <code>/workspace</code></p>
    <p>Nested current-path: <code>\${panelPath}</code></p>

    <au-router current-path.bind="panelPath">
      <au-route path="items/:id">
        <au-route path="reviews" exact>
          <article class="route-card">
            <h2>Reviews</h2>
            <nav>
              <a au-link="../specs" active-class="selected">Specs via ../</a>
            </nav>
            <p>Nested href: <code>\${$route.href('../specs')}</code></p>
            <p>Sort: <code>\${$query.get('sort') || '(none)'}</code></p>
            <p>Hash: <code>\${$hash || '(none)'}</code></p>
          </article>
        </au-route>

        <au-route path="specs" exact>
          <article class="route-card">
            <h2>Specs</h2>
            <nav>
              <a au-link="?page=2">Query only</a>
              <a au-link="#specs">Hash only</a>
            </nav>
            <p>Page: <code>\${$query.get('page') || '(none)'}</code></p>
            <p>Hash: <code>\${$hash || '(none)'}</code></p>
            <p>Query-only and hash-only active styling needs explicit <code>matchQuery</code> or <code>matchHash</code> checks when you want the current state to count.</p>
          </article>
        </au-route>
      </au-route>
    </au-router>
  </section>
</au-route>`,
    appCss: `.nested-relative-shell {
  display: grid;
  gap: 16px;
}

.nested-relative-shell a.selected {
  color: white;
  background: #08766b;
}`,
  }),
  routerExample({
    id: 'relative-redirects',
    title: 'Relative redirects',
    description: 'Resolve contextual redirects with route-relative paths plus query and hash updates.',
    initialPath: '/area/workspace/private/42',
    initialFile: '/src/app.html',
    appHtml: `<au-route path="area">
  <section class="redirect-demo-shell">
    <h1>Area shell</h1>
    <p>The redirect below resolves from the redirect route's parent context and climbs one level with <code>../</code>.</p>

    <nav>
      <a au-link="workspace/private/42">Private 42</a>
      <a au-link="login?from=manual#note">Direct login</a>
    </nav>

    <au-route path="workspace">
      <section class="redirect-demo-card">
        <h2>Workspace</h2>

        <au-route
          path="private/:id"
          exact
          redirect-to="../login?from=private#warning">
        </au-route>
      </section>
    </au-route>

    <au-route path="login" exact>
      <article class="redirect-demo-result">
        <h3>Login</h3>
        <p>From: <code>\${$query.get('from') || '(none)'}</code></p>
        <p>Hash: <code>\${$hash || '(none)'}</code></p>
      </article>
    </au-route>
  </section>
</au-route>`,
    appCss: `.redirect-demo-shell,
.redirect-demo-card {
  display: grid;
  gap: 16px;
}

.redirect-demo-result {
  display: block;
  padding: 18px;
  border: 1px solid #cbdad7;
  border-radius: 18px;
  background: white;
}`,
  }),
  routerExample({
    id: 'active-branch',
    title: 'Active branch snapshots',
    description: 'Compare root, parent, and child snapshots when one URL activates sibling branches at one and two levels.',
    initialPath: '/workspace/reports',
    appTs: `export class App {
  public formatSnapshot(snapshot: {
    path: string;
    matches: readonly { fullPath: string; params: Record<string, string> }[];
    branches: {
      routes: readonly (readonly { fullPath: string }[])[];
      paths: readonly (readonly string[])[];
      uniquePaths: readonly string[];
    };
  }): string {
    return JSON.stringify({
      path: snapshot.path,
      matches: snapshot.matches.map(match => ({
        fullPath: match.fullPath,
        params: match.params,
      })),
      routes: snapshot.branches.routes.map(branch => branch.map(match => match.fullPath)),
      paths: snapshot.branches.paths,
      uniquePaths: snapshot.branches.uniquePaths,
    }, null, 2);
  }
}`,
    appHtml: `<au-route path="workspace">
  <section class="snapshot-layout">
    <header>
      <h1>Workspace</h1>
      <p>This route intentionally activates two branches for one URL: a direct <code>reports</code> child and a second <code>reports</code> child nested under a pathless group.</p>
    </header>

    <nav>
      <a au-link="reports" active-class="selected">Reports</a>
      <a au-link="activity" active-class="selected">Activity</a>
    </nav>

    <section class="snapshot-card">
      <h2>Root snapshot</h2>
      <pre>\${formatSnapshot($route.root.getActiveSnapshot())}</pre>
    </section>

    <section class="snapshot-card">
      <h2>Workspace snapshot</h2>
      <pre>\${formatSnapshot($route.getActiveSnapshot())}</pre>
    </section>

    <au-route group>
      <section class="snapshot-card emphasis">
        <h2>Pathless group snapshot</h2>
        <p>This branch contributes another active match with the same composed path.</p>
        <pre>\${formatSnapshot($route.getActiveSnapshot())}</pre>

        <au-route path="reports" exact>
          <section class="snapshot-card nested">
            <h3>Nested reports snapshot</h3>
            <pre>\${formatSnapshot($route.getActiveSnapshot())}</pre>
          </section>
        </au-route>
      </section>
    </au-route>

    <au-route path="reports" exact>
      <section class="snapshot-card emphasis">
        <h2>Direct reports snapshot</h2>
        <p>This sibling matches the same final URL without the extra group level.</p>
        <pre>\${formatSnapshot($route.getActiveSnapshot())}</pre>
      </section>
    </au-route>

    <au-route path="activity" exact>
      <section class="snapshot-card emphasis">
        <h2>Activity snapshot</h2>
        <pre>\${formatSnapshot($route.getActiveSnapshot())}</pre>
      </section>
    </au-route>
  </section>
</au-route>`,
    appCss: `.snapshot-layout {
  display: grid;
  gap: 16px;
}

.snapshot-layout a.selected {
  color: white;
  background: #08766b;
}

.snapshot-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px solid #cbdad7;
  border-radius: 18px;
  background: white;
}

.snapshot-card.emphasis {
  border-color: #87b7af;
  background: #f2faf8;
}

.snapshot-card.nested {
  border-color: #a7c9c2;
  background: #f8fcfb;
}

.snapshot-card h2,
.snapshot-card h3,
.snapshot-card p {
  margin: 0;
}

.snapshot-card pre {
  margin: 0;
  overflow: auto;
  padding: 12px;
  border-radius: 12px;
  background: #18202c;
  color: #ecf6f2;
  font-size: 0.8rem;
  line-height: 1.45;
}` ,
  }),
  routerExample({
    id: 'programmatic-navigation',
    title: 'Programmatic navigation',
    description: 'Load relative and root-absolute targets from the current route context.',
    initialPath: '/home',
    appTs: `import { resolve } from '@aurelia/kernel';
import { IRouteContext } from 'aurelia-router-html';

export class App {
  private readonly route = resolve(IRouteContext);

  public openReviews(productId: string): void {
    this.route.load(
      '/products/:productId/reviews',
      { productId },
      {
        query: { sort: 'recent' },
        hash: 'comments'
      }
    );
  }

  public replaceWithHelp(): void {
    this.route.load('/help', {}, { replace: true });
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <button click.trigger="openReviews('camera')">
    Open camera reviews
  </button>
  <button click.trigger="replaceWithHelp()">
    Replace with help
  </button>
</nav>
<main>
  <au-route path="home" exact>
    <h1>Home</h1>
    <p>Choose a programmatic navigation action.</p>
  </au-route>
  <au-route path="products/:productId/reviews" exact>
    <h1>\${$params.productId} reviews</h1>
    <p>Sort: \${$query.get('sort')}</p>
    <p>Section: \${$hash}</p>
  </au-route>
  <au-route path="help" exact>
    <h1>Help</h1>
    <p>This navigation replaced the previous history entry.</p>
  </au-route>
</main>`,
  }),
  routerExample({
    id: 'declarative-redirects',
    title: 'Declarative redirects',
    description: 'Move legacy URLs, select a nested default, and redirect unmatched locations without rendering an intermediate view.',
    initialPath: '/legacy/camera',
    appTs: `export class App {
  public legacyTarget = '/products/:productId';
}`,
    appHtml: `<nav>
  <a au-link="legacy/speaker">Legacy speaker URL</a>
  <a au-link="catalog/legacy/speaker">Contextual legacy URL</a>
  <a au-link="account">Account default</a>
  <a au-link="unknown">Unknown URL</a>
</nav>
<main>
  <au-route
    path="legacy/:productId"
    exact
    redirect-to.bind="legacyTarget">
  </au-route>

  <au-route path="products/:productId" exact>
    <h1>Product: \${$params.productId}</h1>
    <p>The root-absolute target moved this URL to <code>/products/...</code>.</p>
  </au-route>

  <au-route path="catalog">
    <au-route
      path="legacy/:productId"
      exact
      redirect-to="products/:productId">
    </au-route>
    <au-route path="products/:productId" exact>
      <h1>Catalog product: \${$params.productId}</h1>
      <p>The contextual target stayed below <code>/catalog</code>.</p>
    </au-route>
  </au-route>

  <au-route path="account">
    <h1>Account</h1>
    <au-route path="/" exact redirect-to="profile"></au-route>
    <au-route path="profile" exact>
      <p>Profile is the account branch default.</p>
    </au-route>
  </au-route>

  <au-route path="not-found" exact>
    <h1>Page not found</h1>
  </au-route>
  <au-route path="*" fallback redirect-to="/not-found"></au-route>
</main>`,
  }),
  routerExample({
    id: 'page-titles',
    title: 'Nested page titles',
    description: 'Compose static and bound route metadata after the active view is ready.',
    initialPath: '/products/camera',
    appTs: `export class App {
  public cameraTitle = 'Camera details';

  public renameCamera(): void {
    this.cameraTitle = this.cameraTitle === 'Camera details'
      ? 'Mirrorless camera'
      : 'Camera details';
  }
}`,
    appHtml: `<nav>
  <a au-link="products/camera">Camera</a>
  <a au-link="products/lens">Lens</a>
</nav>
<main>
  <au-route path="products" title="Products">
    <au-route path="camera" exact title.bind="cameraTitle">
      <h1>Camera</h1>
      <p>The browser title includes this bound route title.</p>
      <button click.trigger="renameCamera()">Change title</button>
    </au-route>
    <au-route path="lens" exact title="Lens details">
      <h1>Lens</h1>
      <p>This route contributes a static title.</p>
    </au-route>
  </au-route>
</main>`,
  }),
  routerExample({
    id: 'route-lifecycle',
    title: 'Route lifecycle',
    description: 'Compare an in-place lifecycle rerun with a fresh-view replacement.',
    initialPath: '/home',
    appTs: `import type { RouteLifecycleContext } from 'aurelia-router-html';

export class App {
  public phase = 'Choose a route';
  public events: string[] = [];

  public canPrepare(name: string, context: RouteLifecycleContext): boolean {
    const id = context.to.params.id ?? '';
    const label = \`\${name} \${id}\`.trim();
    this.events.push(\`\${label} \${context.kind} can-load\`);
    return true;
  }

  public async prepare(name: string, context: RouteLifecycleContext): Promise<string> {
    const id = context.to.params.id ?? '';
    const label = \`\${name} \${id}\`.trim();
    this.phase = \`\${label}: \${context.kind} loading...\`;
    this.events.push(\`\${label} \${context.kind} loading\`);
    await new Promise(resolve => setTimeout(resolve, 180));
    return label;
  }

  public ready(name: string, context: RouteLifecycleContext): void {
    const id = context.to.params.id ?? '';
    const label = \`\${name} \${id}\`.trim();
    this.events.push(\`\${label} \${context.kind} loaded\`);
    this.phase = \`\${label} ready after \${context.kind}\`;
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="projects/board/alpha">Alpha board</a>
  <a au-link="projects/board/beta">Beta board</a>
  <a au-link="projects/card/alpha">Alpha card</a>
  <a au-link="projects/card/beta">Beta card</a>
</nav>

<p role="status">\${phase}</p>
<ol>
  <li repeat.for="event of events">\${event}</li>
</ol>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
    <p>Open a board to preserve its local draft, or a card to replace its local note.</p>
  </au-route>

  <au-route
    path="projects"
    can-load.bind="transition => canPrepare('Projects', transition)"
    loading.bind="prepare('Projects', $lifecycle)"
    loaded.bind="ready('Projects', $lifecycle)">
    <h1>Projects</h1>

    <au-route
      path="board/:id"
      exact
      transition-on="params"
      transition-plan="rerun"
      can-load.bind="transition => canPrepare('Board', transition)"
      loading.bind="prepare('Board', $lifecycle)"
      loaded.bind="ready('Board', $lifecycle)">
      <h2>Project board \${$params.id}</h2>
      <p>Lifecycle result: \${$route.data.loading}</p>
      <label>Local draft <input value="Type here before switching boards"></label>
      <p>Edit the draft, then switch boards. The rerun lifecycle changes the board data while preserving this input node and its value.</p>
    </au-route>

    <au-route
      path="card/:id"
      exact
      transition-on="params"
      transition-plan="replace"
      can-load.bind="transition => canPrepare('Card', transition)"
      loading.bind="prepare('Card', $lifecycle)"
      loaded.bind="ready('Card', $lifecycle)">
      <h2>Project card \${$params.id}</h2>
      <p>Lifecycle result: \${$route.data.loading}</p>
      <label>Local note <input value="This resets when the view is replaced"></label>
      <p>Edit the note, then switch cards. The replace plan creates a new input node with its initial value.</p>
    </au-route>
  </au-route>
</main>`,
  }),
  routerExample({
    id: 'navigation-guards',
    title: 'Navigation guards',
    description: 'Approve, cancel, or redirect entry and protect an editor from accidental navigation.',
    initialPath: '/home',
    appTs: `export class App {
  public accountAccess = false;
  public editorDirty = false;
  public message = 'Choose a guarded route';

  public async canOpenAccount(): Promise<boolean> {
    this.message = 'Checking account access…';
    await new Promise(resolve => setTimeout(resolve, 250));
    this.message = this.accountAccess ? 'Access approved' : 'Access denied';
    return this.accountAccess;
  }

  public canLeaveEditor(): boolean {
    this.message = this.editorDirty ? 'Save the editor before leaving' : 'Editor can close';
    return !this.editorDirty;
  }

  public canOpenAdmin(): string {
    this.message = 'Admin requires sign in';
    return '/sign-in';
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="account">Account</a>
  <a au-link="editor">Editor</a>
  <a au-link="admin">Admin</a>
</nav>

<p role="status">\${message}</p>
<button click.trigger="accountAccess = !accountAccess">
  \${accountAccess ? 'Block account' : 'Allow account'}
</button>
<button click.trigger="editorDirty = !editorDirty">
  \${editorDirty ? 'Mark editor saved' : 'Mark editor dirty'}
</button>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
  </au-route>
  <au-route path="account" exact can-load.bind="() => canOpenAccount()">
    <h1>Account</h1>
  </au-route>
  <au-route path="editor" exact can-unload.bind="() => canLeaveEditor()">
    <h1>Editor</h1>
  </au-route>
  <au-route path="admin" exact can-load.bind="() => canOpenAdmin()">
    <h1>Admin</h1>
  </au-route>
  <au-route path="sign-in" exact>
    <h1>Sign in</h1>
    <p>The admin guard redirected here.</p>
  </au-route>
  </main>`,
  }),
  routerExample({
    id: 'navigation-guards-relative-redirect',
    title: 'Relative can-load redirect',
    description: 'Return a parent-relative target from can-load to redirect before the guarded route renders.',
    initialPath: '/home',
    initialFile: '/src/app.html',
    appTs: `export class App {
  public message = 'Choose a route';

  public openPrivate(): string {
    this.message = 'Private area requires sign in';
    return '../login?from=private#warning';
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="area/workspace/private">Private workspace</a>
  <a au-link="area/login?from=manual#note">Direct login</a>
</nav>

<p role="status">\${message}</p>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
    <p>Open the private route to trigger a contextual redirect from <code>can-load</code>.</p>
  </au-route>

  <au-route path="area">
    <section class="guard-redirect-shell">
      <h1>Area shell</h1>

      <au-route path="workspace">
        <section class="guard-redirect-card">
          <h2>Workspace</h2>
          <au-route path="private" exact can-load.bind="() => openPrivate()">
            <p>Private content</p>
          </au-route>
        </section>
      </au-route>

      <au-route path="login" exact>
        <article class="guard-redirect-result">
          <h2>Login</h2>
          <p>From: <code>\${$query.get('from') || '(none)'}</code></p>
          <p>Hash: <code>\${$hash || '(none)'}</code></p>
        </article>
      </au-route>
    </section>
  </au-route>
</main>`,
    appCss: `.guard-redirect-shell,
.guard-redirect-card {
  display: grid;
  gap: 16px;
}

.guard-redirect-result {
  display: block;
  padding: 18px;
  border: 1px solid #cbdad7;
  border-radius: 18px;
  background: white;
}`,
  }),
  routerExample({
    id: 'layered-navigation-guards',
    title: 'Layered navigation guards',
    description: 'Watch member, staff, and administrator guards run progressively through three nested route levels.',
    initialPath: '/home',
    appTs: `type AccessLevel = 'guest' | 'member' | 'staff' | 'admin';

export class App {
  public access: AccessLevel = 'guest';
  public message = 'Browsing as a guest';
  public checks: string[] = [];

  public useAccess(access: AccessLevel): void {
    this.access = access;
    this.message = \`Access level: \${access}\`;
    this.checks = [];
  }

  public requireMember(): true | string {
    this.record('Portal guard: require a signed-in member');
    if (this.access === 'guest') {
      this.message = 'Sign in to open the portal';
      return '/sign-in';
    }
    return true;
  }

  public requireStaff(): boolean {
    this.record('Staff guard: require staff access');
    return this.requireRank('staff');
  }

  public requireAdmin(): boolean {
    this.record('Administration guard: require admin access');
    return this.requireRank('admin');
  }

  private requireRank(required: 'staff' | 'admin'): boolean {
    const rank: Record<AccessLevel, number> = {
      guest: 0,
      member: 1,
      staff: 2,
      admin: 3,
    };
    if (rank[this.access] < rank[required]) {
      this.message = \`The \${required} area needs stronger access\`;
      return false;
    }
    return true;
  }

  private record(check: string): void {
    this.checks = [...this.checks, check];
  }
}`,
    appHtml: `<nav aria-label="Application">
  <a au-link="home">Home</a>
  <a au-link="portal/profile">Member portal</a>
</nav>

<div aria-label="Choose access level">
  <button click.trigger="useAccess('guest')">Use guest</button>
  <button click.trigger="useAccess('member')">Use member</button>
  <button click.trigger="useAccess('staff')">Use staff</button>
  <button click.trigger="useAccess('admin')">Use admin</button>
</div>
<p role="status">\${message}</p>
<section aria-label="Guard invocation order">
  <h2>Guard invocation order</h2>
  <ol>
    <li repeat.for="check of checks">\${check}</li>
  </ol>
</section>

<main>
  <au-route path="home" exact>
    <h1>Public home</h1>
  </au-route>

  <au-route path="portal" can-load.bind="() => requireMember()">
    <h1>Member portal</h1>
    <nav aria-label="Member portal">
      <a au-link="profile">Profile</a>
      <a au-link="staff/reports">Open staff area</a>
    </nav>

    <au-route path="profile" exact>
      <h2>Member profile</h2>
    </au-route>

    <au-route
      path="staff"
      can-load.bind="() => requireStaff()"
      guard-failure="local">
      <h2>Staff area</h2>
      <nav aria-label="Staff area">
        <a au-link="reports">Reports</a>
        <a au-link="schedule">Schedule</a>
        <a au-link="admin">Administration</a>
      </nav>

      <au-route path="reports" exact>
        <h3>Staff reports</h3>
      </au-route>
      <au-route path="schedule" exact>
        <h3>Staff schedule</h3>
      </au-route>
      <au-route
        path="admin"
        exact
        can-load.bind="() => requireAdmin()"
        guard-failure="local">
        <h3>Administration</h3>
      </au-route>
      <au-route path="*" fallback>
        <h3>Administration access denied</h3>
        <p>The staff area remains available at the requested URL.</p>
      </au-route>
    </au-route>

    <au-route path="*" fallback>
      <h2>Staff access denied</h2>
      <p>The member portal remains available at the requested URL.</p>
    </au-route>
  </au-route>

  <au-route path="sign-in" exact>
    <h1>Sign in</h1>
    <p>The portal requires at least member access.</p>
  </au-route>
</main>`,
  }),
  routerExample({
    id: 'error-recovery',
    title: 'Route error recovery',
    description: 'Let a failing route handle its own loading error and select a sibling fallback.',
    initialPath: '/home',
    appTs: `import type { RouteFailure } from 'aurelia-router-html';

export class App {
  public reportsAvailable = false;
  public status = 'Open reports to run its loading callback';

  public loadReports(): void {
    if (!this.reportsAvailable) {
      throw new Error('Reports are temporarily unavailable');
    }
    this.status = 'Reports loaded successfully';
  }

  public recover(failure: RouteFailure) {
    this.status = \`Reports handled its own \${failure.phase} failure\`;
    return { recover: 'local' } as const;
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="reports">Reports</a>
</nav>

<button click.trigger="reportsAvailable = !reportsAvailable">
  \${reportsAvailable ? 'Make reports fail' : 'Allow reports retry'}
</button>
<p role="status">\${status}</p>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
  </au-route>

  <au-route
    path="reports"
    exact
    loading.bind="loadReports()"
    on-error.bind="failure => recover(failure)">
    <section class="route-box">
      <span class="layer-label">Failing route + its own boundary</span>
      <h1>Reports</h1>
      <p>The report data is ready.</p>
    </section>
  </au-route>

  <au-route path="*" fallback>
    <section class="fallback-box">
      <span class="layer-label">Sibling fallback</span>
      <h1>Reports could not load</h1>
      <p>The Reports route handled its own error.</p>
      <p>\${$route.parent.failure.error.message}</p>
    </section>
  </au-route>
</main>`,
    appCss: errorBoundaryCss,
  }),
  routerExample({
    id: 'error-recovery-parent',
    title: 'Parent error boundary',
    description: 'Let a workspace own recovery policy for a failing child route.',
    initialPath: '/home',
    appTs: `import type { RouteFailure } from 'aurelia-router-html';

export class App {
  public status = 'Open reports to trigger its parent boundary';

  public loadReports(): never {
    throw new Error('The reports service did not respond');
  }

  public recoverWorkspace(failure: RouteFailure) {
    this.status = \`Workspace handled \${failure.source.pattern}\`;
    return { recover: 'local' } as const;
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="workspace/reports">Reports</a>
</nav>
<p role="status">\${status}</p>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
  </au-route>

  <au-route
    path="workspace"
    on-error.bind="failure => recoverWorkspace(failure)">
    <section class="boundary-box parent">
      <span class="layer-label">Parent boundary</span>
      <h1>Workspace</h1>
      <p class="relationship">This parent owns <code>on-error.bind</code> and stays visible.</p>

      <div class="child-stage">
        <span class="layer-label">Child route stage</span>

        <au-route
          path="reports"
          exact
          loading.bind="loadReports()">
          <section class="route-box">
            <span class="layer-label">Failing child · no boundary</span>
            <h2>Reports</h2>
          </section>
        </au-route>

        <au-route path="*" fallback>
          <section class="fallback-box">
            <span class="layer-label">Sibling fallback inside parent</span>
            <h2>Workspace recovery</h2>
            <p>The parent Workspace handled the child Reports failure.</p>
            <p>Source: \${$route.parent.failure.source.pattern}</p>
            <p>Boundary: \${$route.parent.failure.boundary.pattern}</p>
          </section>
        </au-route>
      </div>
    </section>
  </au-route>
</main>`,
    appCss: errorBoundaryCss,
  }),
  routerExample({
    id: 'error-recovery-grandparent',
    title: 'Grandparent error boundary',
    description: 'Bubble a grandchild failure through its parent to an application-area boundary.',
    initialPath: '/home',
    appTs: `import type { RouteFailure } from 'aurelia-router-html';

export class App {
  public status = 'Open reports to trigger the portal boundary';

  public loadReports(): never {
    throw new Error('The reports service did not respond');
  }

  public recoverPortal(failure: RouteFailure) {
    this.status = \`Portal handled \${failure.source.pattern}\`;
    return { recover: 'local' } as const;
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="portal/workspace/reports">Reports</a>
</nav>
<p role="status">\${status}</p>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
  </au-route>

  <au-route
    path="portal"
    on-error.bind="failure => recoverPortal(failure)">
    <section class="boundary-box">
      <span class="layer-label">Grandparent boundary</span>
      <h1>Portal</h1>
      <p class="relationship">The outer Portal owns <code>on-error.bind</code>.</p>

      <au-route path="workspace">
        <section class="boundary-box neutral">
          <span class="layer-label">Parent route · no boundary</span>
          <h2>Workspace</h2>
          <p class="relationship">This middle route passes its child's error upward.</p>

          <div class="child-stage">
            <span class="layer-label">Grandchild route stage</span>

            <au-route
              path="reports"
              exact
              loading.bind="loadReports()">
              <section class="route-box">
                <span class="layer-label">Failing grandchild · no boundary</span>
                <h3>Reports</h3>
              </section>
            </au-route>

            <au-route path="*" fallback>
              <section class="fallback-box">
                <span class="layer-label">Sibling fallback inside parent</span>
                <h3>Portal recovery</h3>
                <p>The grandparent Portal handled the Reports failure.</p>
                <p>The immediate parent Workspace still owns recovery state.</p>
                <p>Source: \${$route.parent.failure.source.pattern}</p>
                <p>Boundary: \${$route.parent.failure.boundary.pattern}</p>
                <p>Recovery owner: \${$route.parent.failure.recovery.pattern}</p>
              </section>
            </au-route>
          </div>
        </section>
      </au-route>
    </section>
  </au-route>
</main>`,
    appCss: errorBoundaryCss,
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
  <a au-link="/view">View</a>
  <a au-link="/edit">Edit</a>
</nav>
<au-route path="view">
  <h1>Read-only view</h1>
</au-route>
<au-route if.bind="canEdit" path="edit">
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
    { path: 'overview', label: 'Overview' },
    { path: 'activity', label: 'Activity' },
    { path: 'settings', label: 'Settings' },
  ];
}`,
    appHtml: `<nav>
  <a repeat.for="tab of tabs" au-link.bind="tab.path">\${tab.label}</a>
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
    title: 'Exact and fallback matching',
    description: 'Require complete matches or render a fallback only after regular sibling routes miss.',
    initialPath: '/products',
    appHtml: `<nav>
  <a au-link="products">Products</a>
  <a au-link="products/camera">Camera</a>
  <a au-link="known/details">Known details</a>
  <a au-link.bind="{ target: 'offers', options: { exact: true } }">Offers</a>
  <a au-link="offers/summer">Summer offer</a>
  <a au-link="missing">Missing</a>
</nav>
<au-route path="products" exact>
  <h1>Product catalog</h1>
</au-route>
<au-route path="products/:productId" exact>
  <h1>Product: \${$params.productId}</h1>
</au-route>
<au-route path="offers/:offerId?" exact>
  <h1>Offer: \${$params.offerId || 'all offers'}</h1>
</au-route>
<au-route path="known">
  <h1>Known prefix matched</h1>
  <p>The remaining <code>/details</code> residue can be handled by a nested route.</p>
</au-route>
<au-route path="*" fallback>
  <h1>Nothing matched this URL</h1>
</au-route>`,
  }),
  routerExample({
    id: 'wildcard-paths',
    title: 'Wildcard paths',
    description: 'Capture one segment with * or consume the complete remaining path with **.',
    initialPath: '/date/2026-08-16/summary',
    appHtml: `<nav>
  <a au-link.bind="{
    target: 'date/*/summary',
    params: { '*': '2026-08-16' }
  }">
    Daily summary
  </a>
  <a au-link.bind="{
    target: 'folders/*',
    params: { '*': 'guides and api' }
  }">
    Folder guide
  </a>
  <a au-link.bind="{
    target: 'files/**',
    params: { '**': 'guides/router/start.html' }
  }">
    Terminal file path
  </a>
</nav>
<au-route path="date/*/summary" exact>
  <h1>Daily summary</h1>
  <p>Captured date: <code>\${$params['*']}</code></p>
</au-route>
<au-route path="folders/*" exact>
  <h1>Single folder route</h1>
  <p>Captured folder: <code>\${$params['*']}</code></p>
  <p>Residue after <code>*</code>: <code>\${$route.residue}</code></p>
</au-route>
<au-route path="files/**">
  <h1>Terminal file route</h1>
  <p>Path presented: <code>\${$route.$path}</code></p>
  <p>Terminal segment: <code>\${$params['**']}</code></p>
  <p>Residue after <code>**</code>: <code>\${$route.residue}</code></p>
  <au-route path="/" exact>
    <p>The nested route receives <code>/</code>.</p>
  </au-route>
</au-route>`,
  }),
  routerExample({
    id: 'memory-adapter',
    title: 'Memory adapter',
    description: 'Use ordinary route links while an in-memory adapter stores navigation without browser history.',
    initialPath: '/dashboard',
    initialFile: '/src/main.ts',
    mainTs: `import Aurelia from 'aurelia';
import { MemoryPathAdapter, Routing } from 'aurelia-router-html';
import { App } from './app';

const adapter = new MemoryPathAdapter('/dashboard');

Aurelia
  .register(Routing.customize({
    adapter,
    animations: false
  }))
  .app({ host: document.querySelector('#app')!, component: App })
  .start();`,
    appTs: `import { resolve } from '@aurelia/kernel';
import {
  IPathAdapter,
  MemoryPathAdapter
} from 'aurelia-router-html';

export class App {
  private readonly adapter = resolve(IPathAdapter) as MemoryPathAdapter;

  public back(): void {
    this.adapter.back();
  }
}`,
    appHtml: `<nav>
  <a au-link="dashboard">Dashboard</a>
  <a au-link="reports">Reports</a>
  <button click.trigger="back()">Back</button>
</nav>
<main>
  <au-route path="dashboard" exact>
    <h1>Dashboard</h1>
    <p>This route started from memory.</p>
  </au-route>
  <au-route path="reports" exact>
    <h1>Reports</h1>
    <p>No browser location was required.</p>
  </au-route>
</main>`,
  }),
  routerExample({
    id: 'swap-order',
    title: 'Parallel swap order',
    description: 'Coordinate outgoing and incoming sibling product views in parallel.',
    initialPath: '/products/camera/specs',
    appHtml: `<au-route path="products/:productId" swap-order="parallel">
  <h1>Camera</h1>
  <nav>
    <a au-link="specs">Specs</a>
    <a au-link="reviews">Reviews</a>
  </nav>
  <div class="stage">
    <au-route path="specs" animate>
      <h2>Specs</h2>
      <p>24 MP · 4K video · 410 g</p>
    </au-route>
    <au-route path="reviews" animate>
      <h2>Reviews</h2>
      <p>Customers rate this camera 4.8/5.</p>
    </au-route>
  </div>
</au-route>`,
    appCss: `.stage {
  display: grid;
  min-height: 120px;
}

.stage > * {
  grid-area: 1 / 1;
}

.stage > .au-route-enter-active,
.stage > .au-route-leave-active {
  transition: opacity 320ms ease;
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
    initialFile: '/src/app.html',
    appHtml: `<au-route path="rooms" swap-order="parallel">
  <nav>
    <a au-link="sunny">Sunny room</a>
    <a au-link="moon">Moon room</a>
  </nav>
  <div class="stage animated-stage">
    <au-route path="sunny" animate>
      <article class="room sunny">
        <h1>Sunny room</h1>
      </article>
    </au-route>
    <au-route path="moon" animate>
      <article class="room moon">
        <h1>Moon room</h1>
      </article>
    </au-route>
  </div>
</au-route>`,
    appCss: `.animated-stage {
  display: grid;
  min-height: 180px;
}

.animated-stage > * {
  grid-area: 1 / 1;
}

.animated-stage > .au-route-enter-active,
.animated-stage > .au-route-leave-active {
  transition: opacity 340ms ease, transform 340ms ease;
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
    id: 'route-animations-transition-end',
    title: 'Transition-end settlement',
    description: 'Log navigation intent and the route-owned transition-end callback timing to make route settlement visible.',
    initialPath: '/rooms/sunny',
    initialFile: '/src/app.html',
    appTs: `export class App {
  public readonly log: string[] = ['Waiting for the next route change.'];

  public logIntent(target: string): void {
    this.pushLog('navigate', target);
  }

  public onTransitionEnd = ({ direction, route, animated }) => {
    const name = route.$path.split('/').filter(Boolean).at(-1) ?? 'root';
    this.pushLog(\`transition-end (\${direction}, animated=\${animated})\`, name);
  }

  private pushLog(phase: string, name: string): void {
    const stamp = new Date().toLocaleTimeString([], {
      hour12: false,
      minute: '2-digit',
      second: '2-digit',
    });
    const next = \`\${stamp}.\${String(new Date().getMilliseconds()).padStart(3, '0')} | \${phase} | \${name}\`;
    this.log.unshift(next);
    this.log.splice(6);
  }
}`,
    appHtml: `<au-route path="rooms" swap-order="parallel">
  <nav>
    <a au-link="sunny" click.trigger="logIntent('sunny')">Sunny room</a>
    <a au-link="moon" click.trigger="logIntent('moon')">Moon room</a>
  </nav>

  <p class="timing-note">Click a route, then compare the navigation timestamp with the later router-owned <code>transition-end.bind</code> timestamp below the stage.</p>

  <div class="stage settlement-stage">
    <au-route path="sunny" animate transition-end.bind="onTransitionEnd">
      <article class="room sunny">
        <h1>Sunny room</h1>
      </article>
    </au-route>
    <au-route path="moon" animate transition-end.bind="onTransitionEnd">
      <article class="room moon">
        <h1>Moon room</h1>
      </article>
    </au-route>
  </div>

  <section class="timing-log">
    <h2>Transition log</h2>
    <ul>
      <li repeat.for="entry of log">\${entry}</li>
    </ul>
  </section>
</au-route>`,
    appCss: `.settlement-stage {
  display: grid;
  min-height: 180px;
}

.settlement-stage > * {
  grid-area: 1 / 1;
}

.settlement-stage > .au-route-enter-active,
.settlement-stage > .au-route-leave-active {
  transition: opacity 720ms ease, transform 720ms cubic-bezier(.22, 1, .36, 1);
}

.settlement-stage > .au-route-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(.985);
}

.settlement-stage > .au-route-leave-active {
  opacity: 0;
  transform: translateY(-18px) scale(.985);
}

.timing-note {
  margin: 0 0 14px;
  color: #47635e;
}

.timing-log {
  margin-top: 16px;
  padding: 18px;
  border: 1px solid #cbdad7;
  border-radius: 18px;
  background: #f8fbfa;
}

.timing-log h2 {
  margin-bottom: 10px;
  font-size: 1rem;
}

.timing-log ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
  color: #27443f;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: .92rem;
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
    id: 'route-animations-slide',
    title: 'Carousel animation',
    description: 'Use the same animate opt-in for a horizontal carousel-style route transition.',
    initialPath: '/panels/inbox',
    initialFile: '/src/app.html',
    appHtml: `<au-route path="panels" swap-order="parallel">
  <nav>
    <a au-link="inbox">Inbox</a>
    <a au-link="archive">Archive</a>
    <a au-link="settings">Settings</a>
  </nav>

  <section class="variant-stage">
    <p class="carousel-note">This example keeps entering and leaving cards overlapped like a carousel track.</p>
    <au-route path="inbox" animate>
      <article class="variant-card inbox-card">
        <h1>Inbox</h1>
        <p>Fast-moving incoming work.</p>
      </article>
    </au-route>
    <au-route path="archive" animate>
      <article class="variant-card archive-card">
        <h1>Archive</h1>
        <p>Lower-energy slide with shared timing.</p>
      </article>
    </au-route>
    <au-route path="settings" animate>
      <article class="variant-card settings-card">
        <h1>Settings</h1>
        <p>Same route API, different visual tone.</p>
      </article>
    </au-route>
  </section>
</au-route>`,
    appCss: `.variant-stage {
  display: grid;
  min-height: 220px;
  overflow: hidden;
}

.variant-stage > * {
  grid-area: 1 / 1;
}

.carousel-note {
  align-self: start;
  justify-self: start;
  z-index: 2;
  margin: 0;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #30524a;
  backdrop-filter: blur(8px);
}

.variant-stage > .au-route-enter-active,
.variant-stage > .au-route-leave-active {
  transition:
    opacity 520ms ease,
    transform 520ms cubic-bezier(.22, 1, .36, 1),
    filter 520ms ease,
    clip-path 520ms ease;
}

.variant-stage > .au-route-enter-from {
  opacity: 0;
  transform: translateX(84px) scale(.965);
  filter: blur(10px);
  clip-path: inset(0 0 0 24%);
}

.variant-stage > .au-route-leave-active {
  opacity: 0;
  transform: translateX(-84px) scale(.965);
  filter: blur(10px);
  clip-path: inset(0 24% 0 0);
}

.variant-card {
  align-self: end;
  padding: 28px;
  border-radius: 22px;
  color: #11251f;
  box-shadow: 0 24px 50px rgba(17, 37, 31, 0.14);
}

.inbox-card {
  background: linear-gradient(135deg, #fff2bf, #ffd9a0);
}

.archive-card {
  background: linear-gradient(135deg, #d8efe9, #b8dcd2);
}

.settings-card {
  background: linear-gradient(135deg, #dce5ff, #c7d4f8);
}`,
  }),
  routerExample({
    id: 'route-animations-arc',
    title: 'Arc animation',
    description: 'Show sibling routes mixing default CSS, named CSS variants, and a JS animation callback in one overlapping stage.',
    initialPath: '/stories/dawn',
    initialFile: '/src/app.html',
    appTs: `export class App {
  public readonly animateRoute = ({
    direction,
    elements,
    signal,
  }: {
    direction: 'enter' | 'leave';
    elements: readonly HTMLElement[];
    signal: AbortSignal;
  }): void | Promise<void> => {
    const element = elements[0];
    if (element == null) {
      return;
    }

    const keyframes = direction === 'enter'
      ? [
          { opacity: 0, transform: 'translate(74px, 26px) rotate(12deg) scale(.92)' },
          { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
        ]
      : [
          { opacity: 1, transform: 'translate(0, 0) rotate(0deg) scale(1)' },
          { opacity: 0, transform: 'translate(-70px, -24px) rotate(-12deg) scale(.92)' },
        ];

    const animation = element.animate(keyframes, {
      duration: 540,
      easing: 'cubic-bezier(.2, .8, .2, 1)',
      fill: 'both',
    });

    if (signal.aborted) {
      animation.cancel();
      return;
    }

    const cancel = () => animation.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    return animation.finished.then(
      () => {
        signal.removeEventListener('abort', cancel);
      },
      () => {
        signal.removeEventListener('abort', cancel);
      },
    );
  };
}`,
    appHtml: `<au-route path="stories" swap-order="parallel">
  <nav>
    <a au-link="dawn">Dawn</a>
    <a au-link="noon">Noon</a>
    <a au-link="night">Night</a>
    <a au-link="orbit">Orbit</a>
  </nav>

  <section class="arc-stage">
    <au-route path="dawn" animate>
      <article class="arc-card dawn-card">
        <h1>Dawn</h1>
        <p>Uses the default <code>animate</code> style.</p>
      </article>
    </au-route>
    <au-route path="noon" animate="arc">
      <article class="arc-card noon-card">
        <h1>Noon</h1>
        <p>Uses the named <code>animate="arc"</code> style.</p>
      </article>
    </au-route>
    <au-route path="night" animate="lift">
      <article class="arc-card night-card">
        <h1>Night</h1>
        <p>Uses a separate <code>animate="lift"</code> variant.</p>
      </article>
    </au-route>
    <au-route path="orbit" animate.bind="animateRoute">
      <article class="arc-card orbit-card">
        <h1>Orbit</h1>
        <p>Uses <code>animate.bind="animateRoute"</code> for JS-driven motion.</p>
      </article>
    </au-route>
  </section>
</au-route>`,
    appCss: `.arc-stage {
  display: grid;
  min-height: 240px;
  overflow: hidden;
}

.arc-stage > * {
  grid-area: 1 / 1;
}

.arc-stage > .au-route-enter-active,
.arc-stage > .au-route-leave-active {
  transition:
    opacity 380ms ease,
    transform 380ms cubic-bezier(.2, .8, .2, 1),
    filter 380ms ease;
  transform-origin: center center;
}

.arc-stage > .au-route-enter-from {
  opacity: 0;
  transform: translateY(22px) scale(.97);
  filter: blur(8px);
}

.arc-stage > .au-route-leave-active {
  opacity: 0;
  transform: translateY(-18px) scale(.97);
  filter: blur(8px);
}

.arc-stage > .au-route-arc-enter-active,
.arc-stage > .au-route-arc-leave-active {
  transition:
    opacity 540ms ease,
    transform 540ms cubic-bezier(.2, .8, .2, 1),
    filter 540ms ease;
  transform-origin: center center;
}

.arc-stage > .au-route-arc-enter-from {
  opacity: 0;
  transform: translate(88px, 40px) rotate(10deg) scale(.94);
  filter: blur(10px);
}

.arc-stage > .au-route-arc-leave-active {
  opacity: 0;
  transform: translate(-88px, -36px) rotate(-10deg) scale(.94);
  filter: blur(10px);
}

.arc-stage > .au-route-lift-enter-active,
.arc-stage > .au-route-lift-leave-active {
  transition:
    opacity 460ms ease,
    transform 460ms cubic-bezier(.22, 1, .36, 1),
    filter 460ms ease;
  transform-origin: center bottom;
}

.arc-stage > .au-route-lift-enter-from {
  opacity: 0;
  transform: translateY(30px) scale(.92) rotate(-4deg);
  filter: blur(12px);
}

.arc-stage > .au-route-lift-leave-active {
  opacity: 0;
  transform: translateY(-26px) scale(.92) rotate(4deg);
  filter: blur(12px);
}

.arc-card {
  align-self: end;
  padding: 28px;
  border-radius: 24px;
  color: #14231f;
  box-shadow: 0 24px 54px rgba(20, 35, 31, 0.16);
}

.dawn-card {
  background: linear-gradient(135deg, #ffd7b3, #fff1be);
}

.noon-card {
  background: linear-gradient(135deg, #dff3eb, #c5e5d9);
}

.night-card {
  background: linear-gradient(135deg, #d8defc, #becbf4);
}

.orbit-card {
  background: linear-gradient(135deg, #e3d7ff, #c9e3ff);
}`,
  }),
  routerExample({
    id: 'route-animations-callback',
    title: 'Callback animation',
    description: 'Drive route transitions from a callback and settle on the returned promise instead of CSS timing alone.',
    initialPath: '/cards/alpha',
    initialFile: '/src/app.html',
    appTs: `export class App {
  public readonly animateRoute = ({
    direction,
    elements,
    signal,
  }: {
    direction: 'enter' | 'leave';
    elements: readonly HTMLElement[];
    signal: AbortSignal;
  }): void | Promise<void> => {
    const element = elements[0];
    if (element == null) {
      return;
    }

    const keyframes = direction === 'enter'
      ? [
          { opacity: 0, transform: 'translateY(18px) scale(.985)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ]
      : [
          { opacity: 1, transform: 'translateY(0) scale(1)' },
          { opacity: 0, transform: 'translateY(-18px) scale(.985)' },
        ];

    const animation = element.animate(keyframes, {
      duration: 360,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
      fill: 'both',
    });

    if (signal.aborted) {
      animation.cancel();
      return;
    }

    const cancel = () => animation.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    return animation.finished.then(
      () => {
        signal.removeEventListener('abort', cancel);
      },
      () => {
        signal.removeEventListener('abort', cancel);
      },
    );
  };
}`,
    appHtml: `<au-route path="cards" swap-order="parallel">
  <nav>
    <a au-link="alpha">Alpha</a>
    <a au-link="beta">Beta</a>
  </nav>

  <section class="callback-stage">
    <au-route path="alpha" animate.bind="animateRoute">
      <article class="callback-card alpha-card">
        <h1>Alpha</h1>
        <p>Animation completion comes from the callback promise.</p>
      </article>
    </au-route>
    <au-route path="beta" animate.bind="animateRoute">
      <article class="callback-card beta-card">
        <h1>Beta</h1>
        <p>Superseded navigation aborts the stale callback.</p>
      </article>
    </au-route>
  </section>
</au-route>`,
    appCss: `.callback-stage {
  display: grid;
  min-height: 220px;
}

.callback-stage > * {
  grid-area: 1 / 1;
}

.callback-card {
  padding: 28px;
  border-radius: 22px;
  color: #11251f;
}

.alpha-card {
  background: linear-gradient(135deg, #ffe8b2, #ffd0a1);
}

.beta-card {
  background: linear-gradient(135deg, #dce5ff, #bfd2ff);
}`,
  }),
  routerExample({
    id: 'route-animations-reduced-motion',
    title: 'Reduced motion',
    description: 'Use the same animate opt-in while softening movement through prefers-reduced-motion CSS.',
    initialPath: '/gallery/posters',
    initialFile: '/src/app.html',
    appHtml: `<au-route path="gallery" swap-order="parallel">
  <nav>
    <a au-link="posters">Posters</a>
    <a au-link="tickets">Tickets</a>
  </nav>

  <p>The default mode slides and fades. Reduced-motion mode removes the large movement and shortens the timing.</p>

  <section class="motion-stage">
    <au-route path="posters" animate>
      <article class="motion-card posters-card">
        <h1>Posters</h1>
      </article>
    </au-route>
    <au-route path="tickets" animate>
      <article class="motion-card tickets-card">
        <h1>Tickets</h1>
      </article>
    </au-route>
  </section>
</au-route>`,
    appCss: `.motion-stage {
  display: grid;
  min-height: 180px;
}

.motion-stage > * {
  grid-area: 1 / 1;
}

.motion-stage > .au-route-enter-active,
.motion-stage > .au-route-leave-active {
  transition: opacity 380ms ease, transform 380ms ease;
}

.motion-stage > .au-route-enter-from {
  opacity: 0;
  transform: translateY(18px);
}

.motion-stage > .au-route-leave-active {
  opacity: 0;
  transform: translateY(-18px);
}

@media (prefers-reduced-motion: reduce) {
  .motion-stage > .au-route-enter-active,
  .motion-stage > .au-route-leave-active {
    transition-duration: 1ms;
    transform: none;
  }

  .motion-stage > .au-route-enter-from,
  .motion-stage > .au-route-leave-active {
    transform: none;
  }
}

.motion-card {
  padding: 28px;
  border-radius: 20px;
}

.posters-card {
  background: #fee8bd;
}

.tickets-card {
  background: #cfe5f8;
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
  <a au-link="/shop">Shop</a>
  <a au-link="/cart">Cart (\${state.totalQty})</a>
</nav>
<button click.trigger="state.totalQty = state.totalQty + 1">Add item</button>
<au-route path="shop">
  <h1>Shop</h1>
  <p>Your cart already has \${state.totalQty} items.</p>
</au-route>
<au-route path="cart">
  <h1>Cart</h1>
  <p>Items: \${state.totalQty}</p>
</au-route>`,
  }),
  routerExample({
    id: 'kitchen-sink',
    title: 'Kitchen sink',
    description: 'Run a small authenticated workspace with an in-memory database, nested routes, CRUD forms, repeated links, guards, and slotted shells.',
    initialPath: '/welcome',
    appTs: `import { resolve } from 'aurelia';
import { IRouteContext } from 'aurelia-router-html';

type Role = 'guest' | 'member' | 'admin';

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface ProjectRecord {
  id: string;
  name: string;
  ownerId: string;
  status: 'draft' | 'active' | 'paused';
}

class MockDatabase {
  public readonly users: UserRecord[] = [
    { id: 'ada', name: 'Ada Lovelace', email: 'ada@aurora.test', role: 'admin' },
    { id: 'mina', name: 'Mina Park', email: 'mina@aurora.test', role: 'member' },
    { id: 'jo', name: 'Jo Diaz', email: 'jo@aurora.test', role: 'guest' },
  ];

  public readonly projects: ProjectRecord[] = [
    { id: 'atlas', name: 'Atlas migration', ownerId: 'ada', status: 'active' },
    { id: 'canvas', name: 'Canvas refresh', ownerId: 'mina', status: 'draft' },
  ];
}

export class App {
  private readonly route = resolve(IRouteContext);
  public readonly db = new MockDatabase();
  public sessionUserId = '';
  public notice = 'Choose a user and sign in to open the workspace.';
  public draftUserName = '';
  public draftUserEmail = '';
  public draftUserRole: Role = 'member';
  public draftProjectName = '';
  public draftProjectOwnerId = 'ada';
  public draftProjectStatus: ProjectRecord['status'] = 'draft';

  public get users(): UserRecord[] {
    return this.db.users;
  }

  public get projects(): ProjectRecord[] {
    return this.db.projects;
  }

  public get currentUser(): UserRecord | null {
    return this.users.find(user => user.id === this.sessionUserId) ?? null;
  }

  public get isSignedIn(): boolean {
    return this.currentUser != null;
  }

  public get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  public signIn(): void {
    const user = this.currentUser;
    if (user == null) {
      this.notice = 'Pick a user before signing in.';
      return;
    }
    this.notice = \`Signed in as \${user.name}.\`;
    void this.route.load('/workspace/dashboard');
  }

  public signOut(): void {
    const user = this.currentUser;
    this.sessionUserId = '';
    this.notice = user == null
      ? 'Signed out.'
      : \`Signed out \${user.name}.\`;
    void this.route.load('/welcome', {}, { replace: true });
  }

  public requireSession(): boolean | string {
    return this.isSignedIn ? true : '/sign-in';
  }

  public openAdmin(): void {
    this.notice = this.isAdmin
      ? 'Admin tools unlocked.'
      : 'Administration stays locked to the admin account.';
  }

  public createUser(): void {
    if (this.draftUserName.trim() === '' || this.draftUserEmail.trim() === '') {
      this.notice = 'User name and email are both required.';
      return;
    }
    const id = this.draftUserName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || \`user-\${this.users.length + 1}\`;
    this.db.users.push({
      id,
      name: this.draftUserName.trim(),
      email: this.draftUserEmail.trim(),
      role: this.draftUserRole,
    });
    this.draftUserName = '';
    this.draftUserEmail = '';
    this.draftUserRole = 'member';
    this.notice = \`Created user \${id}.\`;
    if (this.draftProjectOwnerId === '') {
      this.draftProjectOwnerId = id;
    }
  }

  public saveUser(user: UserRecord): void {
    this.notice = \`Saved \${user.name}.\`;
  }

  public deleteUser(userId: string): void {
    if (this.currentUser?.id === userId) {
      this.notice = 'Sign out before deleting the active user.';
      return;
    }
    const index = this.users.findIndex(user => user.id === userId);
    if (index === -1) {
      return;
    }
    const [removed] = this.db.users.splice(index, 1);
    for (const project of this.projects) {
      if (project.ownerId === removed.id) {
        project.ownerId = this.users[0]?.id ?? '';
      }
    }
    this.notice = \`Deleted \${removed.name}.\`;
    if (this.draftProjectOwnerId === removed.id) {
      this.draftProjectOwnerId = this.users[0]?.id ?? '';
    }
  }

  public createProject(): void {
    if (this.draftProjectName.trim() === '' || this.draftProjectOwnerId === '') {
      this.notice = 'Project name and owner are required.';
      return;
    }
    const id = this.draftProjectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || \`project-\${this.projects.length + 1}\`;
    this.db.projects.push({
      id,
      name: this.draftProjectName.trim(),
      ownerId: this.draftProjectOwnerId,
      status: this.draftProjectStatus,
    });
    this.draftProjectName = '';
    this.draftProjectStatus = 'draft';
    this.notice = \`Created project \${id}.\`;
  }

  public saveProject(project: ProjectRecord): void {
    this.notice = \`Saved project \${project.name}.\`;
  }

  public deleteProject(projectId: string): void {
    const index = this.projects.findIndex(project => project.id === projectId);
    if (index === -1) {
      return;
    }
    const [removed] = this.db.projects.splice(index, 1);
    this.notice = \`Deleted project \${removed.name}.\`;
  }

  public ownerName(ownerId: string): string {
    return this.users.find(user => user.id === ownerId)?.name ?? 'Unassigned';
  }

  public userRoute(user: UserRecord): string {
    return '/workspace/users/' + user.id;
  }

  public projectRoute(project: ProjectRecord): string {
    return '/workspace/projects/' + project.id;
  }
}`,
    appHtml: `<import from="./workspace-shell"></import>

<header class="kitchen-header">
  <span class="eyebrow">Kitchen sink</span>
  <h1>Aurora Ops</h1>
  <p>Mock auth, nested routes, CRUD forms, repeated links, slots, and ordinary Aurelia state in one small routed app.</p>
</header>

<nav class="global-nav">
  <a au-link="/welcome" active-class="is-active">Welcome</a>
  <a au-link="/sign-in" active-class="is-active">Sign in</a>
  <a au-link="/workspace/dashboard" active-class="is-active">Workspace</a>
</nav>

<section class="session-bar">
  <div>
    <strong>Session</strong>
    <span>\${currentUser?.name ?? 'Signed out'}</span>
  </div>
  <button click.trigger="signOut()" disabled.bind="!isSignedIn">Sign out</button>
</section>

<p class="notice" role="status">\${notice}</p>

<main>
  <au-route path="welcome" exact>
    <section class="landing-card">
      <h2>Welcome</h2>
      <p>Use the mock sign-in flow, then open the workspace to edit users and projects without leaving the page.</p>
      <ul class="landing-list">
        <li><strong>Users:</strong> \${users.length}</li>
        <li><strong>Projects:</strong> \${projects.length}</li>
        <li><strong>Current user:</strong> \${currentUser?.role ?? 'none'}</li>
      </ul>
    </section>
  </au-route>

  <au-route path="sign-in" exact>
    <section class="panel-card auth-card">
      <h2>Sign in</h2>
      <p>Pick a mock record from the in-memory database.</p>
      <label>
        <span>User</span>
        <select value.bind="sessionUserId">
          <option value="">Choose a user</option>
          <option repeat.for="user of users" model.bind="user.id">\${user.name} · \${user.role}</option>
        </select>
      </label>
      <div class="row-actions">
        <button click.trigger="signIn()">Sign in</button>
        <a au-link="/workspace/dashboard">Go to workspace</a>
      </div>
    </section>
  </au-route>

  <au-route path="workspace" can-load.bind="() => requireSession()">
    <let sessionLabel.bind="currentUser == null ? 'No session' : currentUser.name + ' · ' + currentUser.role"></let>
    <workspace-shell>
      <strong au-slot="title">Aurora Ops workspace</strong>
      <span au-slot="subtitle">Signed in as \${sessionLabel}</span>

      <nav class="workspace-nav" au-slot="nav">
        <a au-link="dashboard" active-class="is-active">Dashboard</a>
        <a au-link="users" active-class="is-active">Users</a>
        <a au-link="projects" active-class="is-active">Projects</a>
        <a
          au-link="admin"
          active-class="is-active"
          class.bind="isAdmin ? '' : 'is-restricted'"
          click.trigger="openAdmin()">Admin</a>
      </nav>

      <au-route path="dashboard" exact>
        <section class="dashboard-grid">
          <article class="metric-card">
            <span class="metric-label">Users</span>
            <strong>\${users.length}</strong>
          </article>
          <article class="metric-card">
            <span class="metric-label">Projects</span>
            <strong>\${projects.length}</strong>
          </article>
          <article class="metric-card">
            <span class="metric-label">Signed in</span>
            <strong>\${currentUser?.name ?? 'None'}</strong>
          </article>
        </section>

        <section class="dashboard-columns">
          <article class="panel-card">
            <h3>Recent users</h3>
            <a repeat.for="user of users" class="list-link" au-link.bind="userRoute(user)" active-class="is-active">
              \${user.name}
              <span>\${user.role}</span>
            </a>
          </article>

          <article class="panel-card">
            <h3>Recent projects</h3>
            <a repeat.for="project of projects" class="list-link" au-link.bind="projectRoute(project)" active-class="is-active">
              \${project.name}
              <span>\${project.status}</span>
            </a>
          </article>
        </section>
      </au-route>

      <au-route path="users">
        <section class="split-layout">
          <aside class="sidebar-card">
            <h3>Users</h3>
            <a repeat.for="user of users" class="list-link" au-link.bind="user.id" active-class="is-active">
              \${user.name}
              <span>\${user.role}</span>
            </a>
            <a class="list-link create-link" au-link="new" active-class="is-active">
              Create user
              <span>Form</span>
            </a>
          </aside>

          <section class="detail-card">
            <au-route path="new" exact>
              <h3>Create user</h3>
              <label>
                <span>Name</span>
                <input type="text" value.bind="draftUserName">
              </label>
              <label>
                <span>Email</span>
                <input type="email" value.bind="draftUserEmail">
              </label>
              <label>
                <span>Role</span>
                <select value.bind="draftUserRole">
                  <option model.bind="'guest'">guest</option>
                  <option model.bind="'member'">member</option>
                  <option model.bind="'admin'">admin</option>
                </select>
              </label>
              <div class="row-actions">
                <button click.trigger="createUser()">Create user</button>
                <a au-link="../dashboard">Cancel</a>
              </div>
            </au-route>

            <template repeat.for="user of users">
              <au-route path.bind="user.id" exact>
                <h3>Edit \${user.name}</h3>
                <label>
                  <span>Name</span>
                  <input type="text" value.bind="user.name">
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" value.bind="user.email">
                </label>
                <label>
                  <span>Role</span>
                  <select value.bind="user.role">
                    <option model.bind="'guest'">guest</option>
                    <option model.bind="'member'">member</option>
                    <option model.bind="'admin'">admin</option>
                  </select>
                </label>
                <div class="row-actions">
                  <button click.trigger="saveUser(user)">Save user</button>
                  <button class="danger" click.trigger="deleteUser(user.id)">Delete</button>
                </div>
              </au-route>
            </template>

            <au-route path="*" fallback>
              <div class="empty-state">
                <h3>Select a user</h3>
                <p>Choose a record from the sidebar or open the create form.</p>
              </div>
            </au-route>
          </section>
        </section>
      </au-route>

      <au-route path="projects">
        <section class="split-layout">
          <aside class="sidebar-card">
            <h3>Projects</h3>
            <a repeat.for="project of projects" class="list-link" au-link.bind="project.id" active-class="is-active">
              \${project.name}
              <span>\${project.status}</span>
            </a>
            <a class="list-link create-link" au-link="new" active-class="is-active">
              Create project
              <span>Form</span>
            </a>
          </aside>

          <section class="detail-card">
            <au-route path="new" exact>
              <h3>Create project</h3>
              <label>
                <span>Name</span>
                <input type="text" value.bind="draftProjectName">
              </label>
              <label>
                <span>Owner</span>
                <select value.bind="draftProjectOwnerId">
                  <option repeat.for="user of users" model.bind="user.id">\${user.name}</option>
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value.bind="draftProjectStatus">
                  <option model.bind="'draft'">draft</option>
                  <option model.bind="'active'">active</option>
                  <option model.bind="'paused'">paused</option>
                </select>
              </label>
              <div class="row-actions">
                <button click.trigger="createProject()">Create project</button>
                <a au-link="../dashboard">Cancel</a>
              </div>
            </au-route>

            <template repeat.for="project of projects">
              <au-route path.bind="project.id" exact>
                <h3>Edit \${project.name}</h3>
                <label>
                  <span>Name</span>
                  <input type="text" value.bind="project.name">
                </label>
                <label>
                  <span>Owner</span>
                  <select value.bind="project.ownerId">
                    <option repeat.for="user of users" model.bind="user.id">\${user.name}</option>
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select value.bind="project.status">
                    <option model.bind="'draft'">draft</option>
                    <option model.bind="'active'">active</option>
                    <option model.bind="'paused'">paused</option>
                  </select>
                </label>
                <p class="meta-line">Owner: \${ownerName(project.ownerId)}</p>
                <div class="row-actions">
                  <button click.trigger="saveProject(project)">Save project</button>
                  <button class="danger" click.trigger="deleteProject(project.id)">Delete</button>
                </div>
              </au-route>
            </template>

            <au-route path="*" fallback>
              <div class="empty-state">
                <h3>Select a project</h3>
                <p>Choose a project from the sidebar or create a fresh one.</p>
              </div>
            </au-route>
          </section>
        </section>
      </au-route>

      <au-route path="admin" exact>
        <section class="panel-card admin-card">
          <template if.bind="isAdmin">
          <h3>Admin audit panel</h3>
          <p>Only the admin account can open this screen.</p>
          <ul class="landing-list">
            <li repeat.for="project of projects">\${project.name} · owner: \${ownerName(project.ownerId)} · \${project.status}</li>
          </ul>
          </template>
          <template else>
            <h3>Admin access required</h3>
            <p>This route stays visible, but the audit data unlocks only for the admin account.</p>
            <p>Sign in as Ada Lovelace to open the full admin panel.</p>
          </template>
        </section>
      </au-route>

      <au-route path="*" fallback>
        <div class="empty-state">
          <h3>Choose a workspace screen</h3>
          <p>Start with the dashboard, users, or projects section.</p>
        </div>
      </au-route>
    </workspace-shell>
  </au-route>

  <au-route path="*" fallback>
    <section class="landing-card">
      <h2>Not found</h2>
      <p>The requested screen is not part of this mock app.</p>
    </section>
  </au-route>
</main>`,
    appCss: `:root {
  color: #102521;
  background:
    radial-gradient(circle at top left, rgba(31, 122, 103, 0.18), transparent 28%),
    linear-gradient(180deg, #eef5f3 0%, #e6efec 100%);
}

body {
  margin: 0;
}

#app {
  max-width: 1160px;
  margin: 0 auto;
  padding: 36px 24px 48px;
}

.kitchen-header {
  margin-bottom: 28px;
}

.kitchen-header h1 {
  margin: 10px 0 12px;
  font-size: clamp(2.6rem, 7vw, 5rem);
  line-height: .92;
  letter-spacing: -.04em;
}

.kitchen-header p {
  max-width: 780px;
  margin: 0;
  color: #4d6660;
  font-size: 1.02rem;
}

.eyebrow {
  color: #0a7566;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.global-nav,
.workspace-nav,
.row-actions,
.session-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.global-nav {
  margin-bottom: 16px;
  padding: 8px;
  border: 1px solid rgba(130, 161, 151, 0.45);
  border-radius: 20px;
  background: rgba(248, 251, 250, 0.78);
  backdrop-filter: blur(16px);
}

.global-nav a,
.workspace-nav a {
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: #36534d;
  text-decoration: none;
  font-weight: 600;
}

.global-nav a.is-active,
.workspace-nav a.is-active {
  color: white;
  background: linear-gradient(135deg, #0f7664, #0b5b4d);
  box-shadow: 0 10px 24px rgba(11, 91, 77, 0.24);
}

.workspace-nav a.is-restricted {
  color: #7a6934;
  background: rgba(205, 182, 120, 0.16);
}

.session-bar {
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  margin-bottom: 14px;
  border: 1px solid rgba(124, 148, 141, 0.42);
  border-radius: 20px;
  background: rgba(248, 251, 250, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.session-bar strong,
.metric-label,
.workspace-shell .shell-label {
  display: block;
  font-size: .74rem;
  text-transform: uppercase;
  letter-spacing: .09em;
  color: #647c76;
}

.notice {
  margin: 0 0 18px;
  padding: 12px 16px;
  border: 1px solid rgba(149, 177, 168, 0.5);
  border-radius: 16px;
  color: #31544c;
  background: rgba(244, 249, 247, 0.92);
}

main {
  display: block;
}

.landing-card,
.panel-card,
.sidebar-card,
.detail-card,
.workspace-shell {
  border: 1px solid rgba(192, 208, 203, 0.9);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 22px 50px rgba(18, 37, 32, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.7) inset;
}

.landing-card,
.panel-card,
.sidebar-card,
.detail-card {
  padding: 24px;
}

.auth-card,
.admin-card {
  max-width: 620px;
}

.landing-list {
  margin: 16px 0 0;
  padding-left: 18px;
  display: grid;
  gap: 10px;
}

.dashboard-grid,
.dashboard-columns,
.split-layout {
  display: grid;
  gap: 18px;
}

.dashboard-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin-bottom: 18px;
}

.dashboard-columns,
.split-layout {
  grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
}

.metric-card {
  padding: 20px;
  border: 1px solid #d7e5e1;
  border-radius: 20px;
  background: linear-gradient(180deg, #f9fbfb, #eef6f3);
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 1.95rem;
  letter-spacing: -.04em;
}

.sidebar-card h3,
.detail-card h3,
.panel-card h3 {
  margin-top: 0;
}

.list-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 13px 14px;
  border: 1px solid #dbe6e3;
  border-radius: 16px;
  color: #173f39;
  background: #f8fbfa;
  text-decoration: none;
  transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
}

.list-link + .list-link {
  margin-top: 10px;
}

.list-link:hover {
  border-color: #b8d0ca;
  background: #f3f8f6;
  transform: translateY(-1px);
}

.list-link.is-active {
  border-color: #0f7664;
  background: linear-gradient(135deg, rgba(15, 118, 100, 0.12), rgba(11, 91, 77, 0.04));
  box-shadow: inset 0 0 0 1px rgba(15, 118, 100, 0.18);
}

.list-link span {
  color: #607872;
  font-size: .88rem;
}

.create-link {
  margin-top: 14px;
  border-style: dashed;
}

label {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}

label span {
  font-weight: 600;
  color: #294640;
}

input,
select {
  width: 100%;
  padding: 12px 13px;
  border: 1px solid #bfd2cd;
  border-radius: 14px;
  color: #16312d;
  background: #fbfdfc;
  box-sizing: border-box;
}

input:focus,
select:focus {
  outline: none;
  border-color: #0f7664;
  box-shadow: 0 0 0 4px rgba(15, 118, 100, 0.12);
}

button,
a {
  text-decoration: none;
}

button {
  padding: 11px 15px;
  border: 1px solid #9bb8b0;
  border-radius: 999px;
  color: #0c5f55;
  background: white;
  font-weight: 600;
  cursor: pointer;
}

button:hover:not(:disabled) {
  border-color: #7fa79e;
}

button:disabled {
  cursor: not-allowed;
  opacity: .48;
}

.row-actions {
  margin-top: 18px;
}

.row-actions button:first-child {
  color: white;
  border-color: #0f7664;
  background: linear-gradient(135deg, #0f7664, #0b5b4d);
}

button.danger {
  border-color: #d3a6a6;
  color: #8b2f2f;
  background: #fff8f8;
}

.meta-line {
  margin-top: 12px;
  color: #58716b;
  font-size: .94rem;
}

.empty-state {
  padding: 18px 4px;
  color: #526965;
}

@media (max-width: 760px) {
  #app {
    padding: 28px 16px 36px;
  }

  .session-bar,
  .dashboard-columns,
  .split-layout {
    grid-template-columns: 1fr;
  }
}`,
    extraFiles: {
      '/src/workspace-shell.ts': `export class WorkspaceShell {}
`,
      '/src/workspace-shell.html': `<article class="workspace-shell">
  <header class="workspace-top">
    <div>
      <span class="shell-label">Workspace shell</span>
      <h2><au-slot name="title"></au-slot></h2>
      <p><au-slot name="subtitle"></au-slot></p>
    </div>
  </header>
  <div class="workspace-nav-slot">
    <au-slot name="nav"></au-slot>
  </div>
  <section class="workspace-body">
    <au-slot></au-slot>
  </section>
</article>`,
      '/src/workspace-shell.css': `.workspace-shell {
  padding: 26px;
  position: relative;
  overflow: hidden;
}

.workspace-shell::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 120px;
  background: linear-gradient(135deg, rgba(15, 118, 100, 0.12), rgba(11, 91, 77, 0));
  pointer-events: none;
}

.workspace-top,
.workspace-nav-slot,
.workspace-body {
  position: relative;
}

.workspace-top h2 {
  margin: 8px 0 4px;
  font-size: 1.9rem;
  letter-spacing: -.03em;
}

.workspace-top p {
  margin: 0;
  color: #58726c;
}

.workspace-nav-slot {
  margin: 20px 0 18px;
  padding: 8px;
  border: 1px solid rgba(202, 217, 212, 0.86);
  border-radius: 18px;
  background: #f8fbfa;
}

.workspace-body {
  display: block;
}`,
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
  <a au-link="/">Home</a>
  <a
    repeat.for="product of products"
    au-link.bind="{
      target: '/products/:productId',
      params: { productId: product.id }
    }">
    \${product.name}
  </a>
  <a au-link="/missing">Missing route</a>
</nav>

<main>
  <au-route path="/" exact>
    <h2>Welcome</h2>
    <p>Edit any file, then run the project again.</p>
  </au-route>

  <au-route path="products/:productId" exact>
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
import { Routing } from 'aurelia-router-html';
import { App } from './app';
import { UpperValueConverter } from './upper';

Aurelia.register(Routing, UpperValueConverter).app({
  host: document.querySelector('#app')!,
  component: App,
}).start();`,
      '/src/app.ts': `export class App {
  public services = ['Compiler', 'Router', 'Preview'];
}`,
      '/src/app.html': `<import from="./status-card"></import>
<import from="./status-badge.html"></import>
<nav>
  <a au-link="/status">Status</a>
  <a au-link="/about">About</a>
</nav>
<au-route path="status">
  <div class="cards">
    <status-card repeat.for="service of services" name.bind="service | upper"></status-card>
    <status-badge></status-badge>
  </div>
</au-route>
<au-route path="about">
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
    initialFile: options.initialFile ?? '/src/app.html',
    initialPath: options.initialPath,
    files: {
      '/src/main.ts': options.mainTs ?? createMainSource(
        options.routingMode,
        options.routeQueryKey,
        options.scrolling,
        options.focus,
        options.interceptLinks,
      ),
      '/src/app.ts': options.appTs ?? 'export class App {}',
      '/src/app.html': options.appHtml,
      '/src/app.css': `${baseCss}\n${options.appCss ?? ''}`,
      ...options.extraFiles,
    },
  };
}

function createMainSource(
  routingMode: 'path' | 'hash' | 'query' = 'path',
  routeQueryKey?: string,
  scrolling?: boolean,
  focus?: boolean,
  interceptLinks?: boolean,
): string {
  const modeLines = routingMode === 'path'
    ? ''
    : `,\n    routingMode: '${routingMode}'${routeQueryKey == null ? '' : `,\n    routeQueryKey: '${routeQueryKey}'`}`;
  const scrollLine = scrolling == null ? '' : `,\n    scrolling: ${scrolling}`;
  const focusLine = focus == null ? '' : `,\n    focus: ${focus}`;
  const interceptLine = interceptLinks == null ? '' : `,\n    interceptLinks: ${interceptLinks}`;
  return `import Aurelia from 'aurelia';
import { Routing } from 'aurelia-router-html';
import { App } from './app';

Aurelia
  .register(Routing.customize({
    animations: false${modeLines}${scrollLine}${focusLine}${interceptLine}
  }))
  .app({ host: document.querySelector('#app')!, component: App })
  .start();`;
}
