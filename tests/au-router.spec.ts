import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import type { AuRouter } from '../router/au-router';
import { Routing } from '../router/configuration';
import { IRouteCoordinator } from '../router/coordinator';
import type { RouteFailure } from '../router/error';
import { MemoryPathAdapter } from '../router/memory-path-adapter';
import { IRouteContext } from '../router/route-context';

describe('au-router memory routing', function () {
  it('uses current-path as the initial nested location and responds to external writes', async function () {
    class App {
      public panelPath: string = '/detail/7';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="list" exact><span data-list>List</span></au-route>
        <au-route path="detail/:id" exact><span data-detail>\${$params.id}</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-detail]')?.textContent, '7');
      assert.strictEqual(fixture.component.panelPath, '/detail/7');

      fixture.component.panelPath = '/list';
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-list]')?.textContent, 'List');
      assert.strictEqual(fixture.appHost.querySelector('[data-detail]'), null);
      assert.strictEqual(fixture.component.panelPath, '/list');
    } finally {
      await fixture.tearDown();
    }
  });

  it('writes the committed nested path back through current-path and keeps sibling routers isolated', async function () {
    class App {
      public leftPath: string = '/one';
      public rightPath: string = '/alpha';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="leftPath">
        <au-route path="one" exact>
          <button data-go-two click.trigger="$route.load('/two')">Go two</button>
          <span data-one>One</span>
        </au-route>
        <au-route path="two" exact><span data-two>Two</span></au-route>
      </au-router>

      <au-router current-path.bind="rightPath">
        <au-route path="alpha" exact><span data-alpha>Alpha</span></au-route>
        <au-route path="beta" exact><span data-beta>Beta</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-one]')?.textContent, 'One');
      assert.strictEqual(fixture.appHost.querySelector('[data-alpha]')?.textContent, 'Alpha');

      click(fixture.appHost.querySelector('[data-go-two]') as HTMLElement);
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-two]')?.textContent, 'Two');
      assert.strictEqual(fixture.component.leftPath, '/two');
      assert.strictEqual(fixture.component.rightPath, '/alpha');
      assert.strictEqual(fixture.appHost.querySelector('[data-alpha]')?.textContent, 'Alpha');
      assert.strictEqual(fixture.appHost.querySelector('[data-beta]'), null);
    } finally {
      await fixture.tearDown();
    }
  });

  it('restores the previous current-path when navigation is rejected', async function () {
    class App {
      public panelPath: string = '/ready';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="ready" exact><span data-ready>Ready</span></au-route>
        <au-route path="blocked" exact can-load.bind="() => false"><span data-blocked>Blocked</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      fixture.component.panelPath = '/blocked';
      await tasksSettled();

      assert.strictEqual(fixture.component.panelPath, '/ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-blocked]'), null);
    } finally {
      await fixture.tearDown();
    }
  });

  it('keeps the committed route active while an external current-path change is still pending', async function () {
    const waits = createWaits();
    class App {
      public panelPath: string = '/ready';
      public wait(name: string): Promise<void> {
        return waits.wait(name);
      }
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="ready" exact><span data-ready>Ready</span></au-route>
        <au-route path="slow-one" exact loading.bind="wait('one')"><span data-one>One</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      fixture.component.panelPath = '/slow-one';
      await Promise.resolve();
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.component.panelPath, '/slow-one');

      await waits.whenRequested('one');
      waits.resolve('one');
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-one]')?.textContent, 'One');
      assert.strictEqual(fixture.component.panelPath, '/slow-one');
    } finally {
      waits.resolveAll();
      await fixture.tearDown();
    }
  });

  it('cancels in-flight navigation cleanly when au-router is removed', async function () {
    const waits = createWaits();
    class App {
      public visible: boolean = true;
      public panelPath: string = '/ready';
      public wait(name: string): Promise<void> {
        return waits.wait(name);
      }
    }

    const fixture = await createFixture(
      `<au-router if.bind="visible" current-path.bind="panelPath">
        <au-route path="ready" exact><span data-ready>Ready</span></au-route>
        <au-route path="slow-one" exact loading.bind="wait('one')"><span data-one>One</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      fixture.component.panelPath = '/slow-one';
      await Promise.resolve();
      fixture.component.visible = false;
      await tasksSettled();

      await waits.whenRequested('one');
      waits.resolve('one');
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-ready]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.component.panelPath, '/slow-one');
    } finally {
      waits.resolveAll();
      await fixture.tearDown();
    }
  });

  it('supersedes an in-flight navigation when current-path is reverted to the committed value', async function () {
    const waits = createWaits();
    class App {
      public panelPath: string = '/ready';
      public wait(name: string): Promise<void> {
        return waits.wait(name);
      }
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="ready" exact><span data-ready>Ready</span></au-route>
        <au-route path="slow-one" exact loading.bind="wait('one')"><span data-one>One</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      fixture.component.panelPath = '/slow-one';
      await Promise.resolve();
      fixture.component.panelPath = '/ready';
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.component.panelPath, '/ready');

      await waits.whenRequested('one');
      waits.resolve('one');
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.component.panelPath, '/ready');
    } finally {
      waits.resolveAll();
      await fixture.tearDown();
    }
  });

  it('keeps only the latest external current-path change when several happen during in-flight navigation', async function () {
    const waits = createWaits();
    class App {
      public panelPath: string = '/ready';
      public wait(name: string): Promise<void> {
        return waits.wait(name);
      }
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="ready" exact><span data-ready>Ready</span></au-route>
        <au-route path="slow-one" exact loading.bind="wait('one')"><span data-one>One</span></au-route>
        <au-route path="slow-two" exact loading.bind="wait('two')"><span data-two>Two</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await tasksSettled();
      fixture.component.panelPath = '/slow-one';
      await Promise.resolve();
      fixture.component.panelPath = '/slow-two';
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-two]'), null);
      assert.strictEqual(fixture.component.panelPath, '/slow-two');

      await waits.whenRequested('one');
      waits.resolve('one');
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-two]'), null);
      assert.strictEqual(fixture.component.panelPath, '/slow-two');

      await waits.whenRequested('two');
      waits.resolve('two');
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-two]')?.textContent, 'Two');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]'), null);
      assert.strictEqual(fixture.component.panelPath, '/slow-two');
    } finally {
      waits.resolveAll();
      await fixture.tearDown();
    }
  });

  it('round-trips internal query and hash state through current-path', async function () {
    class App {
      public panelPath: string = '/items/42?tab=specs#notes';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="items/:id" exact>
          <span data-item>\${$params.id}:\${$query.get('tab')}:\${$hash}</span>
          <button
            data-update
            click.trigger="$route.load('/items/:id', { id: '42' }, { query: { tab: 'reviews' }, hash: 'comments' })">
            Update
          </button>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      assert.strictEqual(fixture.appHost.querySelector('[data-item]')?.textContent, '42:specs:notes');
      assert.strictEqual(fixture.component.panelPath, '/items/42?tab=specs#notes');

      click(fixture.appHost.querySelector('[data-update]') as HTMLElement);
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-item]')?.textContent, '42:reviews:comments');
      assert.strictEqual(fixture.component.panelPath, '/items/42?tab=reviews#comments');
    } finally {
      await fixture.tearDown();
    }
  });

  it('redirects inside au-router and writes the destination back to current-path', async function () {
    class App {
      public panelPath: string = '/';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="/" exact redirect-to="welcome"></au-route>
        <au-route path="welcome" exact><span data-welcome>Welcome</span></au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      assert.strictEqual(fixture.appHost.querySelector('[data-welcome]')?.textContent, 'Welcome');
      assert.strictEqual(fixture.component.panelPath, '/welcome');
    } finally {
      await fixture.tearDown();
    }
  });

  it('supports pathless groups inside au-router and preserves the shell while switching children', async function () {
    class App {
      public panelPath: string = '/orders';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route group>
          <label>Filter <input data-filter value="initial"></label>
          <au-route path="orders" exact><span data-orders>Orders</span></au-route>
          <au-route path="customers" exact><span data-customers>Customers</span></au-route>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      const filter = fixture.appHost.querySelector('[data-filter]') as HTMLInputElement;
      filter.value = 'mine';

      fixture.component.panelPath = '/customers';
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-customers]')?.textContent, 'Customers');
      assert.strictEqual(fixture.appHost.querySelector('[data-filter]'), filter);
      assert.strictEqual((fixture.appHost.querySelector('[data-filter]') as HTMLInputElement).value, 'mine');
      assert.strictEqual(fixture.component.panelPath, '/customers');
    } finally {
      await fixture.tearDown();
    }
  });

  it('resolves au-link, href, and active state against the nested router location', async function () {
    class App {
      public panelPath: string = '/items/42/overview';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="items/:id">
          <a data-overview au-link="overview">Overview</a>
          <a data-reviews au-link="reviews">Reviews</a>
          <a
            data-manual
            href.bind="$route.href('reviews')"
            class.bind="$route.isActive('reviews', {}, { exact: true }) ? 'is-active' : ''">
            Manual
          </a>

          <au-route path="overview" exact><span data-overview-view>Overview</span></au-route>
          <au-route path="reviews" exact><span data-reviews-view>Reviews</span></au-route>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      const manual = fixture.appHost.querySelector('[data-manual]') as HTMLAnchorElement;
      assert.strictEqual(manual.getAttribute('href'), '/items/42/reviews');
      assert.strictEqual(manual.classList.contains('is-active'), false);
      assert.strictEqual(fixture.appHost.querySelector('[data-overview-view]')?.textContent, 'Overview');

      click(fixture.appHost.querySelector('[data-reviews]') as HTMLElement);
      await settleRouter();

      assert.strictEqual(fixture.component.panelPath, '/items/42/reviews');
      assert.strictEqual(fixture.appHost.querySelector('[data-reviews-view]')?.textContent, 'Reviews');
      assert.strictEqual(fixture.appHost.querySelector('[data-overview-view]'), null);
      assert.strictEqual(manual.classList.contains('is-active'), true);
    } finally {
      await fixture.tearDown();
    }
  });

  it('keeps the requested current-path and rematches a fallback after local guard failure inside au-router', async function () {
    class App {
      public panelPath: string = '/portal/admin';
    }

    const fixture = await createFixture(
      `<au-router current-path.bind="panelPath">
        <au-route path="portal">
          <span data-portal>Portal</span>
          <au-route path="admin" exact can-load.bind="() => false" guard-failure="local">
            <span data-admin>Admin</span>
          </au-route>
          <au-route path="*" fallback>
            <span data-denied>Denied</span>
          </au-route>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      assert.strictEqual(fixture.component.panelPath, '/portal/admin');
      assert.strictEqual(fixture.appHost.querySelector('[data-portal]')?.textContent, 'Portal');
      assert.strictEqual(fixture.appHost.querySelector('[data-admin]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-denied]')?.textContent, 'Denied');
    } finally {
      await fixture.tearDown();
    }
  });

  it('reloads an active route inside au-router with replace and rerun parity', async function () {
    class App {
      public panelPath: string = '/posts/1';
      public calls: Array<{ phase: string; kind: string }> = [];
      public routerVm!: AuRouter;

      public loading(context: { kind: string }): void {
        this.calls.push({ phase: 'loading', kind: context.kind });
      }

      public loaded(context: { kind: string }): void {
        this.calls.push({ phase: 'loaded', kind: context.kind });
      }
    }

    const fixture = await createFixture(
      `<au-router component.ref="routerVm" current-path.bind="panelPath">
        <au-route
          path="posts/:id"
          exact
          transition-plan="replace"
          loading.bind="loading($lifecycle)"
          loaded.bind="loaded($lifecycle)">
          <span data-post>\${$params.id}</span>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      const route = fixture.component.routerVm._coordinator.root.children[0] as IRouteContext;
      const coordinator = fixture.component.routerVm._coordinator;
      fixture.component.calls.length = 0;
      const initialPost = fixture.appHost.querySelector('[data-post]');

      const replaceNavigationId = coordinator.navigation.id;
      await route.reload();
      await waitForNavigationIdle(coordinator, replaceNavigationId + 1);

      const replacedPost = fixture.appHost.querySelector('[data-post]');
      assert.deepStrictEqual(fixture.component.calls, [
        { phase: 'loading', kind: 'replace' },
        { phase: 'loaded', kind: 'replace' },
      ]);
      assert.notStrictEqual(replacedPost, initialPost);
      assert.strictEqual(fixture.component.panelPath, '/posts/1');

      fixture.component.calls.length = 0;
      const rerunNavigationId = coordinator.navigation.id;
      await route.reload({ plan: 'rerun' });
      await waitForNavigationIdle(coordinator, rerunNavigationId + 1);

      assert.deepStrictEqual(fixture.component.calls, [
        { phase: 'loading', kind: 'rerun' },
        { phase: 'loaded', kind: 'rerun' },
      ]);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), replacedPost);
      assert.strictEqual(fixture.component.panelPath, '/posts/1');
    } finally {
      await fixture.tearDown();
    }
  });

  it('recovers locally from route errors inside au-router and keeps current-path at the requested location', async function () {
    class App {
      public panelPath: string = '/portal/ready';
      public routerVm!: AuRouter;

      public fail(): never {
        throw new Error('Broken panel');
      }

      public recover(_failure: RouteFailure) {
        return { recover: 'local' } as const;
      }
    }

    const fixture = await createFixture(
      `<au-router component.ref="routerVm" current-path.bind="panelPath">
        <au-route path="portal">
          <span data-portal>Portal</span>
          <au-route path="ready" exact>
            <span data-ready>Ready</span>
          </au-route>
          <au-route path="broken" exact loading.bind="fail()" on-error.bind="failure => recover(failure)">
            <span data-broken>Broken</span>
          </au-route>
          <au-route path="*" fallback>
            <span data-recovered>Recovered</span>
          </au-route>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      const coordinator = fixture.component.routerVm._coordinator;
      await waitForNavigationIdle(coordinator);
      const navigationId = coordinator.navigation.id;
      fixture.component.panelPath = '/portal/broken';
      await waitForNavigationIdle(coordinator, navigationId + 1);

      assert.strictEqual(fixture.component.panelPath, '/portal/broken');
      assert.strictEqual(fixture.appHost.querySelector('[data-portal]')?.textContent, 'Portal');
      assert.strictEqual(fixture.appHost.querySelector('[data-ready]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-recovered]')?.textContent, 'Recovered');
    } finally {
      await fixture.tearDown();
    }
  });

  it('keeps outer route ownership separate from nested au-router state', async function () {
    class App {
      public panelPath: string = '/list';
    }

    const adapter = new MemoryPathAdapter('/workspace');
    const fixture = await createFixture(
      `<au-route path="workspace" exact>
        <span data-workspace>Workspace</span>
        <au-router current-path.bind="panelPath">
          <au-route path="list" exact><span data-list>List</span></au-route>
          <au-route path="detail/:id" exact><span data-detail>\${$params.id}</span></au-route>
        </au-router>
      </au-route>
      <au-route path="reports" exact><span data-reports>Reports</span></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      await settleRouter();
      assert.strictEqual(fixture.appHost.querySelector('[data-workspace]')?.textContent, 'Workspace');
      assert.strictEqual(fixture.appHost.querySelector('[data-list]')?.textContent, 'List');
      assert.strictEqual(adapter.getCurrentPath(), '/workspace');

      fixture.component.panelPath = '/detail/5';
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-detail]')?.textContent, '5');
      assert.strictEqual(fixture.component.panelPath, '/detail/5');
      assert.strictEqual(adapter.getCurrentPath(), '/workspace');

      const router = fixture.container.get(IRouteCoordinator);
      await router.load('/reports');
      await settleRouter();

      assert.strictEqual(fixture.appHost.querySelector('[data-reports]')?.textContent, 'Reports');
      assert.strictEqual(fixture.appHost.querySelector('[data-workspace]'), null);
      assert.strictEqual(adapter.getCurrentPath(), '/reports');
      assert.strictEqual(fixture.component.panelPath, '/detail/5');
    } finally {
      await fixture.tearDown();
    }
  });

  it('captures committed active branches from the router as a snapshot instead of a singular chain', async function () {
    class App {
      public panelPath: string = '/dashboard/reports';
      public routerVm!: AuRouter;
    }

    const fixture = await createFixture(
      `<au-router component.ref="routerVm" current-path.bind="panelPath">
        <au-route path="dashboard">
          <span data-dashboard>Dashboard</span>
          <au-route group>
            <span data-shell>Shell</span>
            <au-route path="reports" exact><span data-reports>Reports</span></au-route>
          </au-route>
          <au-route path="reports" exact><span data-summary>Summary</span></au-route>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      const router = fixture.component.routerVm._coordinator as IRouteCoordinator & {
        getActiveSnapshot?: () => ActiveRouteSnapshot;
      };
      assert.strictEqual(typeof router.getActiveSnapshot, 'function');

      const snapshot = router.getActiveSnapshot!();
      assert.strictEqual(snapshot.path, '/dashboard/reports');
      assert.deepStrictEqual(snapshot.matches.map(match => match.fullPath), [
        '/dashboard',
        '/dashboard',
        '/dashboard/reports',
        '/dashboard/reports',
      ]);
      assert.deepStrictEqual(snapshot.branches.routes.map(branch => branch.map(match => match.fullPath)), [
        ['/dashboard', '/dashboard', '/dashboard/reports'],
        ['/dashboard', '/dashboard/reports'],
      ]);
      assert.deepStrictEqual(snapshot.branches.paths, [
        ['/dashboard', '/dashboard', '/dashboard/reports'],
        ['/dashboard', '/dashboard/reports'],
      ]);
      assert.deepStrictEqual(snapshot.branches.uniquePaths, [
        '/dashboard',
        '/dashboard/reports',
      ]);
    } finally {
      await fixture.tearDown();
    }
  });

  it('captures a route-context subtree snapshot rooted at that context', async function () {
    class App {
      public panelPath: string = '/workspace/details/42';
      public routerVm!: AuRouter;
    }

    const fixture = await createFixture(
      `<au-router component.ref="routerVm" current-path.bind="panelPath">
        <au-route path="workspace">
          <span data-workspace>Workspace</span>
          <au-route path="details/:id" exact><span data-details>\${$params.id}</span></au-route>
          <au-route path="activity" exact><span data-activity>Activity</span></au-route>
        </au-route>
      </au-router>`,
      App,
      [Routing],
    ).started;

    try {
      await settleRouter();
      const workspace = fixture.component.routerVm._coordinator.root.children[0] as IRouteContext & {
        getActiveSnapshot?: () => ActiveRouteSnapshot;
      };
      assert.strictEqual(typeof workspace.getActiveSnapshot, 'function');

      const snapshot = workspace.getActiveSnapshot!();
      assert.strictEqual(snapshot.path, '/details/42');
      assert.deepStrictEqual(snapshot.matches.map(match => match.fullPath), [
        '/workspace',
        '/workspace/details/:id',
      ]);
      assert.deepStrictEqual(snapshot.branches.routes.map(branch => branch.map(match => match.fullPath)), [
        ['/workspace', '/workspace/details/:id'],
      ]);
      assert.deepStrictEqual(snapshot.branches.paths, [
        ['/workspace', '/workspace/details/:id'],
      ]);
      assert.deepStrictEqual(snapshot.branches.uniquePaths, [
        '/workspace',
        '/workspace/details/:id',
      ]);
      assert.deepStrictEqual({ ...snapshot.matches[snapshot.matches.length - 1].params }, { id: '42' });
    } finally {
      await fixture.tearDown();
    }
  });
});

