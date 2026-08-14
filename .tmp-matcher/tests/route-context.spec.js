"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const route_context_1 = require("../router/route-context");
run('A1 static full match leaves root residue', () => {
    const route = new route_context_1.RouteContext(null, '/store');
    route.apply('/store');
    strict_1.default.equal(route.active, true);
    strict_1.default.deepEqual({ ...route.$params }, {});
    strict_1.default.equal(route.residue, '/');
});
run('A1 parameter match extracts params and residue', () => {
    const route = new route_context_1.RouteContext(null, '/store/:storeId');
    route.apply('/store/123/order');
    strict_1.default.equal(route.active, true);
    strict_1.default.deepEqual({ ...route.$params }, { storeId: '123' });
    strict_1.default.equal(route.residue, '/order');
});
run('A1 non-match deactivates and clears params', () => {
    const route = new route_context_1.RouteContext(null, '/store/:storeId');
    route.apply('/store/123');
    route.apply('/users/123');
    strict_1.default.equal(route.active, false);
    strict_1.default.deepEqual({ ...route.$params }, {});
    strict_1.default.equal(route.residue, '/');
});
run('A1 child contexts react to parent residue changes', () => {
    const root = new route_context_1.RouteContext(null, '*');
    const store = root.createChild('/store');
    const detail = store.createChild('/:storeId');
    root.apply('/store/123');
    strict_1.default.equal(store.active, true);
    strict_1.default.equal(detail.active, true);
    strict_1.default.deepEqual({ ...detail.$params }, { storeId: '123' });
    root.apply('/store/456/order');
    strict_1.default.equal(store.active, true);
    strict_1.default.equal(detail.active, true);
    strict_1.default.deepEqual({ ...detail.$params }, { storeId: '456' });
    strict_1.default.equal(detail.residue, '/order');
});
run('A2 trailing slash normalizes to same state', () => {
    const route = new route_context_1.RouteContext(null, '/store/:storeId');
    route.apply('/store/123/');
    strict_1.default.equal(route.active, true);
    strict_1.default.deepEqual({ ...route.$params }, { storeId: '123' });
    strict_1.default.equal(route.residue, '/');
});
run('A2 repeated apply keeps stable state', () => {
    const route = new route_context_1.RouteContext(null, '/store/:storeId');
    route.apply('/store/123/order');
    const firstParams = route.$params;
    const firstResidue = route.residue;
    route.apply('/store/123/order');
    strict_1.default.deepEqual(route.$params, firstParams);
    strict_1.default.equal(route.residue, firstResidue);
    strict_1.default.equal(route.active, true);
});
run('A2 disposed children stop receiving updates', () => {
    const root = new route_context_1.RouteContext(null, '*');
    const store = root.createChild('/store');
    const detail = store.createChild('/:storeId');
    root.apply('/store/123');
    strict_1.default.equal(detail.active, true);
    detail.dispose();
    root.apply('/store/456');
    strict_1.default.equal(store.children.length, 0);
});
console.log('route-context tests passed');
function run(name, fn) {
    try {
        fn();
        console.log(`ok ${name}`);
    }
    catch (error) {
        console.error(`not ok ${name}`);
        throw error;
    }
}
