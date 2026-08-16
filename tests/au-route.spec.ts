import { IPlatform } from '@aurelia/kernel';
import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import { Routing } from '../router/configuration';
import { IRouteCoordinator } from '../router/coordinator';
import { BrowserHashAdapter, BrowserPathAdapter, BrowserQueryAdapter } from '../router/browser-path-adapter';

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

describe('au-route terminal path capture', function () {
  it('exposes the segment consumed by ** without the static prefix', async function () {
    const fixture = await createFixture(
      `<au-route path="/files/**">
        <span data-terminal>\${$params['**']}</span>
        <span data-residue>\${$route.residue}</span>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/files/guides/router/start.html');
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-terminal]')?.textContent, 'guides/router/start.html');
      assert.strictEqual(fixture.appHost.querySelector('[data-residue]')?.textContent, '/');
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('route URL state', function () {
  it('exposes query and hash state without changing pathname matching', async function () {
    const fixture = await createFixture(
      `<au-route path="/products" exact>
        <span data-query>\${$query.get('sort')}</span>
        <span data-tags>\${$route.$query.getAll('tag').join('|')}</span>
        <span data-hash>\${$hash}</span>
        <a data-location-link href.bind="$route.href($route, {}, { query: { sort: 'rating' }, hash: 'details' })">Rating details</a>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products?sort=price&tag=cold&tag=sale#reviews');
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-query]')?.textContent, 'price');
      assert.strictEqual(fixture.appHost.querySelector('[data-tags]')?.textContent, 'cold|sale');
      assert.strictEqual(fixture.appHost.querySelector('[data-hash]')?.textContent, 'reviews');
      assert.strictEqual(
        fixture.appHost.querySelector('[data-location-link]')?.getAttribute('href'),
        '/products?sort=rating#details',
      );

      router.load('/products?sort=rating#details');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-query]')?.textContent, 'rating');
      assert.strictEqual(fixture.appHost.querySelector('[data-hash]')?.textContent, 'details');
    } finally {
      await fixture.tearDown();
    }
  });

  it('formats and reads pathname, hash, and query-key route URLs', function () {
    const pathWindow = { location: { href: 'https://abc.com/products/ice-cream/reviews?sort=recent#comments' } } as Window;
    const hashWindow = { location: { href: 'https://abc.com/#products/ice-cream/reviews?sort=recent#comments' } } as Window;
    const queryWindow = { location: { href: 'https://abc.com/?app=products/ice-cream/reviews&sort=recent#comments' } } as Window;

    const path = new BrowserPathAdapter(pathWindow);
    const hash = new BrowserHashAdapter(hashWindow);
    const query = new BrowserQueryAdapter(queryWindow, { routeQueryKey: 'app' });

    assert.strictEqual(path.getCurrentPath(), '/products/ice-cream/reviews?sort=recent#comments');
    assert.strictEqual(hash.getCurrentPath(), '/products/ice-cream/reviews?sort=recent#comments');
    assert.strictEqual(query.getCurrentPath(), '/products/ice-cream/reviews?sort=recent#comments');
    assert.strictEqual(hash.formatHref('/products/ice-cream/reviews'), '#products/ice-cream/reviews');
    assert.strictEqual(query.formatHref('/products/ice-cream/reviews'), '?app=products/ice-cream/reviews');
  });
});

describe('active route links', function () {
  it('updates prefix, exact, query, hash, and aria-current bindings after navigation', async function () {
    const fixture = await createFixture(
      `<au-route path="/products/:productId">
        <au-route path="/reviews"><span data-reviews>Reviews</span></au-route>
        <au-route path="/specs"><span data-specs>Specs</span></au-route>
        <nav>
          <a data-parent class.bind="$route.isActive($route) ? 'is-active' : ''">Product</a>
          <a data-reviews-link
            class.bind="$route.isActive('/reviews', {}, { exact: true }) ? 'is-active' : ''"
            aria-current.bind="$route.isActive('/reviews', {}, { exact: true }) ? 'page' : null">Reviews</a>
          <a data-query-link class.bind="$route.isActive('/reviews', {}, {
            query: { sort: 'recent' },
            matchQuery: true
          }) ? 'is-active' : ''">Recent</a>
          <a data-hash-link class.bind="$route.isActive('/reviews', {}, {
            hash: 'comments',
            matchHash: true
          }) ? 'is-active' : ''">Comments</a>
        </nav>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products/ice-cream/reviews?sort=recent#comments');
      await tasksSettled();

      const parent = fixture.appHost.querySelector('[data-parent]')!;
      const reviews = fixture.appHost.querySelector('[data-reviews-link]')!;
      const query = fixture.appHost.querySelector('[data-query-link]')!;
      const hash = fixture.appHost.querySelector('[data-hash-link]')!;
      assert.strictEqual(parent.classList.contains('is-active'), true);
      assert.strictEqual(reviews.classList.contains('is-active'), true);
      assert.strictEqual(reviews.getAttribute('aria-current'), 'page');
      assert.strictEqual(query.classList.contains('is-active'), true);
      assert.strictEqual(hash.classList.contains('is-active'), true);

      router.load('/products/ice-cream/specs');
      await tasksSettled();
      assert.strictEqual(parent.classList.contains('is-active'), true);
      assert.strictEqual(reviews.classList.contains('is-active'), false);
      assert.strictEqual(reviews.hasAttribute('aria-current'), false);
      assert.strictEqual(query.classList.contains('is-active'), false);
      assert.strictEqual(hash.classList.contains('is-active'), false);
    } finally {
      await fixture.tearDown();
    }
  });
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
