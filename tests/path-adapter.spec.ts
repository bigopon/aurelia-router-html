import { DI, Registration } from '@aurelia/kernel';
import { tasksSettled } from '@aurelia/runtime';
import { assert } from '@aurelia/testing';
import { JSDOM } from 'jsdom';
import { BrowserHashAdapter, BrowserPathAdapter, BrowserQueryAdapter } from '../router/browser-path-adapter';
import { Routing } from '../router/configuration';
import { IRouteCoordinator, RouteCoordinator } from '../router/coordinator';
import { BrowserRouteFocusService } from '../router/focus';
import { MemoryPathAdapter } from '../router/memory-path-adapter';
import { IPathAdapter } from '../router/path-adapter';
import { RouteContext } from '../router/route-context';
import { parseRouteLocation } from '../router/route-location';
import { BrowserRouteScrollService } from '../router/scroll';
import { RouteViewSettlement } from '../router/settlement';

describe('route view settlement', function () {
  it('waits for every pending view and coalesces callbacks', async function () {
    const settlement = new RouteViewSettlement();
    const events: string[] = [];
    const settled = () => events.push('settled');

    settlement.begin();
    settlement.begin();
    settlement.queue(settled);
    settlement.queue(settled);
    await tasksSettled();
    assert.deepStrictEqual(events, []);

    settlement.end();
    await tasksSettled();
    assert.deepStrictEqual(events, []);

    settlement.end();
    await tasksSettled();
    assert.deepStrictEqual(events, ['settled']);
  });

  it('cancels work that is no longer relevant before settlement', async function () {
    const settlement = new RouteViewSettlement();
    let called = false;
    const callback = () => { called = true; };

    settlement.begin();
    settlement.queue(callback);
    settlement.cancel(callback);
    settlement.end();
    await tasksSettled();
    assert.strictEqual(called, false);
  });
});

describe('route hash scrolling', function () {
  it('decodes and scrolls to the target only after routed views settle', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body></body>').window.document;
    const target = document.createElement('section');
    target.id = 'details panel';
    let options: ScrollIntoViewOptions | boolean | undefined;
    target.scrollIntoView = value => { options = value; };
    document.body.append(target);
    const scrolling = new BrowserRouteScrollService(document, settlement, { block: 'center' });

    try {
      settlement.begin();
      scrolling.afterNavigation(parseRouteLocation('/products#details%20panel'));
      await tasksSettled();
      assert.strictEqual(options, undefined);

      settlement.end();
      await tasksSettled();
      assert.deepStrictEqual(options, {
        behavior: undefined,
        block: 'center',
        inline: undefined,
      });
    } finally {
      scrolling.stop();
      target.remove();
    }
  });

  it('prefers the literal fragment before its decoded form', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body></body>').window.document;
    const literal = document.createElement('section');
    const decoded = document.createElement('section');
    literal.id = 'details%20panel';
    decoded.id = 'details panel';
    let selected = '';
    literal.scrollIntoView = () => { selected = 'literal'; };
    decoded.scrollIntoView = () => { selected = 'decoded'; };
    document.body.append(literal, decoded);
    const scrolling = new BrowserRouteScrollService(document, settlement);

    try {
      scrolling.afterNavigation(parseRouteLocation('/products#details%20panel'));
      await tasksSettled();
      assert.strictEqual(selected, 'literal');
    } finally {
      scrolling.stop();
    }
  });

  it('uses only legacy anchor names after checking element IDs', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body></body>').window.document;
    const input = document.createElement('input');
    const anchor = document.createElement('a');
    input.name = 'details';
    anchor.name = 'details';
    let selected = '';
    input.scrollIntoView = () => { selected = 'input'; };
    anchor.scrollIntoView = () => { selected = 'anchor'; };
    document.body.append(input, anchor);
    const scrolling = new BrowserRouteScrollService(document, settlement, { restoration: 'preserve' });

    try {
      scrolling.afterNavigation(parseRouteLocation('/products#details'));
      await tasksSettled();
      assert.strictEqual(selected, 'anchor');
    } finally {
      scrolling.stop();
    }
  });

  it('scrolls the document to the top for the special top fragment', async function () {
    const settlement = new RouteViewSettlement();
    const window = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/products' }).window;
    let position: ScrollToOptions | undefined;
    window.scrollTo = options => { position = options as ScrollToOptions; };
    const scrolling = new BrowserRouteScrollService(window.document, settlement);

    try {
      scrolling.afterNavigation(parseRouteLocation('/products#ToP'));
      await tasksSettled();
      assert.deepStrictEqual(position, { left: 0, top: 0, behavior: 'auto' });
    } finally {
      scrolling.stop();
    }
  });

  it('cancels a pending fragment when a newer navigation has no fragment', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body></body>').window.document;
    const target = document.createElement('section');
    target.id = 'details';
    let called = false;
    target.scrollIntoView = () => { called = true; };
    document.body.append(target);
    const scrolling = new BrowserRouteScrollService(document, settlement, { restoration: 'preserve' });

    try {
      settlement.begin();
      scrolling.afterNavigation(parseRouteLocation('/products#details'));
      scrolling.afterNavigation(parseRouteLocation('/products'));
      settlement.end();
      await tasksSettled();
      assert.strictEqual(called, false);
    } finally {
      scrolling.stop();
      target.remove();
    }
  });
});

