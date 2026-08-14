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
