import { DI, Registration } from '@aurelia/kernel';
import { assert } from '@aurelia/testing';
import { Routing } from '../router/configuration';
import { IRouteCoordinator, RouteCoordinator } from '../router/coordinator';
import { MemoryPathAdapter } from '../router/memory-path-adapter';
import { IPathAdapter } from '../router/path-adapter';
import { RouteContext } from '../router/route-context';

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