describe('route scroll restoration', function () {
  it('scrolls pushes to top and restores positions on browser traversal', async function () {
    const settlement = new RouteViewSettlement();
    const window = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/products' }).window;
    let left = 0;
    let top = 0;
    const scrolls: Array<{ left: number; top: number }> = [];
    Object.defineProperties(window, {
      scrollX: { configurable: true, get: () => left },
      scrollY: { configurable: true, get: () => top },
    });
    window.scrollTo = options => {
      const next = options as ScrollToOptions;
      left = next.left ?? 0;
      top = next.top ?? 0;
      scrolls.push({ left, top });
    };
    window.history.scrollRestoration = 'auto';
    const scrolling = new BrowserRouteScrollService(window.document, settlement);

    try {
      scrolling.start();
      assert.strictEqual(window.history.scrollRestoration, 'manual');
      scrolling.afterNavigation(parseRouteLocation('/products'), 'initial');
      await tasksSettled();
      const productsState = window.history.state;

      top = 640;
      window.dispatchEvent(new window.Event('scroll'));
      window.history.pushState(null, '', '/reviews');
      scrolling.afterNavigation(parseRouteLocation('/reviews'), 'push');
      await tasksSettled();
      assert.deepStrictEqual(scrolls.at(-1), { left: 0, top: 0 });
      const reviewsState = window.history.state;

      top = 120;
      window.dispatchEvent(new window.Event('scroll'));
      window.history.replaceState(productsState, '', '/products');
      window.dispatchEvent(new window.PopStateEvent('popstate', { state: productsState }));
      scrolling.afterNavigation(parseRouteLocation('/products'), 'external');
      await tasksSettled();
      assert.deepStrictEqual(scrolls.at(-1), { left: 0, top: 640 });

      window.history.replaceState(reviewsState, '', '/reviews');
      window.dispatchEvent(new window.PopStateEvent('popstate', { state: reviewsState }));
      scrolling.afterNavigation(parseRouteLocation('/reviews'), 'external');
      await tasksSettled();
      assert.deepStrictEqual(scrolls.at(-1), { left: 0, top: 120 });
    } finally {
      scrolling.stop();
      assert.strictEqual(window.history.scrollRestoration, 'auto');
    }
  });

  it('supports preserve and fully manual scrolling policies', async function () {
    const preservedWindow = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/products' }).window;
    const preservedSettlement = new RouteViewSettlement();
    let preserveScrolls = 0;
    preservedWindow.scrollTo = () => { preserveScrolls++; };
    const preserving = new BrowserRouteScrollService(
      preservedWindow.document,
      preservedSettlement,
      { restoration: 'preserve' },
    );

    const manualWindow = new JSDOM('<!doctype html><body><section id="details"></section></body>', { url: 'https://example.test/products' }).window;
    const manualSettlement = new RouteViewSettlement();
    let manualScrolls = 0;
    manualWindow.scrollTo = () => { manualScrolls++; };
    manualWindow.document.getElementById('details')!.scrollIntoView = () => { manualScrolls++; };
    const manual = new BrowserRouteScrollService(
      manualWindow.document,
      manualSettlement,
      { restoration: 'manual' },
    );

    try {
      preserving.afterNavigation(parseRouteLocation('/reviews'), 'push');
      manual.afterNavigation(parseRouteLocation('/products#details'), 'push');
      await tasksSettled();
      assert.strictEqual(preserveScrolls, 0);
      assert.strictEqual(manualScrolls, 0);
    } finally {
      preserving.stop();
      manual.stop();
    }
  });
});

