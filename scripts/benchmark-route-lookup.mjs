import { performance } from 'node:perf_hooks';
import { RouteContext } from '../dist/index.dev.mjs';

const repetitions = 20;
const scenarios = [
  { routes: 100, links: 50 },
  { routes: 200, links: 100 },
];
const descriptor = Object.getOwnPropertyDescriptor(RouteContext.prototype, 'fullPath');
if (descriptor?.get == null) {
  throw new Error('RouteContext.fullPath is not an accessor.');
}

const results = scenarios.map(({ routes, links }) => {
  const root = new RouteContext(null, '*');
  for (let index = 0; index < routes; index++) {
    root.createChild(`/route-${index}`);
  }
  const targets = Array.from(
    { length: links },
    (_, index) => `/route-${Math.floor(index * routes / links)}`,
  );
  let fullPathEvaluations = 0;
  Object.defineProperty(RouteContext.prototype, 'fullPath', {
    ...descriptor,
    get() {
      fullPathEvaluations++;
      return descriptor.get.call(this);
    },
  });

  const started = performance.now();
  try {
    for (let repetition = 0; repetition < repetitions; repetition++) {
      for (const target of targets) {
        root.href(target);
        root.href(target);
        root.href(target);
      }
    }
  } finally {
    Object.defineProperty(RouteContext.prototype, 'fullPath', descriptor);
  }

  const hrefs = repetitions * links * 3;
  return {
    routes,
    links,
    hrefs,
    milliseconds: (performance.now() - started).toFixed(1),
    fullPathEvaluations,
    evaluationsPerHref: (fullPathEvaluations / hrefs).toFixed(1),
  };
});

console.table(results);
