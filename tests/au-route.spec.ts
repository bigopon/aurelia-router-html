import { IPlatform } from '@aurelia/kernel';
import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import { CustomElement } from '@aurelia/runtime-html';
import { Routing } from '../router/configuration';
import { IRouteCoordinator, RouteCoordinator, type RouteNavigationState } from '../router/coordinator';
import { BrowserHashAdapter, BrowserPathAdapter, BrowserQueryAdapter } from '../router/browser-path-adapter';
import { MemoryPathAdapter } from '../router/memory-path-adapter';
import { RouteContext, type IRouteContext } from '../router/route-context';
import type { RouteFailure } from '../router/error';
import type { RouteLifecycleContext } from '../router/lifecycle';

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
          <a data-link href.bind="$route.parent.href('./specs', $route.parent.$params)">Specs</a>
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

describe('au-route relative path aliases', function () {
  it('matches product and ./product identically below a parent route', async function () {
    const fixture = await createFixture(
      `<au-route path="/shop">
        <au-route path="product"><span data-plain>Plain</span></au-route>
        <au-route path="./product"><span data-dotted>Dotted</span></au-route>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/shop/product');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-plain]')?.textContent, 'Plain');
      assert.strictEqual(fixture.appHost.querySelector('[data-dotted]')?.textContent, 'Dotted');
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('au-route optional parameters', function () {
  it('requires :id and allows :id? to omit its segment', async function () {
    const fixture = await createFixture(
      `<au-route path="products/:id" exact><span data-required>\${$params.id}</span></au-route>
      <au-route path="offers/:id?" exact><span data-optional>\${$params.id || 'none'}</span></au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-required]'), null);

      router.load('/products/camera');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-required]')?.textContent, 'camera');

      router.load('/offers');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-optional]')?.textContent, 'none');

      router.load('/offers/summer');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-optional]')?.textContent, 'summer');
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('au-route constrained parameters', function () {
  it('renders only the sibling whose segment constraint matches', async function () {
    const fixture = await createFixture(
      `<au-route path="/products/:id{{^\\d+$}}" exact>
        <span data-numeric>Numeric product \${$params.id}</span>
      </au-route>
      <au-route path="/products/:slug{{^[a-z-]+$}}" exact>
        <span data-slug>Named product \${$params.slug}</span>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products/42');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-numeric]')?.textContent?.trim(), 'Numeric product 42');
      assert.strictEqual(fixture.appHost.querySelector('[data-slug]'), null);

      router.load('/products/ice-cream');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-numeric]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-slug]')?.textContent?.trim(), 'Named product ice-cream');

      router.load('/products/42-camera');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-numeric]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-slug]'), null);
    } finally {
      await fixture.tearDown();
    }
  });

  it('recompiles a constrained path.bind value when it changes', async function () {
    class App {
      public routePath: string = '/products/:value{{^\\d+$}}';
    }

    const fixture = await createFixture(
      `<au-route path.bind="routePath" exact>
        <span data-constrained>\${$params.value}</span>
      </au-route>`,
      App,
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products/42');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-constrained]')?.textContent, '42');

      fixture.component.routePath = '/products/:value{{^[a-z]+$}}';
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-constrained]'), null);

      router.load('/products/camera');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-constrained]')?.textContent, 'camera');
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('au-route terminal path capture', function () {
  it('rejects an au-link target containing multiple anonymous wildcards', function () {
    assert.throws(
      () => createFixture(
        '<a au-link.bind="link">Order errors</a>',
        class App {
          public link = {
            target: 'date/*/summary/*/errors',
            params: { '*': '2026-08-16', '*2': 'orders' },
          };
        },
        [Routing],
      ),
      /A route pattern can contain only one "\*" wildcard.*Use named parameters/,
    );
  });

  it('captures a single wildcard used between static path segments', async function () {
    const fixture = await createFixture(
      `<au-route path="/date/*/summary" exact>
        <span data-date-summary>\${$params['*']}</span>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/date/august%2016/summary');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-date-summary]')?.textContent, 'august 16');

      router.load('/date/august%2016/details');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-date-summary]'), null);
    } finally {
      await fixture.tearDown();
    }
  });

  it('generates an au-link from the same single-wildcard parameter used by matching', async function () {
    const fixture = await createFixture(
      `<a data-folder-link au-link.bind="folderLink">Folder</a>
      <au-route path="/folders/*" exact>
        <span data-folder>\${$params['*']}</span>
      </au-route>`,
      class App {
        public folderLink = {
          target: '/folders/*',
          params: { '*': 'guides/router' },
        };
      },
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const link = fixture.appHost.querySelector('[data-folder-link]');
      assert.strictEqual(link?.getAttribute('href'), '/folders/guides%2Frouter');

      router.load(link!.getAttribute('href')!);
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-folder]')?.textContent, 'guides/router');
    } finally {
      await fixture.tearDown();
    }
  });

  it('scopes nested single-wildcard captures to the route that consumed each segment', async function () {
    const fixture = await createFixture(
      `<au-route path="/teams/*">
        <span data-team>\${$params['*']}</span>
        <au-route path="members/*" exact>
          <span data-member>\${$params['*']}</span>
          <span data-parent-team>\${$route.parent.$params['*']}</span>
        </au-route>
      </au-route>`,
      class App {},
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/teams/core%20team/members/alice%20smith');
      await tasksSettled();

      assert.strictEqual(fixture.appHost.querySelector('[data-team]')?.textContent, 'core team');
      assert.strictEqual(fixture.appHost.querySelector('[data-member]')?.textContent, 'alice smith');
      assert.strictEqual(fixture.appHost.querySelector('[data-parent-team]')?.textContent, 'core team');
    } finally {
      await fixture.tearDown();
    }
  });

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
        <a data-inline-hash au-link="/products#details">Inline details</a>
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
      assert.strictEqual(
        fixture.appHost.querySelector('[data-inline-hash]')?.getAttribute('href'),
        '/products#details',
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
            class.bind="$route.isActive('./reviews', {}, { exact: true }) ? 'is-active' : ''"
            aria-current.bind="$route.isActive('./reviews', {}, { exact: true }) ? 'page' : null">Reviews</a>
          <a data-query-link class.bind="$route.isActive('reviews', {}, {
            query: { sort: 'recent' },
            matchQuery: true
          }) ? 'is-active' : ''">Recent</a>
          <a data-hash-link class.bind="$route.isActive('reviews', {}, {
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

