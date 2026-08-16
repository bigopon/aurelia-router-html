import assert from 'node:assert/strict';
import { RouteContext } from '../router/route-context';
import { createRouteHref, createRouteQuery, parseRouteLocation, stringifyRouteLocation } from '../router/route-location';

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

for (const pattern of ['.', './']) {
  run(`A1 ${pattern} matches the current context index like /`, () => {
    const root = new RouteContext(null, '*');
    const products = root.createChild('/products') as RouteContext;
    const index = products.createChild(pattern) as RouteContext;

    root.apply('/products');
    assert.equal(index.pattern, '/');
    assert.equal(index.fullPath, '/products');
    assert.equal(index.active, true);
    assert.equal(products.href(pattern), '/products');

    root.apply('/products/details');
    assert.equal(index.active, false);
  });
}

run('A1 product and ./product are equivalent context-relative route patterns', () => {
  const root = new RouteContext(null, '*');
  const section = root.createChild('section') as RouteContext;
  const plain = section.createChild('product') as RouteContext;
  const dotted = section.createChild('./product') as RouteContext;

  root.apply('/section/product');

  assert.equal(plain.pattern, '/product');
  assert.equal(dotted.pattern, '/product');
  assert.equal(plain.fullPath, '/section/product');
  assert.equal(dotted.fullPath, '/section/product');
  assert.equal(plain.active, true);
  assert.equal(dotted.active, true);
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

run('A3 query and hash state propagate without participating in path matching', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products', { exact: true }) as RouteContext;
  const query = createRouteQuery('sort=price&tag=cold&tag=sale');

  root.apply('/products', { query, hash: 'reviews' });

  assert.equal(products.active, true);
  assert.equal(products.$query.get('sort'), 'price');
  assert.deepEqual(products.$query.getAll('tag'), ['cold', 'sale']);
  assert.equal(products.$hash, 'reviews');
});

run('A3 href generation adds and preserves query and hash state before adapter formatting', () => {
  const root = new RouteContext(null, '*', { hrefFormatter: href => `route:${href}` });
  const products = root.createChild('/products/:productId') as RouteContext;
  products.createChild('/reviews');
  root.apply('/products/ice-cream/reviews', {
    query: createRouteQuery('sort=recent'),
    hash: 'comments',
  });

  assert.equal(
    products.href('./reviews', {}, { query: { page: 2, tag: ['cold', 'sale'] }, hash: 'top' }),
    'route:/products/ice-cream/reviews?page=2&tag=cold&tag=sale#top',
  );
  assert.equal(
    products.href('reviews', {}, { preserveQuery: true, preserveHash: true }),
    'route:/products/ice-cream/reviews?sort=recent#comments',
  );
});

run('A3 route locations round-trip repeated and encoded URL state', () => {
  const location = parseRouteLocation('/search?tag=ice%20cream&tag=caf%C3%A9#customer%20reviews');

  assert.equal(location.pathname, '/search');
  assert.deepEqual(location.query.getAll('tag'), ['ice cream', 'café']);
  assert.equal(location.hash, 'customer%20reviews');
  assert.equal(stringifyRouteLocation(location), '/search?tag=ice+cream&tag=caf%C3%A9#customer%20reviews');
});

run('A3 href options can clear or selectively preserve URL state', () => {
  const query = createRouteQuery('sort=popular&tag=cold');

  assert.equal(createRouteHref('/products', query, 'reviews', { query: null, preserveHash: true }), '/products#reviews');
  assert.equal(createRouteHref('/products', query, 'reviews', { preserveQuery: true, hash: null }), '/products?sort=popular&tag=cold');
});

run('A4 active links use prefix matching by default and exact matching on demand', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products/:productId') as RouteContext;
  const reviews = products.createChild('/reviews') as RouteContext;
  products.createChild('/') as RouteContext;
  root.apply('/products/ice-cream/reviews');

  assert.equal(products.isActive(products), true);
  assert.equal(products.isActive(products, {}, { exact: true }), false);
  assert.equal(products.isActive(reviews, {}, { exact: true }), true);
  assert.equal(root.isActive('/products/:productId', { productId: 'coffee' }), false);
  assert.equal(root.isActive('/', {}, { exact: false }), false);
});

run('A4 active links generate nested, index, and terminal targets with active parameters', () => {
  const root = new RouteContext(null, '*');
  const files = root.createChild('/files/:bucket') as RouteContext;
  const index = files.createChild('/') as RouteContext;
  const terminal = files.createChild('/view/**') as RouteContext;

  root.apply('/files/manuals');
  assert.equal(files.isActive(index, {}, { exact: true }), true);

  root.apply('/files/manuals/view/guides/start.html');
  assert.equal(terminal.isActive(terminal, {}, { exact: true }), true);
  assert.equal(terminal.isActive(terminal, { '**': 'guides/other.html' }, { exact: true }), false);
});

run('A4 query and hash comparison is opt-in for active links', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products') as RouteContext;
  root.apply('/products', {
    query: createRouteQuery('tag=cold&tag=sale&sort=popular'),
    hash: 'reviews',
  });

  assert.equal(products.isActive(products, {}, { query: { sort: 'price' }, hash: 'details' }), true);
  assert.equal(products.isActive(products, {}, {
    query: { sort: 'popular', tag: ['cold', 'sale'] },
    matchQuery: true,
  }), true);
  assert.equal(products.isActive(products, {}, { query: { sort: 'price' }, matchQuery: true }), false);
  assert.equal(products.isActive(products, {}, { hash: 'reviews', matchHash: true }), true);
  assert.equal(products.isActive(products, {}, { hash: 'details', matchHash: true }), false);
});