describe('route focus management', function () {
  it('focuses the last newly attached marker only after routed views settle', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body><main></main></body>').window.document;
    const parent = document.createElement('h1');
    const child = document.createElement('h2');
    document.querySelector('main')!.append(parent, child);
    const focus = new BrowserRouteFocusService(document, settlement);

    focus.start();
    settlement.begin();
    focus.beforeNavigation(true);
    focus.register(parent);
    focus.register(child);
    focus.afterNavigation('push');
    await tasksSettled();
    assert.notStrictEqual(document.activeElement, child);

    settlement.end();
    await tasksSettled();
    assert.strictEqual(document.activeElement, child);
    assert.strictEqual(child.getAttribute('tabindex'), '-1');
    focus.stop();
  });

  it('skips initial and background URL updates but supports an opt-in heading fallback', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body><main><h1>Products</h1></main></body>').window.document;
    const heading = document.querySelector('h1') as HTMLElement;
    const focus = new BrowserRouteFocusService(document, settlement, { fallback: 'heading' });

    focus.start();
    focus.beforeNavigation(true);
    focus.afterNavigation('initial');
    await tasksSettled();
    assert.notStrictEqual(document.activeElement, heading);

    focus.beforeNavigation(false);
    focus.afterNavigation('push');
    await tasksSettled();
    assert.notStrictEqual(document.activeElement, heading);

    focus.beforeNavigation(true);
    focus.afterNavigation('push');
    await tasksSettled();
    assert.strictEqual(document.activeElement, heading);
    focus.stop();
  });

  it('discards focus candidates when navigation is cancelled', async function () {
    const settlement = new RouteViewSettlement();
    const document = new JSDOM('<!doctype html><body><main><h1>Denied</h1></main></body>').window.document;
    const heading = document.querySelector('h1') as HTMLElement;
    const focus = new BrowserRouteFocusService(document, settlement);

    focus.start();
    focus.beforeNavigation(true);
    focus.register(heading);
    focus.cancelNavigation();
    focus.afterNavigation('push');
    await tasksSettled();
    assert.notStrictEqual(document.activeElement, heading);
    focus.stop();
  });
});

