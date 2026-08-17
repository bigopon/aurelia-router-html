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
    id: 'active-links',
    title: 'Active links',
    description: 'Generate link URLs and selected navigation state from the same route targets.',
    initialPath: '/products/ice-cream/reviews?sort=recent#comments',
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
    id: 'programmatic-navigation',
    title: 'Programmatic navigation',
    description: 'Load relative and root-absolute targets from the current route context.',
    initialPath: '/home',
    initialFile: '/src/app.ts',
    appTs: `import { resolve } from '@aurelia/kernel';
import { IRouteContext } from 'aurelia-v2-router-html';

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
    title: 'Loading and loaded lifecycle',
    description: 'Prepare each nested route from parent to child, then observe readiness from child to parent.',
    initialPath: '/home',
    appTs: `export class App {
  public phase = 'Choose a route';
  public events: string[] = [];

  public async prepare(name: string): Promise<void> {
    this.phase = \`Loading \${name}…\`;
    this.events.push(\`\${name} loading\`);
    await new Promise(resolve => setTimeout(resolve, 180));
  }

  public ready(name: string): void {
    this.events.push(\`\${name} loaded\`);
    this.phase = \`\${name} ready\`;
  }
}`,
    appHtml: `<nav>
  <a au-link="home">Home</a>
  <a au-link="projects/board">Project board</a>
</nav>

<p role="status">\${phase}</p>
<ol>
  <li repeat.for="event of events">\${event}</li>
</ol>

<main>
  <au-route path="home" exact>
    <h1>Home</h1>
    <p>Open the project board to run both nested lifecycle pairs.</p>
  </au-route>

  <au-route
    path="projects"
    loading.bind="() => prepare('Projects')"
    loaded.bind="() => ready('Projects')">
    <h1>Projects</h1>

    <au-route
      path="board"
      exact
      loading.bind="() => prepare('Board')"
      loaded.bind="() => ready('Board')">
      <h2>Project board</h2>
      <p>The complete nested branch is ready.</p>
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
    appTs: `import type { RouteFailure } from 'aurelia-v2-router-html';

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
    loading.bind="() => loadReports()"
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
    appTs: `import type { RouteFailure } from 'aurelia-v2-router-html';

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
          loading.bind="() => loadReports()">
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
    appTs: `import type { RouteFailure } from 'aurelia-v2-router-html';

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
              loading.bind="() => loadReports()">
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
import { MemoryPathAdapter, Routing } from 'aurelia-v2-router-html';
import { App } from './app';

const adapter = new MemoryPathAdapter('/dashboard');

void Aurelia
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
} from 'aurelia-v2-router-html';

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
    description: 'Compose repeated routes with VM scope, let bindings, two-way interaction, and named slots.',
    initialPath: '/sunny',
    appTs: `export class App {
  public rooms = [
    { path: 'sunny', name: 'Sunny room', visits: 0 },
    { path: 'moon', name: 'Moon room', visits: 0 },
  ];
}`,
    appHtml: `<import from="./room-shell"></import>
<nav>
  <a repeat.for="room of rooms" au-link.bind="'/' + room.path">\${room.name}</a>
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
      '/src/main.ts': options.mainTs ?? createMainSource(options.routingMode, options.routeQueryKey),
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
    animations: false${modeLines}
  }))
  .app({ host: document.querySelector('#app')!, component: App })
  .start();`;
}
