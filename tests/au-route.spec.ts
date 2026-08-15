import { IPlatform } from '@aurelia/kernel';
import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import { Routing } from '../router/configuration';
import { IRouteCoordinator } from '../router/coordinator';

describe('au-route dynamic path binding', function () {
  for (const syntax of [
    'path.bind="routePath"',
    'path.to-view="routePath"',
    ':path="routePath"',
  ]) {
    it(`updates an existing route using ${syntax}`, async function () {
      class App {
        public routePath: string = '/first';
      }

      const fixture = await createFixture(
        `<au-route ${syntax}><span data-route>Dynamic route</span></au-route>`,
        App,
        [Routing],
      ).started;

      try {
        const router = fixture.container.get(IRouteCoordinator);
        router.load('/first');
        await tasksSettled();
        assert.strictEqual(fixture.appHost.querySelector('[data-route]')?.textContent, 'Dynamic route');

        fixture.component.routePath = '/second';
        await tasksSettled();
        assert.strictEqual(fixture.appHost.querySelector('[data-route]'), null);

        router.load('/second');
        await tasksSettled();
        assert.strictEqual(fixture.appHost.querySelector('[data-route]')?.textContent, 'Dynamic route');

        router.load('/first');
        await tasksSettled();
        assert.strictEqual(fixture.appHost.querySelector('[data-route]'), null);
      } finally {
        await fixture.tearDown();
      }
    });
  }

  it('generates nested links and exposes registered descendant paths in templates', async function () {
    const fixture = await createFixture(
      `<au-route path="/products/:productId">
        <au-route path="/reviews">
          <a data-link href.bind="$route.parent.href('/specs', $route.parent.$params)">Specs</a>
          <span data-paths>\${$route.parent.getPaths(false).join('|')}</span>
        </au-route>
        <au-route path="/specs"><span data-specs>Specs route</span></au-route>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products/aster-pack/reviews');
      await tasksSettled();

      assert.strictEqual(
        fixture.appHost.querySelector('[data-link]')?.getAttribute('href'),
        '/products/aster-pack/specs',
      );
      assert.strictEqual(
        fixture.appHost.querySelector('[data-paths]')?.textContent?.trim(),
        '/products/:productId/reviews|/products/:productId/specs',
      );

      router.load('/products/beacon/reviews');
      await tasksSettled();
      assert.strictEqual(
        fixture.appHost.querySelector('[data-link]')?.getAttribute('href'),
        '/products/beacon/specs',
      );
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('au-route index path aliases', function () {
  for (const pattern of ['.', './']) {
    it(`renders ${pattern} at the current parent path only`, async function () {
      const fixture = await createFixture(
        `<au-route path="/products">
          <au-route path="${pattern}">
            <span data-index>Products index</span>
            <a data-index-link href.bind="$route.href('${pattern}')">Products index link</a>
          </au-route>
        </au-route>`,
        class App {},
        [Routing],
      ).started;

      try {
        const router = fixture.container.get(IRouteCoordinator);
        router.load('/products');
        await tasksSettled();
        assert.strictEqual(fixture.appHost.querySelector('[data-index]')?.textContent, 'Products index');
        assert.strictEqual(
          fixture.appHost.querySelector('[data-index-link]')?.getAttribute('href'),
          '/products',
        );

        router.load('/products/details');
        await tasksSettled();
        assert.strictEqual(fixture.appHost.querySelector('[data-index]'), null);
      } finally {
        await fixture.tearDown();
      }
    });
  }
});

describe('au-route animation scheduling', function () {
  it('uses the injected platform frame callback and runtime task scheduler', async function () {
    assert.strictEqual(globalThis.requestAnimationFrame, undefined);
    const fixture = await createFixture(
      '<au-route path="/animated" animate><span data-animated>Animated route</span></au-route>',
      class App {},
      [Routing.customize({ animations: { fallbackMs: 1 } })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/animated');
      await tasksSettled();

      const element = fixture.appHost.querySelector<HTMLElement>('[data-animated]');
      assert.strictEqual(element?.textContent, 'Animated route');
      assert.strictEqual(element?.dataset.auRouteTransition, 'enter');

      const platform = fixture.container.get(IPlatform) as IPlatform & {
        requestAnimationFrame: typeof requestAnimationFrame;
      };
      await new Promise<void>(resolve => {
        platform.requestAnimationFrame(() => {
          platform.requestAnimationFrame(() => resolve());
        });
      });
      await tasksSettled();
      await Promise.resolve();
      assert.strictEqual(element?.dataset.auRouteTransition, undefined);
    } finally {
      await fixture.tearDown();
    }
  });
});