describe('memory path adapter', function () {
  it('normalizes locations and emits only external history movement', function () {
    const adapter = new MemoryPathAdapter('/products?sort=price#reviews');
    const paths: string[] = [];
    const unsubscribe = adapter.subscribe(path => paths.push(path));

    adapter.push('/cart');
    adapter.replace('/checkout?step=payment');
    assert.strictEqual(adapter.getCurrentPath(), '/checkout?step=payment');
    assert.deepStrictEqual(paths, []);

    assert.strictEqual(adapter.back(), true);
    assert.strictEqual(adapter.getCurrentPath(), '/products?sort=price#reviews');
    assert.deepStrictEqual(paths, ['/products?sort=price#reviews']);

    assert.strictEqual(adapter.forward(), true);
    assert.deepStrictEqual(paths, [
      '/products?sort=price#reviews',
      '/checkout?step=payment',
    ]);
    assert.strictEqual(adapter.go(1), false);
    assert.strictEqual(adapter.go(Number.NaN), false);

    unsubscribe();
    adapter.back();
    assert.strictEqual(paths.length, 2);
  });

  it('resubscribes and reapplies the current location after coordinator restart', function () {
    const adapter = new MemoryPathAdapter('/one');
    const root = new RouteContext(null, '*');
    const one = root.createChild('/one', { exact: true }) as RouteContext;
    const two = root.createChild('/two', { exact: true }) as RouteContext;
    const coordinator = new RouteCoordinator(root, adapter);

    coordinator.start();
    assert.strictEqual(one.active, true);

    coordinator.load('/two');
    assert.strictEqual(two.active, true);

    coordinator.stop();
    coordinator.stop();
    adapter.back();
    assert.strictEqual(coordinator.currentPath, '/two');

    coordinator.start();
    coordinator.start();
    assert.strictEqual(coordinator.currentPath, '/one');
    assert.strictEqual(one.active, true);

    adapter.forward();
    assert.strictEqual(coordinator.currentPath, '/two');
    assert.strictEqual(two.active, true);
    coordinator.stop();
  });

  it('uses a registered adapter without resolving browser services', function () {
    const container = DI.createContainer();
    const adapter = new MemoryPathAdapter('/memory');

    container.register(
      Registration.instance(IPathAdapter, adapter),
      Routing,
    );

    const coordinator = container.get(IRouteCoordinator);
    assert.strictEqual(container.get(IPathAdapter), adapter);
    coordinator.start();
    assert.strictEqual(coordinator.currentPath, '/memory');
    coordinator.stop();
  });

  it('loads generated targets through the route context into a memory adapter', function () {
    const adapter = new MemoryPathAdapter('/products/ice-cream');
    const root = new RouteContext(null, '*');
    const products = root.createChild('/products/:id') as RouteContext;
    products.createChild('reviews');
    const coordinator = new RouteCoordinator(root, adapter);

    coordinator.start();
    products.load('reviews', {}, { query: { sort: 'recent' } });

    assert.strictEqual(adapter.getCurrentPath(), '/products/ice-cream/reviews?sort=recent');
    assert.strictEqual(coordinator.currentPath, '/products/ice-cream/reviews');
    coordinator.stop();
  });

  it('resolves an adapter key or factory from routing configuration', function () {
    class CustomAdapter extends MemoryPathAdapter {}

    const keyedContainer = DI.createContainer();
    keyedContainer.register(
      Registration.singleton(CustomAdapter, CustomAdapter),
      Routing.customize({ adapter: CustomAdapter }),
    );
    assert.strictEqual(keyedContainer.get(IPathAdapter), keyedContainer.get(CustomAdapter));

    const factoryContainer = DI.createContainer();
    const factoryAdapter = new MemoryPathAdapter('/factory');
    factoryContainer.register(Routing.customize({
      adapterFactory: container => {
        assert.strictEqual(container, factoryContainer);
        return factoryAdapter;
      },
    }));
    assert.strictEqual(factoryContainer.get(IPathAdapter), factoryAdapter);
  });
});

