import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import { Routing } from '../router/configuration';

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
});

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
