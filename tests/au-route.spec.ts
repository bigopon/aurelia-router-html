import { IPlatform } from '@aurelia/kernel';
import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import { CustomElement } from '@aurelia/runtime-html';
import { Routing } from '../router/configuration';
import { IRouteCoordinator, RouteCoordinator } from '../router/coordinator';
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
        return `ready:${(context.previousData.loading as { id: string }).id}`;
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

      await fixture.container.get(IRouteCoordinator).load('/idle');
      await fixture.container.get(IRouteCoordinator).load('/ready/second');
      await tasksSettled();
      assert.strictEqual(fixture.appHost.querySelector('[data-loading]')?.textContent, 'second:first');
      assert.strictEqual(fixture.appHost.querySelector('[data-loaded]')?.textContent, 'ready:second');
      assert.strictEqual((fixture.component.loadingContexts[1].previousData.loading as { id: string }).id, 'first');
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
      await Promise.resolve();
      await Promise.resolve();
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
});

describe('au-route navigation guards', function () {
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