describe('browser base paths', function () {
  it('derives the mount path from a same-origin base element', function () {
    const dom = new JSDOM(
      '<!doctype html><base href="/store/"><body><a href="products/camera">Camera</a></body>',
      { url: 'https://example.test/store/products?sort=recent#details' },
    );
    const window = dom.window as unknown as Window;
    const adapter = new BrowserPathAdapter(window, { interceptLinks: true });
    const navigations: string[] = [];
    const unsubscribe = adapter.subscribe(path => navigations.push(path));

    try {
      assert.strictEqual(adapter.getCurrentPath(), '/products?sort=recent#details');
      assert.strictEqual(adapter.formatHref('/products/camera?tab=specs#weight'), '/store/products/camera?tab=specs#weight');
      assert.strictEqual(adapter.formatHref('/'), '/store/');

      const anchor = window.document.querySelector('a')!;
      assert.strictEqual(anchor.href, 'https://example.test/store/products/camera');
      const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      anchor.dispatchEvent(event);

      assert.strictEqual(event.defaultPrevented, true);
      assert.strictEqual(window.location.pathname, '/store/products/camera');
      assert.deepStrictEqual(navigations, ['/products/camera']);
    } finally {
      unsubscribe();
      dom.window.close();
    }
  });

  it('accepts an absolute same-origin base and ignores a cross-origin base', function () {
    const sameOriginDom = new JSDOM(
      '<!doctype html><base href="https://example.test/store/"><body></body>',
      { url: 'https://example.test/store/products' },
    );
    const crossOriginDom = new JSDOM(
      '<!doctype html><base href="https://cdn.example.test/assets/"><body></body>',
      { url: 'https://example.test/products' },
    );
    const sameOrigin = new BrowserPathAdapter(sameOriginDom.window as unknown as Window);
    const crossOrigin = new BrowserPathAdapter(crossOriginDom.window as unknown as Window);

    assert.strictEqual(sameOrigin.getCurrentPath(), '/products');
    assert.strictEqual(sameOrigin.formatHref('/products'), '/store/products');
    assert.strictEqual(crossOrigin.getCurrentPath(), '/products');
    assert.strictEqual(crossOrigin.formatHref('/products'), '/products');

    sameOriginDom.window.close();
    crossOriginDom.window.close();
  });

  it('uses an explicit normalized base path and rejects pathname lookalikes', function () {
    const dom = new JSDOM('<!doctype html><base href="/ignored/"><body></body>', {
      url: 'https://example.test/application/products',
    });
    const window = dom.window as unknown as Window;
    class InspectableBrowserPathAdapter extends BrowserPathAdapter {
      public read(href: string): string | null {
        return this.routeFromUrl(new URL(href));
      }
    }
    const adapter = new InspectableBrowserPathAdapter(window, { basePath: 'application/' });

    assert.strictEqual(adapter.getCurrentPath(), '/products');
    assert.strictEqual(adapter.formatHref('/products'), '/application/products');

    window.history.replaceState(null, '', '/application');
    assert.strictEqual(adapter.getCurrentPath(), '/');
    window.history.replaceState(null, '', '/application/');
    assert.strictEqual(adapter.getCurrentPath(), '/');
    window.history.replaceState(null, '', '/applications/products');
    assert.strictEqual(adapter.getCurrentPath(), '/');
    assert.strictEqual(adapter.read('https://example.test/applications/products'), null);
    dom.window.close();
  });

  it('keeps hash and query routes on the mounted document', function () {
    const hashDom = new JSDOM('<!doctype html><base href="/store/"><body></body>', {
      url: 'https://example.test/store/#products/camera?sort=recent#details',
    });
    const queryDom = new JSDOM('<!doctype html><base href="/store/"><body></body>', {
      url: 'https://example.test/store/?app=products/camera&sort=recent#details',
    });
    const hash = new BrowserHashAdapter(hashDom.window as unknown as Window);
    const query = new BrowserQueryAdapter(queryDom.window as unknown as Window, { routeQueryKey: 'app' });

    assert.strictEqual(hash.getCurrentPath(), '/products/camera?sort=recent#details');
    assert.strictEqual(hash.formatHref('/products/camera?sort=recent#details'), '/store/#products/camera?sort=recent#details');
    assert.strictEqual(query.getCurrentPath(), '/products/camera?sort=recent#details');
    assert.strictEqual(query.formatHref('/products/camera?sort=recent#details'), '/store/?app=products/camera&sort=recent#details');

    hashDom.window.close();
    queryDom.window.close();
  });

  it('rejects query and fragment data in an explicit base path', function () {
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://example.test/' });
    const window = dom.window as unknown as Window;

    assert.throws(
      () => new BrowserPathAdapter(window, { basePath: '/app?tenant=one' }),
      /basePath must contain only a URL pathname/,
    );
    assert.throws(
      () => new BrowserPathAdapter(window, { basePath: '/app#shell' }),
      /basePath must contain only a URL pathname/,
    );
    dom.window.close();
  });
});