run('A4 disposed route contexts cannot remain active link targets', () => {
  const root = new RouteContext(null, '*');
  const generated = root.createChild('/generated') as RouteContext;
  root.apply('/generated');
  assert.equal(root.isActive(generated), true);

  generated.dispose();
  assert.equal(root.isActive(generated), false);
});

run('A4 an unregistered active-link target is inactive instead of throwing', () => {
  const root = new RouteContext(null, '*');

  assert.equal(root.href('/later'), '/later');
  assert.equal(root.isActive('/later'), false);
  root.apply('/later');
  assert.equal(root.isActive('/later', {}, { exact: true }), true);
});

run('A4 route registry changes notify link subscribers', () => {
  const root = new RouteContext(null, '*');
  let notifications = 0;
  root._subscribeRegistry(() => notifications++);

  const later = root.createChild('/later');
  assert.equal(notifications, 1);

  later.dispose();
  assert.equal(notifications, 2);
});

run('A4 link targets distinguish context-relative and root-absolute paths', () => {
  const root = new RouteContext(null, '*');
  root.createChild('/product');
  const section = root.createChild('/section') as RouteContext;
  section.createChild('product');
  root.apply('/section/product');

  assert.equal(section.href('product'), '/section/product');
  assert.equal(section.href('./product'), '/section/product');
  assert.equal(section.href('/product'), '/product');
  assert.equal(section.isActive('product', {}, { exact: true }), true);
  assert.equal(section.isActive('./product', {}, { exact: true }), true);
  assert.equal(section.isActive('/product', {}, { exact: true }), false);
});

run('A4 concrete links resolve parameter, prefix, terminal, and fallback routes', () => {
  const root = new RouteContext(null, '*');
  root.createChild('/products/:productId', { exact: true });
  root.createChild('/known');
  root.createChild('/files/**');
  root.createChild('*', { fallback: true });

  assert.equal(root.href('/products/camera'), '/products/camera');
  assert.equal(root.href('/known/details'), '/known/details');
  assert.equal(root.href('/files/guides/router/start.html'), '/files/guides/router/start.html');
  assert.equal(root.href('/missing'), '/missing');

  root.apply('/files/guides/router/start.html');
  assert.equal(root.isActive('/files/guides/router/start.html', {}, { exact: true }), true);
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

run('A2 registered paths can be listed from root or a nested context', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products/:productId') as RouteContext;
  products.createChild('/reviews');
  const specs = products.createChild('/specs') as RouteContext;
  root.createChild('/account');

  assert.deepEqual(root.getPaths(), [
    '/products/:productId',
    '/products/:productId/reviews',
    '/products/:productId/specs',
    '/account',
  ]);
  assert.deepEqual(products.getPaths(false), [
    '/products/:productId/reviews',
    '/products/:productId/specs',
  ]);

  specs.usePattern('/details');
  assert.deepEqual(products.getPaths(false), [
    '/products/:productId/reviews',
    '/products/:productId/details',
  ]);
  specs.dispose();
  assert.deepEqual(products.getPaths(false), ['/products/:productId/reviews']);
});

run('A2 href generation resolves descendants and active route parameters', () => {
  const root = new RouteContext(null, '*');
  const products = root.createChild('/products/:productId') as RouteContext;
  products.createChild('/reviews');
  products.createChild('/specs');

  assert.equal(
    root.href('/products/:productId/reviews', { productId: 'blue sky' }),
    '/products/blue%20sky/reviews',
  );

  root.apply('/products/aster-pack/reviews');
  assert.equal(products.href('./specs'), '/products/aster-pack/specs');
  assert.throws(
    () => root.href('/products/:productId/specs'),
    /Route parameter "productId" is required/,
  );
  assert.equal(products.href('missing'), '/products/aster-pack/missing');
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

run('A2 required and optional parameters differ at the missing segment', () => {
  const root = new RouteContext(null, '*');
  const required = root.createChild('/products/:id', { exact: true }) as RouteContext;
  const optional = root.createChild('/offers/:id?', { exact: true }) as RouteContext;

  root.apply('/products');
  assert.equal(required.active, false);

  root.apply('/products/camera');
  assert.equal(required.active, true);
  assert.deepEqual({ ...required.$params }, { id: 'camera' });

  root.apply('/offers');
  assert.equal(optional.active, true);
  assert.deepEqual({ ...optional.$params }, {});

  root.apply('/offers/summer');
  assert.equal(optional.active, true);
  assert.deepEqual({ ...optional.$params }, { id: 'summer' });
  assert.equal(root.href('/offers/:id?'), '/offers');
  assert.equal(optional.href(optional), '/offers/summer');
  assert.equal(root.href('/offers/:id?', { id: 'winter' }), '/offers/winter');
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
  assert.deepEqual({ ...catchAll.$params }, { '**': 'products/abc/details' });
  assert.equal(index.active, true);
  assert.equal(consumedSegment.active, false);
});

run('A2 prefixed rest wildcard consumes the complete suffix', () => {
  const root = new RouteContext(null, '*');
  const files = root.createChild('/files/**') as RouteContext;

  root.apply('/files/guides/router/start');

  assert.equal(files.active, true);
  assert.equal(files.residue, '/');
  assert.deepEqual({ ...files.$params }, { '**': 'guides/router/start' });
});

run('A2 prefixed rest wildcard exposes an empty terminal segment when only its prefix matches', () => {
  const root = new RouteContext(null, '*');
  const files = root.createChild('/files/**') as RouteContext;

  root.apply('/files');

  assert.equal(files.active, true);
  assert.deepEqual({ ...files.$params }, { '**': '' });
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
