import assert from 'node:assert/strict';
import { RouteContext } from '../router/route-context';

run('A1 static full match leaves root residue', () => {
  const route = new RouteContext(null, '/store');
  route.apply('/store');

  assert.equal(route.active, true);
  assert.deepEqual({ ...route.$params }, {});
  assert.equal(route.residue, '/');
});

run('A1 parameter match extracts params and residue', () => {
  const route = new RouteContext(null, '/store/:storeId');
  route.apply('/store/123/order');

  assert.equal(route.active, true);
  assert.deepEqual({ ...route.$params }, { storeId: '123' });
  assert.equal(route.residue, '/order');
});

run('A1 non-match deactivates and clears params', () => {
  const route = new RouteContext(null, '/store/:storeId');
  route.apply('/store/123');
  route.apply('/users/123');

  assert.equal(route.active, false);
  assert.deepEqual({ ...route.$params }, {});
  assert.equal(route.residue, '/');
});

run('A1 child contexts react to parent residue changes', () => {
  const root = new RouteContext(null, '*');
  const store = root.createChild('/store') as RouteContext;
  const detail = store.createChild('/:storeId') as RouteContext;

  root.apply('/store/123');
  assert.equal(store.active, true);
  assert.equal(detail.active, true);
  assert.deepEqual({ ...detail.$params }, { storeId: '123' });

  root.apply('/store/456/order');
  assert.equal(store.active, true);
  assert.equal(detail.active, true);
  assert.deepEqual({ ...detail.$params }, { storeId: '456' });
  assert.equal(detail.residue, '/order');
});

run('A2 trailing slash normalizes to same state', () => {
  const route = new RouteContext(null, '/store/:storeId');
  route.apply('/store/123/');

  assert.equal(route.active, true);
  assert.deepEqual({ ...route.$params }, { storeId: '123' });
  assert.equal(route.residue, '/');
});

run('A2 repeated apply keeps stable state', () => {
  const route = new RouteContext(null, '/store/:storeId');
  route.apply('/store/123/order');
  const firstParams = route.$params;
  const firstResidue = route.residue;
  route.apply('/store/123/order');

  assert.deepEqual(route.$params, firstParams);
  assert.equal(route.residue, firstResidue);
  assert.equal(route.active, true);
});

run('A2 disposed children stop receiving updates', () => {
  const root = new RouteContext(null, '*');
  const store = root.createChild('/store') as RouteContext;
  const detail = store.createChild('/:storeId') as RouteContext;

  root.apply('/store/123');
  assert.equal(detail.active, true);

  detail.dispose();
  root.apply('/store/456');

  assert.equal(store.children.length, 0);
});

run('A2 newly added non-matching route leaves the active sibling unchanged', () => {
  const root = new RouteContext(null, '*');
  const overview = root.createChild('/overview') as RouteContext;

  root.apply('/overview');
  const generated = root.createChild('/generated') as RouteContext;

  assert.equal(overview.active, true);
  assert.equal(generated.active, false);
});

run('A2 newly added matching route activates for the current residue', () => {
  const root = new RouteContext(null, '*');

  root.apply('/generated');
  const generated = root.createChild('/generated') as RouteContext;

  assert.equal(generated.active, true);
  assert.equal(generated.residue, '/');
});

run('A2 exact route matches only an individual complete path', () => {
  const settings = new RouteContext(null, '/settings', { exact: true });

  settings.apply('/settings');
  assert.equal(settings.active, true);
  assert.equal(settings.residue, '/');

  settings.apply('/settings/profile');
  assert.equal(settings.active, false);
});

run('A2 nested exact route matches only the residue from its parent', () => {
  const root = new RouteContext(null, '*');
  const account = root.createChild('/account') as RouteContext;
  const settings = account.createChild('/settings', { exact: true }) as RouteContext;

  root.apply('/account/settings');
  assert.equal(account.active, true);
  assert.equal(account.residue, '/settings');
  assert.equal(settings.active, true);
  assert.equal(settings.residue, '/');

  root.apply('/account/settings/profile');
  assert.equal(account.active, true);
  assert.equal(account.residue, '/settings/profile');
  assert.equal(settings.active, false);
});

run('A2 individual fallback route activates only without a regular sibling match', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products') as RouteContext;
  const fallback = root.createChild('*', { fallback: true }) as RouteContext;

  root.apply('/products/123');
  assert.equal(products.active, true);
  assert.equal(fallback.active, false);

  root.apply('/missing');
  assert.equal(products.active, false);
  assert.equal(fallback.active, true);
  assert.equal(fallback.residue, '/');
});

run('A2 nested fallback route uses matching results from its parent context', () => {
  const root = new RouteContext(null, '*');
  const account = root.createChild('/account') as RouteContext;
  const settings = account.createChild('/settings') as RouteContext;
  const fallback = account.createChild('*', { fallback: true }) as RouteContext;

  root.apply('/account/settings/profile');
  assert.equal(account.active, true);
  assert.equal(settings.active, true);
  assert.equal(settings.residue, '/profile');
  assert.equal(fallback.active, false);

  root.apply('/account/missing');
  assert.equal(account.active, true);
  assert.equal(account.residue, '/missing');
  assert.equal(settings.active, false);
  assert.equal(fallback.active, true);
  assert.equal(fallback.residue, '/');

  root.apply('/outside');
  assert.equal(account.active, false);
  assert.equal(fallback.active, false);
});

