import { tasksSettled } from '@aurelia/runtime';
import { assert, createFixture } from '@aurelia/testing';
import { Routing } from '../router/configuration';
import { IRouteCoordinator } from '../router/coordinator';

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
});