interface ActiveRouteSnapshot {
  readonly path: string;
  readonly matches: readonly RouteSnapshot[];
  readonly branches: BranchesSnapshot;
}

interface BranchesSnapshot {
  readonly routes: readonly (readonly RouteSnapshot[])[];
  readonly paths: readonly (readonly string[])[];
  readonly uniquePaths: readonly string[];
}

interface RouteSnapshot {
  readonly id: string;
  readonly pattern: string;
  readonly fullPath: string;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: string;
  readonly hash: string;
  readonly title: string | null;
}

function click(element: HTMLElement): void {
  const window = element.ownerDocument.defaultView!;
  element.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  }));
}

function createWaits(): {
  wait(name: string): Promise<void>;
  whenRequested(name: string): Promise<void>;
  resolve(name: string): void;
  resolveAll(): void;
} {
  const pending = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  const requested = new Set<string>();
  const waitingForRequest = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  return {
    wait(name: string): Promise<void> {
      requested.add(name);
      const waiter = waitingForRequest.get(name);
      if (waiter != null) {
        waitingForRequest.delete(name);
        waiter.resolve();
      }
      let entry = pending.get(name);
      if (entry == null) {
        let resolve!: () => void;
        const promise = new Promise<void>(r => { resolve = r; });
        entry = { promise, resolve };
        pending.set(name, entry);
      }
      return entry.promise;
    },
    whenRequested(name: string): Promise<void> {
      if (requested.has(name)) {
        return Promise.resolve();
      }
      let entry = waitingForRequest.get(name);
      if (entry == null) {
        let resolve!: () => void;
        const promise = new Promise<void>(r => { resolve = r; });
        entry = { promise, resolve };
        waitingForRequest.set(name, entry);
      }
      return entry.promise;
    },
    resolve(name: string): void {
      const entry = pending.get(name);
      if (entry == null) {
        return;
      }
      requested.delete(name);
      pending.delete(name);
      entry.resolve();
    },
    resolveAll(): void {
      requested.clear();
      for (const entry of waitingForRequest.values()) {
        entry.resolve();
      }
      waitingForRequest.clear();
      for (const name of [...pending.keys()]) {
        this.resolve(name);
      }
    },
  };
}

async function settleRouter(): Promise<void> {
  await tasksSettled();
  await Promise.resolve();
  await tasksSettled();
}

async function waitForNavigationIdle(coordinator: IRouteCoordinator, minimumNavigationId: number = coordinator.navigation.id): Promise<void> {
  await settleRouter();
  if (coordinator.navigation.id >= minimumNavigationId && !coordinator.navigation.pending) {
    return;
  }
  await new Promise<void>(resolve => {
    const dispose = coordinator.subscribeNavigation(state => {
      if (state.id >= minimumNavigationId && !state.pending) {
        dispose();
        resolve();
      }
    });
  });
  await settleRouter();
}