run('A2 exact sibling yields to a wildcard fallback with an exact child', () => {
  const root = new RouteContext(null, '*');
  const productsIndex = root.createChild('/products', { exact: true }) as RouteContext;
  const productsFallback = root.createChild('*', { fallback: true }) as RouteContext;
  const productAbc = productsFallback.createChild('/abc', { exact: true }) as RouteContext;

  root.apply('/products');
  assert.equal(productsIndex.active, true);
  assert.equal(productsFallback.active, false);
  assert.equal(productAbc.active, false);

  root.apply('/products/abc');
  assert.equal(productsIndex.active, false);
  assert.equal(productsFallback.active, true);
  assert.equal(productsFallback.residue, '/abc');
  assert.equal(productAbc.active, true);
  assert.equal(productAbc.residue, '/');

  root.apply('/products/abc/details');
  assert.equal(productsIndex.active, false);
  assert.equal(productsFallback.active, true);
  assert.equal(productsFallback.residue, '/abc/details');
  assert.equal(productAbc.active, false);
});

run('A2 wildcard patterns normalize an optional leading slash', () => {
  const root = new RouteContext(null, '*');
  const withoutSlash = root.createChild('*') as RouteContext;
  const withSlash = root.createChild('/*') as RouteContext;

  root.apply('/products/abc');

  assert.equal(withoutSlash.pattern, '*');
  assert.equal(withSlash.pattern, '*');
  assert.equal(withoutSlash.active, true);
  assert.equal(withSlash.active, true);
  assert.equal(withoutSlash.residue, '/abc');
  assert.equal(withSlash.residue, '/abc');
});

run('A2 rest wildcard consumes all remaining segments', () => {
  const root = new RouteContext(null, '*');
  const catchAll = root.createChild('**') as RouteContext;
  const index = catchAll.createChild('/', { exact: true }) as RouteContext;
  const consumedSegment = catchAll.createChild('/abc', { exact: true }) as RouteContext;

  root.apply('/products/abc/details');

  assert.equal(catchAll.active, true);
  assert.equal(catchAll.residue, '/');
  assert.equal(index.active, true);
  assert.equal(consumedSegment.active, false);
});

run('A2 prefixed rest wildcard consumes the complete suffix', () => {
  const root = new RouteContext(null, '*');
  const files = root.createChild('/files/**') as RouteContext;

  root.apply('/files/guides/router/start');

  assert.equal(files.active, true);
  assert.equal(files.residue, '/');
});

run('A2 rest wildcard patterns normalize an optional leading slash', () => {
  const withoutSlash = new RouteContext(null, '**');
  const withSlash = new RouteContext(null, '/**');

  withoutSlash.apply('/products/abc');
  withSlash.apply('/products/abc');

  assert.equal(withoutSlash.pattern, '**');
  assert.equal(withSlash.pattern, '**');
  assert.equal(withoutSlash.residue, '/');
  assert.equal(withSlash.residue, '/');
});

run('A2 wildcard route remains active alongside another matching sibling', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products') as RouteContext;
  const matchAll = root.createChild('*') as RouteContext;

  root.apply('/products/123');

  assert.equal(products.active, true);
  assert.equal(matchAll.active, true);
  assert.equal(matchAll.residue, '/123');
});

run('S1 default swap order activates matching sibling before deactivating old sibling', () => {
  const root = new RouteContext(null, '*');
  const product = root.createChild('/products/:productId') as RouteContext;
  const reviews = product.createChild('/reviews') as RouteContext;
  const specs = product.createChild('/specs') as RouteContext;
  const events: string[] = [];

  reviews.subscribe(state => {
    events.push(`reviews:${state.active ? 'on' : 'off'}`);
  });
  specs.subscribe(state => {
    events.push(`specs:${state.active ? 'on' : 'off'}`);
  });

  root.apply('/products/aster-pack/reviews');
  events.length = 0;

  root.apply('/products/aster-pack/specs');

  assert.deepEqual(events, [
    'specs:on',
    'reviews:off',
  ]);
});

run('S1 detach-current-attach-next preserves opt-out ordering', () => {
  const root = new RouteContext(null, '*', { swapOrder: 'detach-current-attach-next' });
  const product = root.createChild('/products/:productId') as RouteContext;
  const reviews = product.createChild('/reviews') as RouteContext;
  const specs = product.createChild('/specs') as RouteContext;
  const events: string[] = [];

  reviews.subscribe(state => {
    events.push(`reviews:${state.active ? 'on' : 'off'}`);
  });
  specs.subscribe(state => {
    events.push(`specs:${state.active ? 'on' : 'off'}`);
  });

  root.apply('/products/aster-pack/reviews');
  events.length = 0;

  root.apply('/products/aster-pack/specs');

  assert.deepEqual(events, [
    'reviews:off',
    'specs:on',
  ]);
});

run('S1 parallel swap updates sibling branches in one pass', () => {
  const root = new RouteContext(null, '*', { swapOrder: 'parallel' });
  const reviews = root.createChild('/reviews') as RouteContext;
  const specs = root.createChild('/specs') as RouteContext;
  const events: string[] = [];

  reviews.subscribe(state => {
    events.push(`reviews:${state.active ? 'on' : 'off'}`);
  });
  specs.subscribe(state => {
    events.push(`specs:${state.active ? 'on' : 'off'}`);
  });

  root.apply('/reviews');
  events.length = 0;

  root.apply('/specs');

  assert.deepEqual(events, [
    'reviews:off',
    'specs:on',
  ]);
});

console.log('route-context tests passed');

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`not ok ${name}`);
    throw error;
  }
}