describe('au-link', function () {
  it('loads through its route context with a custom adapter', async function () {
    const adapter = new MemoryPathAdapter('/dashboard');
    const fixture = await createFixture(
      `<nav>
        <a data-dashboard au-link="dashboard">Dashboard</a>
        <a data-reports au-link="reports">Reports</a>
      </nav>
      <au-route path="dashboard" exact><span data-view>Dashboard</span></au-route>
      <au-route path="reports" exact><span data-view>Reports</span></au-route>`,
      class App {},
      [Routing.customize({ adapter })],
    ).started;

    try {
      const reports = fixture.appHost.querySelector<HTMLElement>('[data-reports]')!;
      reports.click();
      await tasksSettled();

      assert.strictEqual(adapter.getCurrentPath(), '/reports');
      assert.strictEqual(fixture.appHost.querySelector('[data-view]')?.textContent, 'Reports');
      assert.strictEqual(reports.classList.contains('is-active'), true);
    } finally {
      await fixture.tearDown();
    }
  });

  it('generates relative and absolute hrefs and maintains active anchor state', async function () {
    const fixture = await createFixture(
      `<a data-early au-link="/help">Early help</a>
      <au-route path="/help"><span data-help>Help</span></au-route>
      <au-route path="/products/:productId">
        <nav>
          <a data-overview au-link="./overview">Overview</a>
          <a data-reviews au-link="reviews">Reviews</a>
          <a data-help-link au-link="/help">Help</a>
          <a data-concrete au-link="/products/coffee/reviews">Concrete coffee reviews</a>
          <a data-recent au-link.bind="recentLink">Recent</a>
          <a data-coffee au-link.bind="coffeeLink">Coffee reviews</a>
        </nav>
        <au-route path="overview"><span data-overview-view>Overview view</span></au-route>
        <au-route path="./reviews"><span data-reviews-view>Reviews view</span></au-route>
      </au-route>`,
      class App {
        public recentLink = {
          target: 'reviews',
          options: { query: { sort: 'recent' }, matchQuery: true },
          activeClass: 'selected',
        };
        public coffeeLink = {
          target: '/products/:productId/reviews',
          params: { productId: 'coffee' },
        };
      },
      [Routing],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products/ice-cream/overview');
      await tasksSettled();

      const overview = fixture.appHost.querySelector('[data-overview]')!;
      const early = fixture.appHost.querySelector('[data-early]')!;
      const reviews = fixture.appHost.querySelector('[data-reviews]')!;
      const help = fixture.appHost.querySelector('[data-help-link]')!;
      const concrete = fixture.appHost.querySelector('[data-concrete]')!;
      const recent = fixture.appHost.querySelector('[data-recent]')!;
      const coffee = fixture.appHost.querySelector('[data-coffee]')!;
      assert.strictEqual(overview.getAttribute('href'), '/products/ice-cream/overview');
      assert.strictEqual(early.getAttribute('href'), '/help');
      assert.strictEqual(reviews.getAttribute('href'), '/products/ice-cream/reviews');
      assert.strictEqual(help.getAttribute('href'), '/help');
      assert.strictEqual(concrete.getAttribute('href'), '/products/coffee/reviews');
      assert.strictEqual(recent.getAttribute('href'), '/products/ice-cream/reviews?sort=recent');
      assert.strictEqual(coffee.getAttribute('href'), '/products/coffee/reviews');
      assert.strictEqual(overview.classList.contains('is-active'), true);
      assert.strictEqual(overview.getAttribute('aria-current'), 'page');
      assert.strictEqual(reviews.classList.contains('is-active'), false);

      router.load('/products/ice-cream/reviews?sort=recent');
      await tasksSettled();
      assert.strictEqual(overview.classList.contains('is-active'), false);
      assert.strictEqual(overview.hasAttribute('aria-current'), false);
      assert.strictEqual(reviews.classList.contains('is-active'), true);
      assert.strictEqual(reviews.getAttribute('aria-current'), 'page');
      assert.strictEqual(recent.classList.contains('selected'), true);
      assert.strictEqual(coffee.classList.contains('is-active'), false);
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('au-route redirects', function () {
  it('redirects static parameterized, nested index, and fallback matches without rendering redirect content', async function () {
    const adapter = new MemoryPathAdapter('/legacy/42');
    const fixture = await createFixture(
      `<au-route path="legacy/:id" exact redirect-to="/products/:id">
        <span data-stale>Redirect content</span>
      </au-route>
      <au-route path="products/:id" exact><span data-product>Product \${$params.id}</span></au-route>
      <au-route path="account">
        <au-route path="/" exact redirect-to="profile"></au-route>
        <au-route path="profile" exact><span data-profile>Profile</span></au-route>
      </au-route>
      <au-route path="not-found" exact><span data-not-found>Not found</span></au-route>
      <au-route path="*" fallback redirect-to="/not-found"></au-route>`,
      class App {},
      [Routing.customize({ adapter })],
    ).started;

    try {
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/products/42');
      assert.strictEqual(adapter.back(), false);
      assert.strictEqual(fixture.appHost.querySelector('[data-product]')?.textContent, 'Product 42');
      assert.strictEqual(fixture.appHost.querySelector('[data-stale]'), null);

      const route = fixture.container.get(IRouteCoordinator);
      route.load('/account');
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/account/profile');
      assert.strictEqual(fixture.appHost.querySelector('[data-profile]')?.textContent, 'Profile');

      route.load('/missing');
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/not-found');
      assert.strictEqual(fixture.appHost.querySelector('[data-not-found]')?.textContent, 'Not found');
    } finally {
      await fixture.tearDown();
    }
  });

  it('follows a three-hop redirect chain while preserving parameters and one history entry', async function () {
    class RecordingAdapter extends MemoryPathAdapter {
      public readonly replaced: string[] = [];

      public override replace(path: string): void {
        this.replaced.push(path);
        super.replace(path);
      }
    }

    const adapter = new RecordingAdapter('/chain/42');
    const fixture = await createFixture(
      `<au-route path="chain/:id" exact redirect-to="renamed/:id"><span data-chain-one>One</span></au-route>
      <au-route path="renamed/:id" exact redirect-to="legacy/:id"><span data-chain-two>Two</span></au-route>
      <au-route path="legacy/:id" exact redirect-to="/products/:id"><span data-chain-three>Three</span></au-route>
      <au-route path="products/:id" exact><span data-product>Product \${$params.id}</span></au-route>`,
      class App {},
      [Routing.customize({ adapter })],
    ).started;

    try {
      await tasksSettled();
      assert.deepStrictEqual(adapter.replaced, ['/products/42']);
      assert.strictEqual(adapter.getCurrentPath(), '/products/42');
      assert.strictEqual(adapter.back(), false);
      assert.strictEqual(fixture.appHost.querySelector('[data-product]')?.textContent, 'Product 42');
      assert.strictEqual(fixture.appHost.querySelector('[data-chain-one]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-chain-two]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-chain-three]'), null);
    } finally {
      await fixture.tearDown();
    }
  });

  for (const syntax of [
    'redirect-to.bind="target"',
    'redirect-to.to-view="target"',
    ':redirect-to="target"',
  ]) {
    it(`binds a dynamic redirect using ${syntax}`, async function () {
      const adapter = new MemoryPathAdapter('/home');
      const fixture = await createFixture(
        `<au-route path="legacy/:id" exact ${syntax}></au-route>
        <au-route path="home" exact><span>Home</span></au-route>
        <au-route path="products/:id" exact><span>Product \${$params.id}</span></au-route>
        <au-route path="archive/:id" exact><span data-archive>Archive \${$params.id}</span></au-route>`,
        class App {
          public target = '/products/:id';
        },
        [Routing.customize({ adapter })],
      ).started;

      try {
        fixture.container.get(IRouteCoordinator).load('/legacy/7');
        await tasksSettled();
        assert.strictEqual(adapter.getCurrentPath(), '/products/7');

        fixture.container.get(IRouteCoordinator).load('/home');
        await tasksSettled();
        fixture.component.target = '/archive/:id';
        await tasksSettled();
        fixture.container.get(IRouteCoordinator).load('/legacy/7');
        await tasksSettled();
        assert.strictEqual(adapter.getCurrentPath(), '/archive/7');
        assert.strictEqual(fixture.appHost.querySelector('[data-archive]')?.textContent, 'Archive 7');
      } finally {
        await fixture.tearDown();
      }
    });
  }

  it('supports explicit push redirects', async function () {
    class RecordingAdapter extends MemoryPathAdapter {
      public readonly pushed: string[] = [];
      public readonly replaced: string[] = [];

      public override push(path: string): void {
        this.pushed.push(path);
        super.push(path);
      }

      public override replace(path: string): void {
        this.replaced.push(path);
        super.replace(path);
      }
    }

    const adapter = new RecordingAdapter('/offer');
    const fixture = await createFixture(
      `<au-route path="offer" exact redirect-to="/sale" redirect-mode="push"></au-route>
      <au-route path="sale" exact><span data-sale>Sale</span></au-route>`,
      class App {},
      [Routing.customize({ adapter })],
    ).started;

    try {
      await tasksSettled();
      assert.deepStrictEqual(adapter.pushed, ['/sale']);
      assert.deepStrictEqual(adapter.replaced, []);
      assert.strictEqual(fixture.appHost.querySelector('[data-sale]')?.textContent, 'Sale');
    } finally {
      await fixture.tearDown();
    }
  });

  it('rejects redirect loops with the visited location chain', function () {
    const adapter = new MemoryPathAdapter('/a');
    const root = new RouteContext(null, '*');
    const a = root.createChild('/a', { exact: true }) as RouteContext;
    const b = root.createChild('/b', { exact: true }) as RouteContext;
    const coordinator = new RouteCoordinator(root, adapter);
    a.subscribe(state => {
      if (state.active) root._redirect('/b', {}, true);
    });
    b.subscribe(state => {
      if (state.active) root._redirect('/a', {}, true);
    });

    assert.throws(() => coordinator.start(), /Redirect loop detected: \/a -> \/b -> \/a/);
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

describe('au-route template lifecycle', function () {
  it('exposes lifecycle results and route state without owning application caching', async function () {
    class App {
      public readonly loadingContexts: RouteLifecycleContext[] = [];
      public readonly loadedContexts: RouteLifecycleContext[] = [];

      public loading(context: RouteLifecycleContext): { id: string; previous: string | null } {
        this.loadingContexts.push(context);
        const previous = context.previousData.loading as { id: string } | undefined;
        return { id: context.params.id, previous: previous?.id ?? null };
      }

      public loaded(context: RouteLifecycleContext): string {
        this.loadedContexts.push(context);
        return `ready:${(context.route.data.loading as { id: string }).id}`;
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="idle" exact>Idle</au-route>
      <au-route
        path="ready/:id"
        exact
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-loading>\${$route.data.loading.id}:\${$route.data.loading.previous}</span>
        <span data-loaded>\${$route.data.loaded}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      await fixture.container.get(IRouteCoordinator).load('/ready/first');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-loading]')?.textContent, 'first:');
      assert.strictEqual(fixture.appHost.querySelector('[data-loaded]')?.textContent, 'ready:first');
      assert.strictEqual(fixture.component.loadingContexts[0].route.$path, '/ready/first');
      assert.strictEqual(fixture.component.loadingContexts[0].signal.aborted, false);
      assert.strictEqual(fixture.component.loadedContexts[0], fixture.component.loadingContexts[0]);
      assert.strictEqual(fixture.component.loadedContexts[0].previousData.loading, undefined);
      assert.strictEqual(fixture.component.loadedContexts[0].previousData.loaded, undefined);

      await fixture.container.get(IRouteCoordinator).load('/idle');
      await fixture.container.get(IRouteCoordinator).load('/ready/second');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-loading]')?.textContent, 'second:first');
      assert.strictEqual(fixture.appHost.querySelector('[data-loaded]')?.textContent, 'ready:second');
      assert.strictEqual((fixture.component.loadingContexts[1].previousData.loading as { id: string }).id, 'first');
      assert.strictEqual(fixture.component.loadedContexts[1], fixture.component.loadingContexts[1]);
      assert.strictEqual((fixture.component.loadedContexts[1].previousData.loading as { id: string }).id, 'first');
      assert.strictEqual(fixture.component.loadedContexts[1].previousData.loaded, 'ready:first');
    } finally {
      await fixture.tearDown();
    }
  });

  it('restores lifecycle data when a newer navigation cancels the route activation', async function () {
    let finishSecondLoad!: () => void;
    const secondLoad = new Promise<void>(resolve => { finishSecondLoad = resolve; });
    let route: RouteLifecycleContext['route'];

    class App {
      public loading(context: RouteLifecycleContext): { id: string } | Promise<{ id: string }> {
        route = context.route;
        return context.params.id === 'second'
          ? secondLoad.then(() => ({ id: 'second' }))
          : { id: context.params.id };
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="idle" exact>Idle</au-route>
      <au-route path="ready/:id" exact loading.bind="loading($lifecycle)">
        <span>\${$route.data.loading.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      await router.load('/ready/first');
      await router.load('/idle');

      const second = router.load('/ready/second');
      await Promise.resolve();
      const idle = router.load('/idle');
      finishSecondLoad();
      await second;
      await idle;

      assert.strictEqual((route!.data.loading as { id: string }).id, 'first');
    } finally {
      finishSecondLoad();
      await fixture.tearDown();
    }
  });

  it('awaits loading and loaded callbacks bound to the application context', async function () {
    const events: string[] = [];
    let finishLoading!: () => void;
    let finishLoaded!: () => void;
    const loading = new Promise<void>(resolve => { finishLoading = resolve; });
    const loaded = new Promise<void>(resolve => { finishLoaded = resolve; });

    class App {
      public loading(): Promise<void> {
        events.push('loading');
        return loading;
      }

      public loaded(): Promise<void> {
        events.push('loaded');
        return loaded;
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route
        path="ready"
        exact
        loading.bind="loading()"
        loaded.bind="loaded()">
        <span data-ready>Ready</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      fixture.container.get(IRouteCoordinator).load('/ready');
      assert.deepStrictEqual(events, ['loading']);
      assert.strictEqual(fixture.appHost.querySelector('[data-ready]'), null);

      finishLoading();
      for (let index = 0; index < 10 && events.length < 2; index++) {
        await Promise.resolve();
      }
      assert.deepStrictEqual(events, ['loading', 'loaded']);
      assert.strictEqual(fixture.appHost.querySelector('[data-ready]')?.textContent, 'Ready');

      finishLoaded();
      await tasksSettled();
      assert.deepStrictEqual(events, ['loading', 'loaded']);
    } finally {
      finishLoading();
      finishLoaded();
      await fixture.tearDown();
    }
  });

  it('evaluates a lifecycle expression only when its route activates', async function () {
    class App {
      public calls: number = 0;

      public load(): number {
        this.calls++;
        return 42;
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="idle" exact>Idle</au-route>
      <au-route path="ready" exact loading.bind="load()"><span data-result>\${$route.data.loading}</span></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      assert.strictEqual(fixture.component.calls, 0);
      await fixture.container.get(IRouteCoordinator).load('/ready');
      assert.strictEqual(fixture.component.calls, 1);
      assert.strictEqual(fixture.appHost.querySelector('[data-result]')?.textContent, '42');
    } finally {
      await fixture.tearDown();
    }
  });

  it('evaluates a lifecycle expression in the scope containing its au-route', async function () {
    class App {
      public readonly items = [{ id: 'first' }, { id: 'second' }];

      public load(id: string): string {
        return `loaded:${id}`;
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="idle" exact>Idle</au-route>
      <template repeat.for="item of items">
        <au-route path.bind="item.id" exact loading.bind="load(item.id)">
          <span data-result>\${$route.data.loading}</span>
        </au-route>
      </template>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      await fixture.container.get(IRouteCoordinator).load('/second');
      assert.strictEqual(fixture.appHost.querySelector('[data-result]')?.textContent, 'loaded:second');
    } finally {
      await fixture.tearDown();
    }
  });

  it('exposes the owning route context to a nested lifecycle expression', async function () {
    class App {
      public readonly items = [{ id: 'first' }, { id: 'second' }];

      public load(route: IRouteContext, id: string): string {
        return `${route.fullPath}:${id}`;
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="idle" exact>Idle</au-route>
      <au-route path="parent">
        <template repeat.for="item of items">
          <au-route path.bind="item.id" exact loading.bind="load($route, item.id)">
            <span data-result>\${$route.data.loading}</span>
          </au-route>
        </template>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      await fixture.container.get(IRouteCoordinator).load('/parent/second');
      assert.strictEqual(fixture.appHost.querySelector('[data-result]')?.textContent, '/parent/second:second');
    } finally {
      await fixture.tearDown();
    }
  });

  it('clears the phase-local lifecycle value without falling through to an outer scope', async function () {
    class App {
      public readonly $lifecycle = 'outer value';
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="idle" exact>Idle</au-route>
      <au-route path="ready" exact loading.bind="() => $lifecycle">Ready</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      await fixture.container.get(IRouteCoordinator).load('/ready');
      const route = fixture.container.get(IRouteCoordinator).root.children.find(child => child.fullPath === '/ready')!;
      assert.strictEqual((route.data.loading as () => unknown)(), undefined);
    } finally {
      await fixture.tearDown();
    }
  });

  it('runs nested loading parent-first and loaded children-first', async function () {
    const events: string[] = [];
    class App {
      public record(event: string): void {
        events.push(event);
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="parent" loading.bind="record('parent loading')" loaded.bind="record('parent loaded')">
        <au-route path="child" exact loading.bind="record('child loading')" loaded.bind="record('child loaded')">
          <span data-child>Child</span>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      fixture.container.get(IRouteCoordinator).load('/parent/child');
      await tasksSettled();
      assert.deepStrictEqual(events, [
        'parent loading',
        'child loading',
        'child loaded',
        'parent loaded',
      ]);
    } finally {
      await fixture.tearDown();
    }
  });

  it('preserves loading and loaded ordering through three nested route levels', async function () {
    const events: string[] = [];
    class App {
      public record(event: string): void {
        events.push(event);
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="catalog" loading.bind="record('catalog loading')" loaded.bind="record('catalog loaded')">
        <au-route path="products" loading.bind="record('products loading')" loaded.bind="record('products loaded')">
          <au-route path=":id" exact loading.bind="record('product loading')" loaded.bind="record('product loaded')">
            <span data-product>\${$params.id}</span>
          </au-route>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      fixture.container.get(IRouteCoordinator).load('/catalog/products/camera');
      await tasksSettled();
      assert.deepStrictEqual(events, [
        'catalog loading',
        'products loading',
        'product loading',
        'product loaded',
        'products loaded',
        'catalog loaded',
      ]);
      assert.strictEqual(fixture.appHost.querySelector('[data-product]')?.textContent, 'camera');
    } finally {
      await fixture.tearDown();
    }
  });

  it('waits for a grandchild loaded callback before notifying its ancestors', async function () {
    const events: string[] = [];
    let finishProductLoaded!: () => void;
    const productLoaded = new Promise<void>(resolve => { finishProductLoaded = resolve; });

    class App {
      public record(event: string): void {
        events.push(event);
      }

      public async recordProductLoaded(): Promise<void> {
        events.push('product loaded');
        await productLoaded;
      }
    }

    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="catalog" loading.bind="record('catalog loading')" loaded.bind="record('catalog loaded')">
        <au-route path="products" loading.bind="record('products loading')" loaded.bind="record('products loaded')">
          <au-route path=":id" exact loading.bind="record('product loading')" loaded.bind="recordProductLoaded()">
            <span data-product-ready>Ready</span>
          </au-route>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      fixture.container.get(IRouteCoordinator).load('/catalog/products/camera');
      for (let index = 0; index < 10 && !events.includes('product loaded'); index++) {
        await Promise.resolve();
      }
      assert.deepStrictEqual(events, [
        'catalog loading',
        'products loading',
        'product loading',
        'product loaded',
      ]);
      assert.strictEqual(fixture.appHost.querySelector('[data-product-ready]')?.textContent, 'Ready');

      finishProductLoaded();
      for (let index = 0; index < 10 && !events.includes('catalog loaded'); index++) {
        await Promise.resolve();
        await tasksSettled();
      }
      assert.deepStrictEqual(events, [
        'catalog loading',
        'products loading',
        'product loading',
        'product loaded',
        'products loaded',
        'catalog loaded',
      ]);
    } finally {
      finishProductLoaded();
      await fixture.tearDown();
    }
  });

  it('waits for an async child attaching lifecycle before deactivating its view', async function () {
    const events: string[] = [];
    let finishAttaching!: () => void;
    const attaching = new Promise<void>(resolve => {
      finishAttaching = resolve;
    });

    class AsyncContent {
      public attaching(): Promise<void> {
        events.push('attaching');
        return attaching;
      }

      public attached(): void {
        events.push('attached');
      }

      public detaching(): void {
        events.push('detaching');
      }
    }

    const AsyncContentElement = CustomElement.define({
      name: 'async-content',
      template: '<span data-async-content>Async content</span>',
    }, AsyncContent);
    const fixture = await createFixture(
      '<au-route path="/async"><async-content></async-content></au-route>',
      class App {},
      [Routing, AsyncContentElement],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/async');
      assert.deepStrictEqual(events, ['attaching']);

      router.load('/other');
      await Promise.resolve();
      assert.deepStrictEqual(events, ['attaching']);

      finishAttaching();
      await tasksSettled();
      for (let i = 0; i < 10 && !events.includes('detaching'); i++) {
        await Promise.resolve();
      }
      assert.deepStrictEqual(events, ['attaching', 'attached', 'detaching']);
      assert.strictEqual(fixture.appHost.querySelector('[data-async-content]'), null);
    } finally {
      finishAttaching();
      await fixture.tearDown();
    }
  });

  it('keeps a newer navigation pending until stale async activation DOM is removed', async function () {
    const events: string[] = [];
    let finishAttaching!: () => void;
    const attaching = new Promise<void>(resolve => {
      finishAttaching = resolve;
    });

    class SlowActivationContent {
      public attaching(): Promise<void> {
        events.push('attaching');
        return attaching;
      }

      public attached(): void {
        events.push('attached');
      }

      public detaching(): void {
        events.push('detaching');
      }
    }

    const SlowActivationContentElement = CustomElement.define({
      name: 'slow-activation-content',
      template: '<span data-slow-activation>Slow activation</span>',
    }, SlowActivationContent);
    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><span data-home>Home</span></au-route>
      <au-route path="slow" exact><slow-activation-content></slow-activation-content></au-route>
      <au-route path="next" exact><span data-next>Next</span></au-route>`,
      class App {},
      [Routing.customize({ adapter }), SlowActivationContentElement],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const stale = router.load('/slow');
      assert.strictEqual(stale instanceof Promise, true);
      assert.deepStrictEqual(events, ['attaching']);

      const next = router.load('/next');
      assert.strictEqual(next instanceof Promise, true);
      assert.strictEqual(await stale, false);

      let nextSettled = false;
      void Promise.resolve(next).then(() => { nextSettled = true; });
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(nextSettled, false);
      assert.strictEqual(router.currentLocation.pathname, '/home');
      assert.strictEqual(adapter.getCurrentPath(), '/home');

      finishAttaching();
      assert.strictEqual(await next, true);
      await tasksSettled();

      assert.deepStrictEqual(events, ['attaching', 'attached', 'detaching']);
      assert.strictEqual(fixture.appHost.querySelector('[data-slow-activation]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-next]')?.textContent, 'Next');
      assert.strictEqual(router.currentLocation.pathname, '/next');
      assert.strictEqual(adapter.getCurrentPath(), '/next');
    } finally {
      finishAttaching();
      await fixture.tearDown();
    }
  });
});

describe('au-route same-declaration transitions', function () {
  type LifecycleCall = {
    readonly phase: 'can-load' | 'loading' | 'loaded';
    readonly context: RouteLifecycleContext;
  };

  function assertLifecycleContext(
    context: RouteLifecycleContext,
    kind: RouteLifecycleContext['kind'],
    fromId: string | null,
    toId: string,
    changes: RouteLifecycleContext['changes'],
  ): void {
    assert.strictEqual(context.kind, kind);
    assert.strictEqual(context.from?.params.id ?? null, fromId);
    assert.strictEqual(context.to.params.id, toId);
    assert.strictEqual(context.params.id, toId);
    assert.deepStrictEqual(context.changes, changes);
    assert.strictEqual(context.signal.aborted, false);
  }

  function assertSharedFrozenContext(calls: readonly LifecycleCall[]): void {
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[1].context, calls[0].context);
    assert.strictEqual(calls[2].context, calls[0].context);
    assert.strictEqual(Object.isFrozen(calls[0].context), true);
    assert.strictEqual(Object.isFrozen(calls[0].context.to), true);
    assert.strictEqual(Object.isFrozen(calls[0].context.changes), true);
    if (calls[0].context.from != null) {
      assert.strictEqual(Object.isFrozen(calls[0].context.from), true);
    }
  }

  it('reruns can-load, loading, and loaded in place for parameter changes by default', async function () {
    const calls: LifecycleCall[] = [];
    class App {
      public canLoad(context: RouteLifecycleContext): boolean {
        calls.push({ phase: 'can-load', context });
        return true;
      }

      public loading(context: RouteLifecycleContext): string {
        calls.push({ phase: 'loading', context });
        return `post:${context.params.id}`;
      }

      public loaded(context: RouteLifecycleContext): string {
        calls.push({ phase: 'loaded', context });
        return `ready:${context.params.id}`;
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1?preview=false#summary');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        can-load.bind="transition => canLoad(transition)"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const route = router.root.children[0];
      const post = fixture.appHost.querySelector('[data-post]');

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:enter',
        'loading:enter',
        'loaded:enter',
      ]);
      assertSharedFrozenContext(calls);
      for (const call of calls) {
        assertLifecycleContext(call.context, 'enter', null, '1', []);
      }

      calls.length = 0;
      const changed = router.load('/posts/2?preview=true#comments');
      assert.strictEqual(changed instanceof Promise ? await changed : changed, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:rerun',
        'loading:rerun',
        'loaded:rerun',
      ]);
      assertSharedFrozenContext(calls);
      for (const call of calls) {
        assertLifecycleContext(call.context, 'rerun', '1', '2', ['params', 'query', 'hash']);
        assert.strictEqual(call.context.from?.query.get('preview'), 'false');
        assert.strictEqual(call.context.to.query.get('preview'), 'true');
        assert.strictEqual(call.context.from?.hash, 'summary');
        assert.strictEqual(call.context.to.hash, 'comments');
        assert.strictEqual(call.context.previousData.loading, 'post:1');
        assert.strictEqual(call.context.previousData.loaded, 'ready:1');
      }
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 2');
      assert.strictEqual(route.data.loading, 'post:2');
      assert.strictEqual(route.data.loaded, 'ready:2');

      calls.length = 0;
      const queryOnly = router.load('/posts/2?preview=review#discussion');
      assert.strictEqual(queryOnly instanceof Promise ? await queryOnly : queryOnly, true);
      await tasksSettled();

      assert.deepStrictEqual(calls, []);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
    } finally {
      await fixture.tearDown();
    }
  });

  it('expands transition-on all to params, query, and hash', async function () {
    const contexts: RouteLifecycleContext[] = [];
    class App {
      public loading(context: RouteLifecycleContext): void {
        contexts.push(context);
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1?q=one#top');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        transition-on="all"
        loading.bind="loading($lifecycle)">
        <span data-post>Post \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const post = fixture.appHost.querySelector('[data-post]');
      contexts.length = 0;

      await router.load('/posts/1?q=two#top');
      assert.deepStrictEqual(contexts.map(context => context.changes), [['query']]);
      contexts.length = 0;

      await router.load('/posts/1?q=two#results');
      assert.deepStrictEqual(contexts.map(context => context.changes), [['hash']]);
      contexts.length = 0;

      await router.load('/posts/2?q=two#results');
      assert.deepStrictEqual(contexts.map(context => context.changes), [['params']]);
      assert.deepStrictEqual(contexts.map(context => context.kind), ['rerun']);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
    } finally {
      await fixture.tearDown();
    }
  });

  it('uses transition-on none for reactive URL state without lifecycle work', async function () {
    const contexts: RouteLifecycleContext[] = [];
    class App {
      public loading(context: RouteLifecycleContext): void {
        contexts.push(context);
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1?q=one#top');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        transition-on="none"
        loading.bind="loading($lifecycle)">
        <span data-post>\${$params.id}</span>
        <span data-query>\${$query.get('q')}</span>
        <span data-hash>\${$hash}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const post = fixture.appHost.querySelector('[data-post]');
      contexts.length = 0;

      await router.load('/posts/2?q=two#results');
      await tasksSettled();

      assert.deepStrictEqual(contexts, []);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
      assert.strictEqual(post?.textContent, '2');
      assert.strictEqual(fixture.appHost.querySelector('[data-query]')?.textContent, 'two');
      assert.strictEqual(fixture.appHost.querySelector('[data-hash]')?.textContent, 'results');
      assert.strictEqual(adapter.getCurrentPath(), '/posts/2?q=two#results');
    } finally {
      await fixture.tearDown();
    }
  });

  it('accepts comma-separated transition-on values', async function () {
    const contexts: RouteLifecycleContext[] = [];
    class App {
      public loading(context: RouteLifecycleContext): void {
        contexts.push(context);
      }
    }

    const adapter = new MemoryPathAdapter('/search?q=one#top');
    const fixture = await createFixture(
      `<au-route
        path="search"
        exact
        transition-on="query,hash"
        loading.bind="loading($lifecycle)">
        <span data-search>Search</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const search = fixture.appHost.querySelector('[data-search]');
      contexts.length = 0;

      await router.load('/search?q=two#results');
      await tasksSettled();

      assert.deepStrictEqual(contexts.map(context => context.kind), ['rerun']);
      assert.deepStrictEqual(contexts.map(context => context.changes), [['query', 'hash']]);
      assert.strictEqual(fixture.appHost.querySelector('[data-search]'), search);
    } finally {
      await fixture.tearDown();
    }
  });

  it('replaces the view and reports replace when transition-plan is replace', async function () {
    const calls: LifecycleCall[] = [];
    class App {
      public canLoad(context: RouteLifecycleContext): boolean {
        calls.push({ phase: 'can-load', context });
        return true;
      }

      public loading(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loading', context });
      }

      public loaded(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loaded', context });
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        transition-plan="replace"
        can-load.bind="transition => canLoad(transition)"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const firstPost = fixture.appHost.querySelector('[data-post]');
      calls.length = 0;

      const changed = router.load('/posts/2');
      assert.strictEqual(changed instanceof Promise ? await changed : changed, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:replace',
        'loading:replace',
        'loaded:replace',
      ]);
      for (const call of calls) {
        assertLifecycleContext(call.context, 'replace', '1', '2', ['params']);
      }
      const secondPost = fixture.appHost.querySelector('[data-post]');
      assert.notStrictEqual(secondPost, firstPost);
      assert.strictEqual(firstPost?.isConnected, false);
      assert.strictEqual(secondPost?.textContent, 'Post 2');
    } finally {
      await fixture.tearDown();
    }
  });

  it('uses the configured reload plan and accepts a one-attempt override', async function () {
    const calls: LifecycleCall[] = [];
    class App {
      public canLoad(context: RouteLifecycleContext): boolean {
        calls.push({ phase: 'can-load', context });
        return true;
      }

      public loading(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loading', context });
      }

      public loaded(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loaded', context });
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1?view=full#notes');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        transition-plan="replace"
        can-load.bind="transition => canLoad(transition)"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const route = fixture.container.get(IRouteCoordinator).root.children[0];
      const initialPost = fixture.appHost.querySelector('[data-post]');
      calls.length = 0;

      const configured = route.reload();
      assert.strictEqual(configured instanceof Promise ? await configured : configured, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:replace',
        'loading:replace',
        'loaded:replace',
      ]);
      assertSharedFrozenContext(calls);
      for (const call of calls) {
        assertLifecycleContext(call.context, 'replace', '1', '1', ['reload']);
        assert.strictEqual(call.context.query.get('view'), 'full');
        assert.strictEqual(call.context.hash, 'notes');
      }
      const replacedPost = fixture.appHost.querySelector('[data-post]');
      assert.notStrictEqual(replacedPost, initialPost);
      assert.strictEqual(adapter.getCurrentPath(), '/posts/1?view=full#notes');

      calls.length = 0;
      const overridden = route.reload({ plan: 'rerun' });
      assert.strictEqual(overridden instanceof Promise ? await overridden : overridden, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:rerun',
        'loading:rerun',
        'loaded:rerun',
      ]);
      assertSharedFrozenContext(calls);
      for (const call of calls) {
        assertLifecycleContext(call.context, 'rerun', '1', '1', ['reload']);
      }
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), replacedPost);
      assert.strictEqual(adapter.getCurrentPath(), '/posts/1?view=full#notes');

      calls.length = 0;
      const configuredAgain = route.reload();
      assert.strictEqual(configuredAgain instanceof Promise ? await configuredAgain : configuredAgain, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => call.context.kind), ['replace', 'replace', 'replace']);
      assert.notStrictEqual(fixture.appHost.querySelector('[data-post]'), replacedPost);
      assert.strictEqual(adapter.getCurrentPath(), '/posts/1?view=full#notes');
      assert.strictEqual(adapter.back(), false);
    } finally {
      await fixture.tearDown();
    }
  });

  it('reloads an active ancestor at the complete descendant location', async function () {
    const calls: LifecycleCall[] = [];
    class App {
      public loading(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loading', context });
      }

      public loaded(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loaded', context });
      }
    }

    const adapter = new MemoryPathAdapter('/projects/alpha/tasks/42?view=full#notes');
    const fixture = await createFixture(
      `<au-route
        path="projects/:projectId"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-project>Project \${$params.projectId}</span>
        <au-route path="tasks/:taskId" exact>
          <span data-task>Task \${$params.taskId}</span>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const projectRoute = router.root.children[0];
      const taskRoute = projectRoute.children[0];
      const project = fixture.appHost.querySelector('[data-project]');
      const task = fixture.appHost.querySelector('[data-task]');
      calls.length = 0;

      const reloaded = projectRoute.reload();
      assert.strictEqual(reloaded instanceof Promise ? await reloaded : reloaded, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'loading:rerun',
        'loaded:rerun',
      ]);
      assert.strictEqual(calls[1].context, calls[0].context);
      for (const { context } of calls) {
        assert.deepStrictEqual(context.changes, ['reload']);
        assert.strictEqual(context.from?.params.projectId, 'alpha');
        assert.strictEqual(context.to.params.projectId, 'alpha');
        assert.strictEqual(context.query.get('view'), 'full');
        assert.strictEqual(context.hash, 'notes');
      }
      assert.strictEqual(router.currentLocation.pathname, '/projects/alpha/tasks/42');
      assert.strictEqual(adapter.getCurrentPath(), '/projects/alpha/tasks/42?view=full#notes');
      assert.strictEqual(projectRoute.$params.projectId, 'alpha');
      assert.strictEqual(taskRoute.$params.taskId, '42');
      assert.strictEqual(fixture.appHost.querySelector('[data-project]'), project);
      assert.strictEqual(fixture.appHost.querySelector('[data-task]'), task);
      assert.strictEqual(adapter.back(), false);
    } finally {
      await fixture.tearDown();
    }
  });

  for (const testCase of [
    {
      attribute: 'transition-on="state"',
      expected: /Invalid au-route transition-on value "state"/,
    },
    {
      attribute: 'transition-plan="refresh"',
      expected: /Invalid au-route transition-plan value "refresh"/,
    },
    {
      attribute: 'transition-on="all state"',
      expected: /Invalid au-route transition-on value "state"/,
    },
    {
      attribute: 'transition-on="none state"',
      expected: /Invalid au-route transition-on value "state"/,
    },
    {
      attribute: 'transition-on="all params"',
      expected: /transition-on.*all.*alone/i,
    },
    {
      attribute: 'transition-on="none query"',
      expected: /transition-on.*none.*alone/i,
    },
  ]) {
    it(`rejects ${testCase.attribute}`, function () {
      assert.throws(
        () => createFixture(
          `<au-route path="posts/:id" ${testCase.attribute}>Post</au-route>`,
          class App {},
          [Routing],
        ),
        testCase.expected,
      );
    });
  }

  it('reruns for configured query and hash changes', async function () {
    const calls: LifecycleCall[] = [];
    class App {
      public canLoad(context: RouteLifecycleContext): boolean {
        calls.push({ phase: 'can-load', context });
        return true;
      }

      public loading(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loading', context });
      }

      public loaded(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loaded', context });
      }
    }

    const adapter = new MemoryPathAdapter('/search?q=one#top');
    const fixture = await createFixture(
      `<au-route
        path="search"
        exact
        transition-on="query hash"
        can-load.bind="transition => canLoad(transition)"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-search>Search</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const search = fixture.appHost.querySelector('[data-search]');
      calls.length = 0;

      const queryChanged = router.load('/search?q=two#top');
      assert.strictEqual(queryChanged instanceof Promise ? await queryChanged : queryChanged, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:rerun',
        'loading:rerun',
        'loaded:rerun',
      ]);
      for (const { context } of calls) {
        assert.strictEqual(context.kind, 'rerun');
        assert.strictEqual(context.from?.query.get('q'), 'one');
        assert.strictEqual(context.to.query.get('q'), 'two');
        assert.strictEqual(context.query.get('q'), 'two');
        assert.strictEqual(context.from?.hash, 'top');
        assert.strictEqual(context.to.hash, 'top');
        assert.deepStrictEqual(context.changes, ['query']);
      }
      assert.strictEqual(fixture.appHost.querySelector('[data-search]'), search);

      calls.length = 0;
      const hashChanged = router.load('/search?q=two#results');
      assert.strictEqual(hashChanged instanceof Promise ? await hashChanged : hashChanged, true);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), [
        'can-load:rerun',
        'loading:rerun',
        'loaded:rerun',
      ]);
      for (const { context } of calls) {
        assert.strictEqual(context.kind, 'rerun');
        assert.strictEqual(context.from?.query.get('q'), 'two');
        assert.strictEqual(context.to.query.get('q'), 'two');
        assert.strictEqual(context.from?.hash, 'top');
        assert.strictEqual(context.to.hash, 'results');
        assert.strictEqual(context.hash, 'results');
        assert.deepStrictEqual(context.changes, ['hash']);
      }
      assert.strictEqual(fixture.appHost.querySelector('[data-search]'), search);
    } finally {
      await fixture.tearDown();
    }
  });

  it('updates route values without lifecycle work when transition-plan is none', async function () {
    const calls: LifecycleCall[] = [];
    class App {
      public canLoad(context: RouteLifecycleContext): boolean {
        calls.push({ phase: 'can-load', context });
        return true;
      }

      public loading(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loading', context });
      }

      public loaded(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loaded', context });
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        transition-plan="none"
        can-load.bind="transition => canLoad(transition)"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const post = fixture.appHost.querySelector('[data-post]');
      assert.deepStrictEqual(calls.map(call => call.context.kind), ['enter', 'enter', 'enter']);
      calls.length = 0;

      const changed = router.load('/posts/2');
      assert.strictEqual(changed instanceof Promise ? await changed : changed, true);
      await tasksSettled();

      assert.deepStrictEqual(calls, []);
      assert.strictEqual(router.root.children[0].$params.id, '2');
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 2');
      assert.strictEqual(router.currentLocation.pathname, '/posts/2');
      assert.strictEqual(adapter.getCurrentPath(), '/posts/2');
    } finally {
      await fixture.tearDown();
    }
  });

  it('uses can-load to reject a rerun before loading or loaded executes', async function () {
    const calls: LifecycleCall[] = [];
    let allowed = true;
    let guardSawAborted = false;
    class App {
      public canLoad(context: RouteLifecycleContext): boolean {
        calls.push({ phase: 'can-load', context });
        guardSawAborted = context.signal.aborted;
        return allowed;
      }

      public loading(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loading', context });
      }

      public loaded(context: RouteLifecycleContext): void {
        calls.push({ phase: 'loaded', context });
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        can-load.bind="transition => canLoad(transition)"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const post = fixture.appHost.querySelector('[data-post]');
      calls.length = 0;
      allowed = false;

      const changed = router.load('/posts/2');
      assert.strictEqual(changed instanceof Promise ? await changed : changed, false);
      await tasksSettled();

      assert.deepStrictEqual(calls.map(call => `${call.phase}:${call.context.kind}`), ['can-load:rerun']);
      assert.strictEqual(guardSawAborted, false);
      assert.strictEqual(calls[0].context.kind, 'rerun');
      assert.strictEqual(calls[0].context.from?.params.id, '1');
      assert.strictEqual(calls[0].context.to.params.id, '2');
      assert.strictEqual(calls[0].context.params.id, '2');
      assert.deepStrictEqual(calls[0].context.changes, ['params']);
      assert.strictEqual(calls[0].context.signal.aborted, true);
      assert.strictEqual(router.root.children[0].$params.id, '1');
      assert.strictEqual(router.currentLocation.pathname, '/posts/1');
      assert.strictEqual(adapter.getCurrentPath(), '/posts/1');
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
    } finally {
      await fixture.tearDown();
    }
  });

  it('runs replacement can-unload deepest-first before candidate lifecycle work', async function () {
    const events: string[] = [];
    let allowParentUnload = false;
    class App {
      public canUnload(name: string): boolean {
        events.push(`${name} can-unload`);
        return name !== 'parent' || allowParentUnload;
      }

      public canLoad(name: string): boolean {
        events.push(`${name} can-load`);
        return true;
      }

      public loading(name: string): void {
        events.push(`${name} loading`);
      }
    }

    const adapter = new MemoryPathAdapter('/section/1/detail');
    const fixture = await createFixture(
      `<au-route
        path="section/:id"
        transition-plan="replace"
        can-unload.bind="() => canUnload('parent')"
        can-load.bind="() => canLoad('parent')"
        loading.bind="loading('parent')">
        <span data-parent>Section \${$params.id}</span>
        <au-route
          path="detail"
          exact
          can-unload.bind="() => canUnload('child')"
          can-load.bind="() => canLoad('child')"
          loading.bind="loading('child')">
          <span data-child>Detail</span>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const originalParent = fixture.appHost.querySelector('[data-parent]');
      const originalChild = fixture.appHost.querySelector('[data-child]');
      events.length = 0;

      const denied = router.load('/section/2/detail');
      assert.strictEqual(denied instanceof Promise ? await denied : denied, false);
      await tasksSettled();

      assert.deepStrictEqual(events, ['child can-unload', 'parent can-unload']);
      assert.strictEqual(router.currentLocation.pathname, '/section/1/detail');
      assert.strictEqual(adapter.getCurrentPath(), '/section/1/detail');
      assert.strictEqual(fixture.appHost.querySelector('[data-parent]'), originalParent);
      assert.strictEqual(fixture.appHost.querySelector('[data-child]'), originalChild);

      allowParentUnload = true;
      events.length = 0;
      const accepted = router.load('/section/2/detail');
      assert.strictEqual(accepted instanceof Promise ? await accepted : accepted, true);
      await tasksSettled();

      assert.deepStrictEqual(events, [
        'child can-unload',
        'parent can-unload',
        'parent can-load',
        'parent loading',
        'child can-load',
        'child loading',
      ]);
      assert.notStrictEqual(fixture.appHost.querySelector('[data-parent]'), originalParent);
      assert.notStrictEqual(fixture.appHost.querySelector('[data-child]'), originalChild);
      assert.strictEqual(router.currentLocation.pathname, '/section/2/detail');
      assert.strictEqual(adapter.getCurrentPath(), '/section/2/detail');
    } finally {
      await fixture.tearDown();
    }
  });

  for (const failurePhase of ['loading', 'activation', 'loaded'] as const) {
    it(`restores the prior view when replacement ${failurePhase} fails`, async function () {
      const failure = new Error(`replacement ${failurePhase} failed`);
      let activeFailure: typeof failurePhase | null = null;
      let instanceId = 0;
      class App {
        public loading(context: RouteLifecycleContext): string {
          if (context.kind === 'replace' && activeFailure === 'loading') {
            throw failure;
          }
          return `post:${context.params.id}`;
        }

        public loaded(context: RouteLifecycleContext): string {
          if (context.kind === 'replace' && activeFailure === 'loaded') {
            throw failure;
          }
          return `ready:${context.params.id}`;
        }
      }

      const Probe = CustomElement.define(
        { name: `replacement-${failurePhase}-probe`, template: 'Probe' },
        class {
          private readonly instance = ++instanceId;

          public attaching(): void {
            if (this.instance > 1 && activeFailure === 'activation') {
              throw failure;
            }
          }
        },
      );
      const adapter = new MemoryPathAdapter('/posts/1');
      const fixture = await createFixture(
        `<au-route
          path="posts/:id"
          exact
          transition-plan="replace"
          loading.bind="loading($lifecycle)"
          loaded.bind="loaded($lifecycle)">
          <span data-post>Post \${$params.id}</span>
          <replacement-${failurePhase}-probe></replacement-${failurePhase}-probe>
        </au-route>`,
        App,
        [Routing.customize({ adapter }), Probe],
      ).started;

      try {
        const router = fixture.container.get(IRouteCoordinator);
        const route = router.root.children[0];
        const originalPost = fixture.appHost.querySelector('[data-post]');
        assert.strictEqual(route.data.loading, 'post:1');
        assert.strictEqual(route.data.loaded, 'ready:1');
        activeFailure = failurePhase;

        let caught: unknown;
        try {
          await router.load('/posts/2');
        } catch (error) {
          caught = error;
        }
        assert.strictEqual(caught, failure);
        await tasksSettled();

        assert.strictEqual(router.currentLocation.pathname, '/posts/1');
        assert.strictEqual(adapter.getCurrentPath(), '/posts/1');
        assert.strictEqual(route.$params.id, '1');
        assert.strictEqual(route.data.loading, 'post:1');
        assert.strictEqual(route.data.loaded, 'ready:1');
        assert.strictEqual(fixture.appHost.querySelector('[data-post]'), originalPost);
        assert.strictEqual(originalPost?.isConnected, true);
        assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 1');
      } finally {
        activeFailure = null;
        await fixture.tearDown();
      }
    });
  }

  it('supersedes a pending rerun without publishing its late lifecycle result', async function () {
    let finishStale!: (value: string) => void;
    const staleLoading = new Promise<string>(resolve => { finishStale = resolve; });
    let staleContext: RouteLifecycleContext | null = null;
    class App {
      public loading(context: RouteLifecycleContext): string | Promise<string> {
        if (context.params.id === '2') {
          staleContext = context;
          return staleLoading;
        }
        return `post:${context.params.id}`;
      }

      public loaded(context: RouteLifecycleContext): string {
        return `ready:${context.params.id}`;
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const route = router.root.children[0];
      const post = fixture.appHost.querySelector('[data-post]');

      const stale = router.load('/posts/2');
      assert.strictEqual(stale instanceof Promise, true);
      for (let index = 0; index < 10 && staleContext == null; index++) {
        await Promise.resolve();
      }
      assert.notStrictEqual(staleContext, null);

      const latest = router.load('/posts/3');
      assert.strictEqual((staleContext as unknown as RouteLifecycleContext).signal.aborted, true);
      assert.strictEqual(await stale, false);
      assert.strictEqual(latest instanceof Promise ? await latest : latest, true);
      await tasksSettled();

      assert.strictEqual(route.$params.id, '3');
      assert.strictEqual(route.data.loading, 'post:3');
      assert.strictEqual(route.data.loaded, 'ready:3');
      assert.strictEqual(fixture.appHost.querySelector('[data-post]'), post);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 3');
      assert.strictEqual(adapter.getCurrentPath(), '/posts/3');

      finishStale('post:2');
      await Promise.resolve();
      await tasksSettled();
      assert.strictEqual(route.data.loading, 'post:3');
      assert.strictEqual(route.data.loaded, 'ready:3');
      assert.strictEqual(route.$params.id, '3');
    } finally {
      finishStale('post:2');
      await fixture.tearDown();
    }
  });

  it('clears rollback mode after superseding a never-settling replacement loaded callback', async function () {
    let finishStale!: (value: string) => void;
    const staleLoaded = new Promise<string>(resolve => { finishStale = resolve; });
    let signalStaleStarted!: () => void;
    const staleStarted = new Promise<void>(resolve => { signalStaleStarted = resolve; });
    let staleContext: RouteLifecycleContext | null = null;
    let staleNavigation: boolean | Promise<boolean> | null = null;
    let latestNavigation: boolean | Promise<boolean> | null = null;
    class App {
      public loading(context: RouteLifecycleContext): string {
        return `post:${context.params.id}`;
      }

      public loaded(context: RouteLifecycleContext): string | Promise<string> {
        if (context.kind === 'replace' && context.params.id === '2') {
          staleContext = context;
          signalStaleStarted();
          return staleLoaded;
        }
        return `ready:${context.params.id}`;
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        transition-plan="replace"
        loading.bind="loading($lifecycle)"
        loaded.bind="loaded($lifecycle)">
        <span data-post>Post \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator) as RouteCoordinator;
      staleNavigation = router.load('/posts/2');
      await staleStarted;
      assert.notStrictEqual(staleContext, null);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 2');

      latestNavigation = router.load('/posts/3');
      assert.strictEqual((staleContext as unknown as RouteLifecycleContext).signal.aborted, true);
      assert.strictEqual(staleNavigation instanceof Promise ? await staleNavigation : staleNavigation, false);
      assert.strictEqual(latestNavigation instanceof Promise ? await latestNavigation : latestNavigation, true);
      await tasksSettled();

      assert.strictEqual(router._isRollingBack, false);
      assert.strictEqual(router.currentLocation.pathname, '/posts/3');
      assert.strictEqual(adapter.getCurrentPath(), '/posts/3');
      assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 3');

      const later = router.load('/posts/4');
      assert.strictEqual(later instanceof Promise ? await later : later, true);
      await tasksSettled();
      assert.strictEqual(router._isRollingBack, false);
      assert.strictEqual(fixture.appHost.querySelector('[data-post]')?.textContent, 'Post 4');

      finishStale('ready:2');
      await tasksSettled();
      assert.strictEqual(router.root.children[0].data.loaded, 'ready:4');
    } finally {
      finishStale('ready:2');
      if (staleNavigation != null || latestNavigation != null) {
        await Promise.allSettled([
          Promise.resolve(staleNavigation),
          Promise.resolve(latestNavigation),
        ]);
      }
      await fixture.tearDown();
    }
  });

  it('does not let a never-settling replacement descendant block newer navigation', async function () {
    let finishDescendant!: () => void;
    const pendingDescendant = new Promise<void>(resolve => { finishDescendant = resolve; });
    let signalDescendantStarted!: () => void;
    const descendantStarted = new Promise<void>(resolve => { signalDescendantStarted = resolve; });
    let childEntries = 0;
    let staleContext: RouteLifecycleContext | null = null;
    let staleNavigation: boolean | Promise<boolean> | null = null;
    let latestNavigation: boolean | Promise<boolean> | null = null;
    class App {
      public childLoaded(context: RouteLifecycleContext): void | Promise<void> {
        childEntries++;
        if (childEntries === 2) {
          staleContext = context;
          signalDescendantStarted();
          return pendingDescendant;
        }
      }
    }

    const adapter = new MemoryPathAdapter('/section/1/detail');
    const fixture = await createFixture(
      `<au-route path="section/:id" transition-plan="replace">
        <span data-section>Section \${$params.id}</span>
        <au-route path="detail" exact loaded.bind="childLoaded($lifecycle)">
          <span data-detail>Detail</span>
        </au-route>
      </au-route>
      <au-route path="other" exact>
        <span data-other>Other</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator) as RouteCoordinator;
      staleNavigation = router.load('/section/2/detail');
      await descendantStarted;
      assert.notStrictEqual(staleContext, null);

      latestNavigation = router.load('/other');
      assert.strictEqual((staleContext as unknown as RouteLifecycleContext).signal.aborted, true);
      assert.strictEqual(staleNavigation instanceof Promise ? await staleNavigation : staleNavigation, false);
      assert.strictEqual(latestNavigation instanceof Promise ? await latestNavigation : latestNavigation, true);
      await tasksSettled();

      assert.strictEqual(router._isRollingBack, false);
      assert.strictEqual(router.currentLocation.pathname, '/other');
      assert.strictEqual(adapter.getCurrentPath(), '/other');
      assert.strictEqual(fixture.appHost.querySelector('[data-section]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-detail]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-other]')?.textContent, 'Other');
    } finally {
      finishDescendant();
      if (staleNavigation != null || latestNavigation != null) {
        await Promise.allSettled([
          Promise.resolve(staleNavigation),
          Promise.resolve(latestNavigation),
        ]);
      }
      await fixture.tearDown();
    }
  });

  it('continues sibling replacement rollback after one prior view fails to restore', async function () {
    const navigationFailure = new Error('bad sibling loaded failed');
    const rollbackFailure = new Error('bad sibling rollback failed');
    const events: string[] = [];
    let goodAttachments = 0;
    let badAttachments = 0;
    const GoodProbe = CustomElement.define(
      { name: 'good-sibling-rollback-probe', template: 'Good probe' },
      class {
        public attaching(): void {
          goodAttachments++;
          events.push(`good attaching:${goodAttachments}`);
        }
      },
    );
    const BadProbe = CustomElement.define(
      { name: 'bad-sibling-rollback-probe', template: 'Bad probe' },
      class {
        public attaching(): void {
          badAttachments++;
          events.push(`bad attaching:${badAttachments}`);
          if (badAttachments === 3) {
            throw rollbackFailure;
          }
        }
      },
    );
    class App {
      public loaded(name: string, context: RouteLifecycleContext): void {
        if (name === 'failure' && context.kind === 'rerun') {
          throw navigationFailure;
        }
      }
    }

    const adapter = new MemoryPathAdapter('/items/1');
    const fixture = await createFixture(
      `<au-route
        path="items/:id"
        exact
        transition-plan="replace">
        <span data-good>Good \${$params.id}</span>
        <good-sibling-rollback-probe></good-sibling-rollback-probe>
      </au-route>
      <au-route
        path="items/:id"
        exact
        transition-plan="replace">
        <span data-bad>Bad \${$params.id}</span>
        <bad-sibling-rollback-probe></bad-sibling-rollback-probe>
      </au-route>
      <au-route
        path="items/:id"
        exact
        loaded.bind="loaded('failure', $lifecycle)">
        <span data-failure>Failure trigger \${$params.id}</span>
      </au-route>`,
      App,
      [Routing.customize({ adapter }), GoodProbe, BadProbe],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator) as RouteCoordinator;
      const originalGood = fixture.appHost.querySelector('[data-good]');
      assert.strictEqual(goodAttachments, 1);
      assert.strictEqual(badAttachments, 1);
      events.length = 0;

      let caught: unknown;
      try {
        await router.load('/items/2');
      } catch (error) {
        caught = error;
      }
      await tasksSettled();

      assert.strictEqual(caught instanceof AggregateError, true);
      assert.strictEqual((caught as AggregateError).errors.includes(navigationFailure), true);
      assert.strictEqual((caught as AggregateError).errors.includes(rollbackFailure), true);
      assert.strictEqual(badAttachments, 3);
      assert.strictEqual(goodAttachments, 3);
      assert.strictEqual(events.includes('bad attaching:3'), true);
      assert.strictEqual(events.includes('good attaching:3'), true);
      assert.strictEqual(router._isRollingBack, false);
      assert.strictEqual(router.currentLocation.pathname, '/items/1');
      assert.strictEqual(adapter.getCurrentPath(), '/items/1');
      assert.strictEqual(fixture.appHost.querySelector('[data-good]'), originalGood);
      assert.strictEqual(originalGood?.isConnected, true);
      assert.strictEqual(originalGood?.textContent, 'Good 1');
    } finally {
      await fixture.tearDown();
    }
  });

  it('creates a replaced parent descendant branch exactly once', async function () {
    const events: string[] = [];
    let attached = 0;
    class App {
      public parentLoading(context: RouteLifecycleContext): void {
        events.push(`parent loading:${context.kind}`);
      }

      public parentLoaded(context: RouteLifecycleContext): void {
        events.push(`parent loaded:${context.kind}`);
      }

      public childLoading(context: RouteLifecycleContext): void {
        events.push(`child loading:${context.kind}`);
        assert.strictEqual(context.from, null);
        assert.deepStrictEqual(context.changes, []);
      }

      public childLoaded(context: RouteLifecycleContext): void {
        events.push(`child loaded:${context.kind}`);
      }
    }

    const DescendantProbe = CustomElement.define(
      { name: 'replacement-descendant-probe', template: '<span>Detail</span>' },
      class {
        public attaching(): void {
          attached++;
        }
      },
    );
    const adapter = new MemoryPathAdapter('/section/1/detail');
    const fixture = await createFixture(
      `<au-route
        path="section/:id"
        transition-plan="replace"
        loading.bind="parentLoading($lifecycle)"
        loaded.bind="parentLoaded($lifecycle)">
        <span data-parent>Section \${$params.id}</span>
        <au-route
          path="detail"
          exact
          loading.bind="childLoading($lifecycle)"
          loaded.bind="childLoaded($lifecycle)">
          <replacement-descendant-probe data-child></replacement-descendant-probe>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter }), DescendantProbe],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const oldParent = fixture.appHost.querySelector('[data-parent]');
      const oldChild = fixture.appHost.querySelector('[data-child]');
      assert.strictEqual(attached, 1);
      events.length = 0;

      const changed = router.load('/section/2/detail');
      assert.strictEqual(changed instanceof Promise ? await changed : changed, true);
      await tasksSettled();

      assert.deepStrictEqual(events, [
        'parent loading:replace',
        'child loading:enter',
        'child loaded:enter',
        'parent loaded:replace',
      ]);
      assert.strictEqual(attached, 2);
      assert.strictEqual(fixture.appHost.querySelectorAll('[data-child]').length, 1);
      assert.notStrictEqual(fixture.appHost.querySelector('[data-parent]'), oldParent);
      assert.notStrictEqual(fixture.appHost.querySelector('[data-child]'), oldChild);
      assert.strictEqual(oldParent?.isConnected, false);
      assert.strictEqual(oldChild?.isConnected, false);
      assert.strictEqual(fixture.appHost.querySelector('[data-parent]')?.textContent, 'Section 2');
    } finally {
      await fixture.tearDown();
    }
  });

  it('runs nested retained rerun loading parent-first and loaded children-first', async function () {
    const events: string[] = [];
    class App {
      public loading(name: string, context: RouteLifecycleContext): void {
        events.push(`${name} loading:${context.kind}`);
      }

      public loaded(name: string, context: RouteLifecycleContext): void {
        events.push(`${name} loaded:${context.kind}`);
      }
    }

    const adapter = new MemoryPathAdapter('/groups/one/items/alpha');
    const fixture = await createFixture(
      `<au-route
        path="groups/:groupId"
        loading.bind="loading('parent', $lifecycle)"
        loaded.bind="loaded('parent', $lifecycle)">
        <span data-parent>Group \${$params.groupId}</span>
        <au-route
          path="items/:itemId"
          exact
          loading.bind="loading('child', $lifecycle)"
          loaded.bind="loaded('child', $lifecycle)">
          <span data-child>Item \${$params.itemId}</span>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const parent = fixture.appHost.querySelector('[data-parent]');
      const child = fixture.appHost.querySelector('[data-child]');
      events.length = 0;

      const changed = router.load('/groups/two/items/beta');
      assert.strictEqual(changed instanceof Promise ? await changed : changed, true);
      await tasksSettled();

      assert.deepStrictEqual(events, [
        'parent loading:rerun',
        'child loading:rerun',
        'child loaded:rerun',
        'parent loaded:rerun',
      ]);
      assert.strictEqual(fixture.appHost.querySelector('[data-parent]'), parent);
      assert.strictEqual(fixture.appHost.querySelector('[data-child]'), child);
      assert.strictEqual(parent?.textContent, 'Group two');
      assert.strictEqual(child?.textContent, 'Item beta');
    } finally {
      await fixture.tearDown();
    }
  });

  it('completes every retained can-load guard before any loading callback', async function () {
    const events: string[] = [];
    let finishSecondGuard!: (allowed: boolean) => void;
    class App {
      public guard(name: string, context: RouteLifecycleContext): boolean | Promise<boolean> {
        events.push(`${name} can-load`);
        if (name === 'second' && context.kind === 'rerun') {
          return new Promise(resolve => { finishSecondGuard = resolve; });
        }
        return true;
      }

      public loading(name: string): void {
        events.push(`${name} loading`);
      }
    }

    const adapter = new MemoryPathAdapter('/posts/1');
    const fixture = await createFixture(
      `<au-route
        path="posts/:id"
        exact
        can-load.bind="transition => guard('first', transition)"
        loading.bind="loading('first')">First</au-route>
      <au-route
        path="posts/:id"
        exact
        can-load.bind="transition => guard('second', transition)"
        loading.bind="loading('second')">Second</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      events.length = 0;
      const navigation = fixture.container.get(IRouteCoordinator).load('/posts/2');
      assert.strictEqual(navigation instanceof Promise, true);
      assert.deepStrictEqual(events, ['first can-load', 'second can-load']);

      finishSecondGuard(true);
      assert.strictEqual(await navigation, true);
      await tasksSettled();

      assert.strictEqual(events.filter(event => event === 'first loading').length, 1);
      assert.strictEqual(events.filter(event => event === 'second loading').length, 1);
      assert.strictEqual(events.indexOf('first loading') > events.indexOf('second can-load'), true);
      assert.strictEqual(events.indexOf('second loading') > events.indexOf('second can-load'), true);
    } finally {
      finishSecondGuard?.(false);
      await fixture.tearDown();
    }
  });

  it('finishes a retained can-load guard before an entering child loads or activates', async function () {
    const events: string[] = [];
    let finishGuard!: (allowed: boolean) => void;
    class App {
      public canLoadParent(context: RouteLifecycleContext): boolean | Promise<boolean> {
        events.push(`parent can-load:${context.kind}`);
        return context.kind === 'rerun'
          ? new Promise(resolve => { finishGuard = resolve; })
          : true;
      }

      public loadParent(): void {
        events.push('parent loading');
      }

      public loadChild(): void {
        events.push('child loading');
      }
    }

    const ChildB = CustomElement.define(
      { name: 'transition-child-b', template: '<span data-b>B</span>' },
      class {
        public attaching(): void {
          events.push('child attaching');
        }
      },
    );
    const adapter = new MemoryPathAdapter('/section/1/a');
    const fixture = await createFixture(
      `<au-route
        path="section/:id"
        can-load.bind="transition => canLoadParent(transition)"
        loading.bind="loadParent()">
        <au-route path="a" exact><span data-a>A</span></au-route>
        <au-route path="b" exact loading.bind="loadChild()">
          <transition-child-b></transition-child-b>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter }), ChildB],
    ).started;

    try {
      events.length = 0;
      const router = fixture.container.get(IRouteCoordinator);
      const navigation = router.load('/section/2/b');
      assert.strictEqual(navigation instanceof Promise, true);
      assert.deepStrictEqual(events, ['parent can-load:rerun']);
      assert.strictEqual(fixture.appHost.querySelector('[data-b]'), null);

      finishGuard(true);
      assert.strictEqual(await navigation, true);
      await tasksSettled();

      assert.deepStrictEqual(events, [
        'parent can-load:rerun',
        'parent loading',
        'child loading',
        'child attaching',
      ]);
      assert.strictEqual(fixture.appHost.querySelector('[data-b]')?.textContent, 'B');
    } finally {
      finishGuard?.(false);
      await fixture.tearDown();
    }
  });
});

describe('route navigation state', function () {
  it('publishes pending phases and drives pending au-link state', async function () {
    let finishLoading!: () => void;
    const loading = new Promise<void>(resolve => { finishLoading = resolve; });

    class App {
      public load(): Promise<void> {
        return loading;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<a data-slow au-link="slow">Slow</a>
      <au-route path="home" exact>Home</au-route>
      <au-route path="slow" exact loading.bind="load()"><span data-slow-view>Slow</span></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    const states: RouteNavigationState[] = [];
    let unsubscribe: (() => void) | null = null;
    try {
      const router = fixture.container.get(IRouteCoordinator);
      const link = fixture.appHost.querySelector('[data-slow]')!;
      unsubscribe = router.subscribeNavigation(state => states.push(state));
      states.length = 0;

      const navigation = router.load('/slow');
      assert.strictEqual(navigation instanceof Promise, true);
      assert.strictEqual(router.navigation.pending, true);
      assert.strictEqual(router.navigation.href, '/slow');
      assert.strictEqual(router.navigation.signal?.aborted, false);
      assert.strictEqual(link.classList.contains('is-pending'), true);
      assert.strictEqual(link.getAttribute('aria-busy'), 'true');

      finishLoading();
      assert.strictEqual(await navigation, true);
      await tasksSettled();

      assert.strictEqual(states.every(Object.isFrozen), true);
      assert.strictEqual(states.some(state => state.phase === 'guarding'), true);
      assert.strictEqual(states.some(state => state.phase === 'loading'), true);
      assert.strictEqual(states.some(state => state.phase === 'committing'), true);
      assert.strictEqual(router.navigation.pending, false);
      assert.strictEqual(router.navigation.result?.outcome, 'completed');
      assert.strictEqual(router.navigation.result?.committed.pathname, '/slow');
      assert.strictEqual(link.classList.contains('is-pending'), false);
      assert.strictEqual(link.hasAttribute('aria-busy'), false);
    } finally {
      unsubscribe?.();
      finishLoading();
      await fixture.tearDown();
    }
  });
});

describe('au-route navigation guards', function () {
  it('preempts a pending initial navigation', async function () {
    let initialSignal: AbortSignal | null = null;
    const root = new RouteContext(null, '*');
    const initial = root.createChild('/initial', { exact: true }) as RouteContext;
    let coordinator!: RouteCoordinator;
    initial._setGuards(
      transition => {
        initialSignal = transition.signal;
        return new Promise<boolean>(() => {});
      },
      null,
    );
    initial.subscribe(state => {
      if (state.active) {
        void coordinator._runRouteActivation(
          initial,
          initial._canLoad,
          coordinator._createLifecycleContext(initial, 'enter'),
          () => {},
        );
      }
    });

    const adapter = new MemoryPathAdapter('/initial');
    coordinator = new RouteCoordinator(root, adapter);
    const starting = coordinator.start();
    const next = coordinator.load('/next');

    assert.strictEqual(starting instanceof Promise, true);
    assert.strictEqual((initialSignal as unknown as AbortSignal).aborted, true);
    assert.strictEqual(await starting, false);
    assert.strictEqual(next instanceof Promise ? await next : next, true);
    assert.strictEqual(adapter.getCurrentPath(), '/next');
    assert.strictEqual(coordinator.currentLocation.pathname, '/next');
    coordinator.stop();
  });

  it('preempts a never-settling can-unload before the next attempt runs', async function () {
    let calls = 0;
    let firstSignal: AbortSignal | null = null;
    class App {
      public canLeave(transition: { signal: AbortSignal }): boolean | Promise<boolean> {
        calls++;
        if (calls === 1) {
          firstSignal = transition.signal;
          return new Promise<boolean>(() => {});
        }
        return true;
      }
    }

    const adapter = new MemoryPathAdapter('/editor');
    const fixture = await createFixture(
      `<au-route path="editor" exact can-unload.bind="transition => canLeave(transition)">Editor</au-route>
      <au-route path="one" exact>One</au-route>
      <au-route path="two" exact><span data-two>Two</span></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const first = router.load('/one');
      const second = router.load('/two');

      assert.strictEqual(first instanceof Promise, true);
      assert.strictEqual((firstSignal as unknown as AbortSignal).aborted, true);
      assert.strictEqual(await first, false);
      assert.strictEqual(second instanceof Promise ? await second : second, true);
      await tasksSettled();
      assert.strictEqual(calls, 2);
      assert.strictEqual(adapter.getCurrentPath(), '/two');
      assert.strictEqual(fixture.appHost.querySelector('[data-two]')?.textContent, 'Two');
    } finally {
      await fixture.tearDown();
    }
  });

  it('does not continue a stale asynchronous can-unload chain', async function () {
    let finishChild!: (allowed: boolean) => void;
    const childGuard = new Promise<boolean>(resolve => { finishChild = resolve; });
    let parentCalls = 0;

    class App {
      public child(): Promise<boolean> {
        return childGuard;
      }

      public parent(): boolean {
        parentCalls++;
        return true;
      }
    }

    const adapter = new MemoryPathAdapter('/area/editor');
    const fixture = await createFixture(
      `<au-route path="area" can-unload.bind="() => parent()">
        <au-route path="editor" exact can-unload.bind="() => child()">Editor</au-route>
      </au-route>
      <au-route path="other" exact>Other</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const stale = router.load('/other');
      const current = router.load('/area/editor');

      assert.strictEqual(stale instanceof Promise, true);
      assert.strictEqual(await stale, false);
      assert.strictEqual(current instanceof Promise ? await current : current, true);
      finishChild(true);
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(parentCalls, 0);
      assert.strictEqual(adapter.getCurrentPath(), '/area/editor');
    } finally {
      finishChild(true);
      await fixture.tearDown();
    }
  });

  it('lets the latest rapid traversal own rollback and history settlement', async function () {
    let calls = 0;
    let firstSignal: AbortSignal | null = null;
    class App {
      public canLeave(transition: { signal: AbortSignal }): boolean | Promise<boolean> {
        calls++;
        if (calls === 1) {
          firstSignal = transition.signal;
          return new Promise<boolean>(() => {});
        }
        return true;
      }
    }

    const adapter = new MemoryPathAdapter('/zero');
    const fixture = await createFixture(
      `<au-route path="zero" exact><span data-zero>Zero</span></au-route>
      <au-route path="one" exact><span data-one>One</span></au-route>
      <au-route path="two" exact can-unload.bind="transition => canLeave(transition)">Two</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      await router.load('/one');
      await router.load('/two');

      assert.strictEqual(adapter.back(), true);
      assert.strictEqual(adapter.back(), true);
      await tasksSettled();

      assert.strictEqual((firstSignal as unknown as AbortSignal).aborted, true);
      assert.strictEqual(calls, 2);
      assert.strictEqual(adapter.getCurrentPath(), '/zero');
      assert.strictEqual(router.currentLocation.pathname, '/zero');
      assert.strictEqual(fixture.appHost.querySelector('[data-zero]')?.textContent, 'Zero');

      assert.strictEqual(adapter.forward(), true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/one');
      assert.strictEqual(fixture.appHost.querySelector('[data-one]')?.textContent, 'One');
    } finally {
      await fixture.tearDown();
    }
  });

  it('restores a denied external traversal without damaging forward history', async function () {
    class App {
      public allowLeave: boolean = false;

      public canLeave(): boolean {
        return this.allowLeave;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><span data-home>Home</span></au-route>
      <au-route path="editor" exact can-unload.bind="() => canLeave()"><span data-editor>Editor</span></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      await router.load('/editor');
      await tasksSettled();

      assert.strictEqual(adapter.back(), true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/editor');
      assert.strictEqual(router.currentLocation.pathname, '/editor');
      assert.strictEqual(fixture.appHost.querySelector('[data-editor]')?.textContent, 'Editor');

      fixture.component.allowLeave = true;
      assert.strictEqual(adapter.back(), true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/home');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');

      assert.strictEqual(adapter.forward(), true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/editor');
      assert.strictEqual(fixture.appHost.querySelector('[data-editor]')?.textContent, 'Editor');
    } finally {
      await fixture.tearDown();
    }
  });

  it('rejects an unknown guard-failure mode', function () {
    assert.throws(
      () => createFixture(
        '<au-route path="private" guard-failure="partial">Private</au-route>',
        class App {},
        [Routing],
      ),
      /Invalid au-route guard-failure "partial".*"navigation" or "local"/,
    );
  });

  for (const testCase of [
    {
      position: 'first',
      routes: `<au-route path="private" exact can-load.bind="() => canOpen()"><h1 data-private>Private</h1></au-route>
        <au-route path="home" exact><h1 data-home>Home</h1></au-route>
        <au-route path="settings" exact><h1 data-settings>Settings</h1></au-route>`,
    },
    {
      position: 'middle',
      routes: `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
        <au-route path="private" exact can-load.bind="() => canOpen()"><h1 data-private>Private</h1></au-route>
        <au-route path="settings" exact><h1 data-settings>Settings</h1></au-route>`,
    },
    {
      position: 'last',
      routes: `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
        <au-route path="settings" exact><h1 data-settings>Settings</h1></au-route>
        <au-route path="private" exact can-load.bind="() => canOpen()"><h1 data-private>Private</h1></au-route>`,
    },
  ]) {
    it(`cancels can-load when the denied route is the ${testCase.position} of three siblings`, async function () {
      class App {
        public canOpen(): boolean {
          return false;
        }
      }

      const adapter = new MemoryPathAdapter('/home');
      const fixture = await createFixture(
        testCase.routes,
        App,
        [Routing.customize({ adapter })],
      ).started;

      try {
        const result = fixture.container.get(IRouteCoordinator).load('/private');
        assert.strictEqual(result, false);
        await tasksSettled();
        assert.strictEqual(adapter.getCurrentPath(), '/home');
        assert.strictEqual(adapter.back(), false);
        assert.strictEqual(adapter.forward(), false);
        assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');
        assert.strictEqual(fixture.appHost.querySelector('[data-private]'), null);
        assert.strictEqual(fixture.appHost.querySelector('[data-settings]'), null);
      } finally {
        await fixture.tearDown();
      }
    });
  }

  it('keeps the outgoing branch mounted while an asynchronous can-load is pending', async function () {
    let finishGuard!: (allowed: boolean) => void;
    const guard = new Promise<boolean>(resolve => { finishGuard = resolve; });
    class App {
      public canOpen(): Promise<boolean> {
        return guard;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
      <au-route path="private" exact can-load.bind="() => canOpen()"><h1 data-private>Private</h1></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/private');
      assert.strictEqual(navigation instanceof Promise, true);
      assert.strictEqual(adapter.getCurrentPath(), '/home');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');
      assert.strictEqual(fixture.appHost.querySelector('[data-private]'), null);

      finishGuard(false);
      assert.strictEqual(await (navigation as Promise<boolean>), false);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/home');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');
    } finally {
      finishGuard(false);
      await fixture.tearDown();
    }
  });

  it('commits accepted ancestors and a sibling fallback after an asynchronous local can-load denial', async function () {
    const events: string[] = [];
    class App {
      public approve(name: string): boolean {
        events.push(name);
        return true;
      }

      public async denyAdmin(): Promise<boolean> {
        events.push('admin');
        await Promise.resolve();
        return false;
      }

      public fallbackLoading(): void {
        events.push('fallback');
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
      <au-route path="portal" can-load.bind="() => approve('portal')">
        <h1 data-portal>Portal</h1>
        <au-route path="admin" exact can-load.bind="() => denyAdmin()" guard-failure="local">
          <h2 data-admin>Admin</h2>
        </au-route>
        <au-route path="*" fallback loading.bind="fallbackLoading()">
          <h2 data-denied>Access denied</h2>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/portal/admin');
      assert.strictEqual(navigation instanceof Promise, true);
      assert.strictEqual(await navigation, true);
      await tasksSettled();
      assert.deepStrictEqual(events, ['portal', 'admin', 'fallback']);
      assert.strictEqual(adapter.getCurrentPath(), '/portal/admin');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-portal]')?.textContent, 'Portal');
      assert.strictEqual(fixture.appHost.querySelector('[data-admin]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-denied]')?.textContent, 'Access denied');
      assert.strictEqual(adapter.back(), true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/home');
    } finally {
      await fixture.tearDown();
    }
  });

  it('commits the accepted parent and warns when local denial has no matching recovery route', async function () {
    class App {
      public deny(): boolean {
        return false;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    let fixture: Awaited<ReturnType<typeof createFixture>> | null = null;
    try {
      fixture = await createFixture(
        `<au-route path="home" exact>Home</au-route>
        <au-route path="portal">
          <h1 data-portal>Portal</h1>
          <au-route path="admin" exact can-load.bind="() => deny()" guard-failure="local">
            <h2 data-admin>Admin</h2>
          </au-route>
        </au-route>`,
        App,
        [Routing.customize({ adapter })],
      ).started;

      const result = fixture.container.get(IRouteCoordinator).load('/portal/admin');
      assert.strictEqual(result, true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/portal/admin');
      assert.strictEqual(fixture.appHost.querySelector('[data-portal]')?.textContent, 'Portal');
      assert.strictEqual(fixture.appHost.querySelector('[data-admin]'), null);
      assert.strictEqual(warnings.some(args => String(args[0]).includes('has no matching sibling fallback or route')), true);
    } finally {
      console.warn = originalWarn;
      await fixture?.tearDown();
    }
  });

  it('aborts a stale asynchronous guard before running the newer navigation', async function () {
    let finishGuard!: (allowed: boolean) => void;
    let observedSignal: AbortSignal | null = null;
    const guard = new Promise<boolean>(resolve => { finishGuard = resolve; });
    class App {
      public canOpen(transition: { signal: AbortSignal }): Promise<boolean> {
        observedSignal = transition.signal;
        return guard;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
      <au-route path="private" exact can-load.bind="transition => canOpen(transition)">Private</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const first = fixture.container.get(IRouteCoordinator).load('/private');
      const second = fixture.container.get(IRouteCoordinator).load('/home');
      assert.strictEqual((observedSignal as unknown as AbortSignal).aborted, true);

      finishGuard(true);
      assert.strictEqual(await first, false);
      assert.strictEqual(await second, true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/home');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');
    } finally {
      finishGuard(false);
      await fixture.tearDown();
    }
  });

  it('runs can-unload deepest-first and cancels before incoming work begins', async function () {
    const events: string[] = [];
    class App {
      public guard(name: string, allowed: boolean): boolean {
        events.push(name);
        return allowed;
      }
    }

    const adapter = new MemoryPathAdapter('/area/project/editor');
    const fixture = await createFixture(
      `<au-route path="home" exact can-load.bind="() => guard('home can-load', true)"><h1>Home</h1></au-route>
      <au-route path="area" can-unload.bind="() => guard('area can-unload', true)">
        <au-route path="project" guard-failure="local" can-unload.bind="() => guard('project can-unload', false)">
          <au-route path="editor" exact can-unload.bind="() => guard('editor can-unload', true)">Editor</au-route>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const result = fixture.container.get(IRouteCoordinator).load('/home');
      assert.strictEqual(result, false);
      assert.deepStrictEqual(events, ['editor can-unload', 'project can-unload']);
      assert.strictEqual(adapter.getCurrentPath(), '/area/project/editor');
      assert.strictEqual(fixture.appHost.textContent?.includes('Editor'), true);
    } finally {
      await fixture.tearDown();
    }
  });

  it('redirects contextually from a nested can-load result', async function () {
    class App {
      public redirect() {
        return { target: 'login', options: { replace: true } };
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact>Home</au-route>
      <au-route path="area">
        <au-route path="private" exact can-load.bind="() => redirect()">Private</au-route>
        <au-route path="login" exact><h1 data-login>Login</h1></au-route>
      </au-route>
      `,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const result = fixture.container.get(IRouteCoordinator).load('/area/private');
      assert.strictEqual(result instanceof Promise ? await result : result, true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/area/login');
      assert.strictEqual(fixture.appHost.querySelector('[data-login]')?.textContent, 'Login');
      assert.strictEqual(fixture.appHost.textContent?.includes('Private'), false);
    } finally {
      await fixture.tearDown();
    }
  });

  it('rejects loading errors and restores the outgoing navigation', async function () {
    const failure = new Error('Product loading failed');
    class App {
      public loadProduct(): Promise<void> {
        return Promise.reject(failure);
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
      <au-route path="product" exact loading.bind="loadProduct()"><h1 data-product>Product</h1></au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/product');
      assert.strictEqual(navigation instanceof Promise, true);
      let caught: unknown;
      try {
        await navigation;
      } catch (error) {
        caught = error;
      }
      assert.strictEqual(caught, failure);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/home');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');
      assert.strictEqual(fixture.appHost.querySelector('[data-product]'), null);
    } finally {
      await fixture.tearDown();
    }
  });

  it('reports link-triggered navigation errors through au-route-navigation-error', async function () {
    const failure = new Error('Link loading failed');
    class App {
      public fail(): Promise<void> {
        return Promise.reject(failure);
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<a au-link="broken">Broken</a>
      <au-route path="home" exact>Home</au-route>
      <au-route path="broken" exact loading.bind="fail()">Broken route</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      let reported: unknown;
      fixture.appHost.addEventListener('au-route-navigation-error', event => {
        reported = (event as CustomEvent<{ error: unknown }>).detail.error;
      });
      const link = fixture.appHost.querySelector('a')!;
      const MouseEvent = fixture.appHost.ownerDocument.defaultView!.MouseEvent;
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
      for (let index = 0; index < 10 && reported == null; index++) {
        await Promise.resolve();
        await tasksSettled();
      }
      assert.strictEqual(reported, failure);
      assert.strictEqual(adapter.getCurrentPath(), '/home');
    } finally {
      await fixture.tearDown();
    }
  });
});

describe('au-route error recovery', function () {
  it('lets the failing route recover locally through its parent fallback', async function () {
    const failure = new Error('Reports unavailable');
    let observed: RouteFailure | null = null;
    class App {
      public loadReports(): never {
        throw failure;
      }

      public async recover(routeFailure: RouteFailure) {
        observed = routeFailure;
        await Promise.resolve();
        return { recover: 'local' } as const;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><h1 data-home>Home</h1></au-route>
      <au-route path="workspace">
        <h1 data-workspace>Workspace</h1>
        <au-route
          path="reports"
          exact
          loading.bind="loadReports()"
          on-error.bind="failure => recover(failure)">
          <h2 data-reports>Reports</h2>
        </au-route>
        <au-route path="*" fallback>
          <h2 data-recovery>Could not load: \${$route.parent.failure.error.message}</h2>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const navigation = router.load('/workspace/reports');
      assert.strictEqual(navigation instanceof Promise ? await navigation : navigation, true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/workspace/reports');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-workspace]')?.textContent, 'Workspace');
      assert.strictEqual(fixture.appHost.querySelector('[data-reports]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-recovery]')?.textContent, 'Could not load: Reports unavailable');
      assert.notStrictEqual(observed, null);
      const captured = observed as unknown as RouteFailure;
      assert.strictEqual(captured.error, failure);
      assert.strictEqual(captured.phase, 'loading');
      assert.strictEqual(captured.source.pattern, '/reports');
      assert.strictEqual(captured.boundary, captured.source);
      assert.strictEqual(captured.recovery.pattern, '/workspace');
      assert.strictEqual(captured.recovery.failure, captured);
      assert.strictEqual(captured.signal.aborted, false);
    } finally {
      await fixture.tearDown();
    }
  });

  for (const testCase of [
    { phase: 'can-load', callback: 'can-load.bind="() => fail()"', content: 'Protected' },
    { phase: 'loaded', callback: 'loaded.bind="fail()"', content: 'Loaded content' },
  ] as const) {
    it(`attributes ${testCase.phase} failures before local recovery`, async function () {
      let observed: RouteFailure | null = null;
      class App {
        public fail(): never {
          throw new Error(`${testCase.phase} failed`);
        }

        public recover(failure: RouteFailure) {
          observed = failure;
          return { recover: 'local' } as const;
        }
      }

      const adapter = new MemoryPathAdapter('/home');
      const fixture = await createFixture(
        `<au-route path="home" exact>Home</au-route>
        <au-route path="workspace">
          <au-route path="target" exact ${testCase.callback} on-error.bind="failure => recover(failure)">
            <span data-target>${testCase.content}</span>
          </au-route>
          <au-route path="*" fallback><span data-recovery>Recovered</span></au-route>
        </au-route>`,
        App,
        [Routing.customize({ adapter })],
      ).started;

      try {
        const navigation = fixture.container.get(IRouteCoordinator).load('/workspace/target');
        assert.strictEqual(navigation instanceof Promise ? await navigation : navigation, true);
        await tasksSettled();
        assert.strictEqual((observed as unknown as RouteFailure).phase, testCase.phase);
        assert.strictEqual(fixture.appHost.querySelector('[data-target]'), null);
        assert.strictEqual(fixture.appHost.querySelector('[data-recovery]')?.textContent, 'Recovered');
      } finally {
        await fixture.tearDown();
      }
    });
  }

  it('attributes synthetic view activation failures before local recovery', async function () {
    let observed: RouteFailure | null = null;
    class App {
      public recover(failure: RouteFailure) {
        observed = failure;
        return { recover: 'local' } as const;
      }
    }
    class BrokenContent {
      public attaching(): never {
        throw new Error('Attaching failed');
      }
    }
    const BrokenContentElement = CustomElement.define({
      name: 'broken-content',
      template: 'Broken',
    }, BrokenContent);

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact>Home</au-route>
      <au-route path="workspace">
        <au-route path="target" exact on-error.bind="failure => recover(failure)">
          <broken-content></broken-content>
        </au-route>
        <au-route path="*" fallback><span data-recovery>Recovered</span></au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter }), BrokenContentElement],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/workspace/target');
      assert.strictEqual(navigation instanceof Promise ? await navigation : navigation, true);
      await tasksSettled();
      assert.strictEqual((observed as unknown as RouteFailure).phase, 'activation');
      assert.strictEqual(fixture.appHost.querySelector('[data-recovery]')?.textContent, 'Recovered');
    } finally {
      await fixture.tearDown();
    }
  });

  it('bubbles to the nearest ancestor that handles the failure', async function () {
    const events: string[] = [];
    let observed: RouteFailure | null = null;
    class App {
      public fail(): never {
        throw new Error('Child failed');
      }

      public pass(): undefined {
        events.push('child');
        return undefined;
      }

      public recover(failure: RouteFailure) {
        events.push('workspace');
        observed = failure;
        return { recover: 'local' } as const;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact>Home</au-route>
      <au-route path="workspace" on-error.bind="failure => recover(failure)">
        <au-route
          path="target"
          exact
          loading.bind="fail()"
          on-error.bind="() => pass()">
          Target
        </au-route>
        <au-route path="*" fallback><span data-recovery>Recovered</span></au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/workspace/target');
      assert.strictEqual(navigation instanceof Promise ? await navigation : navigation, true);
      await tasksSettled();
      assert.deepStrictEqual(events, ['child', 'workspace']);
      const captured = observed as unknown as RouteFailure;
      assert.strictEqual(captured.boundary.pattern, '/workspace');
      assert.strictEqual(captured.recovery.pattern, '/workspace');
      assert.strictEqual(fixture.appHost.querySelector('[data-recovery]')?.textContent, 'Recovered');
    } finally {
      await fixture.tearDown();
    }
  });

  it('redirects contextually from an error boundary', async function () {
    class App {
      public fail(): never {
        throw new Error('Private data failed');
      }

      public redirect(): string {
        return 'error';
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact>Home</au-route>
      <au-route path="workspace">
        <au-route path="private" exact loading.bind="fail()" on-error.bind="() => redirect()">
          Private
        </au-route>
        <au-route path="error" exact><span data-error>Error page</span></au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/workspace/private');
      assert.strictEqual(navigation instanceof Promise ? await navigation : navigation, true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/workspace/error');
      assert.strictEqual(fixture.appHost.querySelector('[data-error]')?.textContent, 'Error page');
    } finally {
      await fixture.tearDown();
    }
  });

  it('clears recovery state only after a retry succeeds', async function () {
    let shouldFail = true;
    let recovered: RouteFailure | null = null;
    class App {
      public load(): void {
        if (shouldFail) {
          throw new Error('Retry me');
        }
      }

      public recover(failure: RouteFailure) {
        recovered = failure;
        return { recover: 'local' } as const;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact>Home</au-route>
      <au-route path="workspace">
        <au-route path="target" exact loading.bind="load()" on-error.bind="failure => recover(failure)">
          <span data-target>Ready</span>
        </au-route>
        <au-route path="*" fallback><span data-recovery>Retry available</span></au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const first = router.load('/workspace/target');
      assert.strictEqual(first instanceof Promise ? await first : first, true);
      await tasksSettled();
      const recovery = (recovered as unknown as RouteFailure).recovery;
      assert.strictEqual(recovery.failure, recovered);

      shouldFail = false;
      const retry = router.load('/workspace/target');
      assert.strictEqual(retry instanceof Promise ? await retry : retry, true);
      await tasksSettled();
      assert.strictEqual(recovery.failure, null);
      assert.strictEqual(fixture.appHost.querySelector('[data-recovery]'), null);
      assert.strictEqual(fixture.appHost.querySelector('[data-target]')?.textContent, 'Ready');
    } finally {
      await fixture.tearDown();
    }
  });

  it('rejects with both errors when an error handler throws', async function () {
    const original = new Error('Loading failed');
    const handlerFailure = new Error('Handler failed');
    class App {
      public fail(): never {
        throw original;
      }

      public failHandler(): never {
        throw handlerFailure;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><span data-home>Home</span></au-route>
      <au-route path="broken" exact loading.bind="fail()" on-error.bind="() => failHandler()">
        Broken
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      let caught: unknown;
      try {
        await fixture.container.get(IRouteCoordinator).load('/broken');
      } catch (error) {
        caught = error;
      }
      assert.strictEqual(caught instanceof AggregateError, true);
      assert.deepStrictEqual((caught as AggregateError).errors, [original, handlerFailure]);
      assert.strictEqual(adapter.getCurrentPath(), '/home');
      assert.strictEqual(fixture.appHost.querySelector('[data-home]')?.textContent, 'Home');
    } finally {
      await fixture.tearDown();
    }
  });

  it('does not reenter a boundary when its recovery fallback also fails', async function () {
    const boundaries: string[] = [];
    class App {
      public failTarget(): never {
        throw new Error('Target failed');
      }

      public failFallback(): never {
        throw new Error('Fallback failed');
      }

      public recoverWorkspace() {
        boundaries.push('workspace');
        return { recover: 'local' } as const;
      }

      public recoverShell() {
        boundaries.push('shell');
        return { recover: 'local' } as const;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact>Home</au-route>
      <au-route path="shell" on-error.bind="() => recoverShell()">
        <span data-shell>Shell</span>
        <au-route path="workspace" on-error.bind="() => recoverWorkspace()">
          <span data-workspace>Workspace</span>
          <au-route path="target" exact loading.bind="failTarget()">Target</au-route>
          <au-route path="*" fallback loading.bind="failFallback()">Fallback</au-route>
        </au-route>
      </au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const navigation = fixture.container.get(IRouteCoordinator).load('/shell/workspace/target');
      assert.strictEqual(navigation instanceof Promise ? await navigation : navigation, true);
      await tasksSettled();
      assert.deepStrictEqual(boundaries, ['workspace', 'shell']);
      assert.strictEqual(fixture.appHost.querySelector('[data-shell]')?.textContent, 'Shell');
      assert.strictEqual(fixture.appHost.querySelector('[data-workspace]')?.textContent, 'Workspace');
    } finally {
      await fixture.tearDown();
    }
  });

  it('treats an aborted asynchronous error handler as superseded navigation', async function () {
    let finishRecovery!: () => void;
    let observedSignal: AbortSignal | null = null;
    const pendingRecovery = new Promise<void>(resolve => {
      finishRecovery = resolve;
    });
    class App {
      public fail(): never {
        throw new Error('Broken route');
      }

      public async recover(failure: RouteFailure) {
        observedSignal = failure.signal;
        await pendingRecovery;
        return { recover: 'local' } as const;
      }
    }

    const adapter = new MemoryPathAdapter('/home');
    const fixture = await createFixture(
      `<au-route path="home" exact><span data-home>Home</span></au-route>
      <au-route path="broken" exact loading.bind="fail()" on-error.bind="failure => recover(failure)">
        Broken
      </au-route>
      <au-route path="other" exact><span data-other>Other</span></au-route>
      <au-route path="*" fallback>Fallback</au-route>`,
      App,
      [Routing.customize({ adapter })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      const superseded = router.load('/broken');
      await Promise.resolve();
      const latest = router.load('/other');
      assert.strictEqual((observedSignal as unknown as AbortSignal).aborted, true);
      finishRecovery();
      assert.strictEqual(await superseded, false);
      assert.strictEqual(await latest, true);
      await tasksSettled();
      assert.strictEqual(adapter.getCurrentPath(), '/other');
      assert.strictEqual(fixture.appHost.querySelector('[data-other]')?.textContent, 'Other');
    } finally {
      finishRecovery();
      await fixture.tearDown();
    }
  });
});

describe('au-route document titles', function () {
  it('composes static titles from the active nested route tree and restores the fallback', async function () {
    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      `<au-route path="products" title="Products">
        <au-route path="camera" exact title="Camera details">
          <span data-camera>Camera</span>
        </au-route>
      </au-route>
      <au-route path="plain" exact><span data-plain>Plain</span></au-route>`,
      class App {},
      [Routing.customize({ adapter, titles: { separator: ' — ', fallback: 'Example store' } })],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/products/camera');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.ownerDocument.title, 'Products — Camera details');

      router.load('/plain');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.ownerDocument.title, 'Example store');
    } finally {
      await fixture.tearDown();
    }
  });

  it('updates a bound title and supports custom composition', async function () {
    class App {
      public productTitle: string = 'Camera';
    }

    const adapter = new MemoryPathAdapter('/products/camera');
    const fixture = await createFixture(
      `<au-route path="products" title="Products">
        <au-route path="camera" exact title.bind="productTitle"><span>Camera</span></au-route>
      </au-route>`,
      App,
      [Routing.customize({
        adapter,
        titles: {
          compose: titles => [...titles].reverse().join(' | '),
        },
      })],
    ).started;

    try {
      await tasksSettled();
      assert.strictEqual(fixture.appHost.ownerDocument.title, 'Camera | Products');

      fixture.component.productTitle = 'Mirrorless camera';
      await tasksSettled();
      assert.strictEqual(fixture.appHost.ownerDocument.title, 'Mirrorless camera | Products');
    } finally {
      await fixture.tearDown();
    }
  });

  for (const syntax of ['title.to-view="pageTitle"', ':title="pageTitle"']) {
    it(`updates a dynamic title using ${syntax}`, async function () {
      class App {
        public pageTitle: string = 'First title';
      }

      const adapter = new MemoryPathAdapter('/page');
      const fixture = await createFixture(
        `<au-route path="page" exact ${syntax}><span>Page</span></au-route>`,
        App,
        [Routing.customize({ adapter, titles: true })],
      ).started;

      try {
        await tasksSettled();
        assert.strictEqual(fixture.appHost.ownerDocument.title, 'First title');

        fixture.component.pageTitle = 'Second title';
        await tasksSettled();
        assert.strictEqual(fixture.appHost.ownerDocument.title, 'Second title');
      } finally {
        await fixture.tearDown();
      }
    });
  }

  it('does not publish the matched title until async route content is ready', async function () {
    let finishAttaching!: () => void;
    const attaching = new Promise<void>(resolve => {
      finishAttaching = resolve;
    });

    class AsyncTitleContent {
      public attaching(): Promise<void> {
        return attaching;
      }
    }

    const AsyncTitleContentElement = CustomElement.define({
      name: 'async-title-content',
      template: '<span>Ready</span>',
    }, AsyncTitleContent);
    const adapter = new MemoryPathAdapter('/idle');
    const fixture = await createFixture(
      '<au-route path="async" exact title="Async page"><async-title-content></async-title-content></au-route>',
      class App {},
      [
        Routing.customize({ adapter, titles: { fallback: 'Before navigation' } }),
        AsyncTitleContentElement,
      ],
    ).started;

    try {
      const router = fixture.container.get(IRouteCoordinator);
      router.load('/async');
      await Promise.resolve();
      assert.strictEqual(fixture.appHost.ownerDocument.title, 'Before navigation');

      finishAttaching();
      for (let index = 0; index < 10 && fixture.appHost.ownerDocument.title !== 'Async page'; index++) {
        await Promise.resolve();
        await tasksSettled();
      }
      assert.strictEqual(fixture.appHost.ownerDocument.title, 'Async page');
    } finally {
      finishAttaching();
      await fixture.tearDown();
    }
  });
});
