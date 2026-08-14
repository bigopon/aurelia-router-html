import { IContainer, Registration } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import { AppTask } from 'aurelia';
import { AuRoute } from './au-route';
import { BrowserPathAdapter, type BrowserAdapterOptions } from './browser-path-adapter';
import { IRouteCoordinator, RouteCoordinator } from './coordinator';
import { IRouteContext, RouteContext } from './route-context';

type IRoutingOptions = BrowserAdapterOptions;

const registerRouting = (options: IRoutingOptions = {}) => (c: IContainer) => {
  const window = c.get(IWindow);
  const rootContext = new RouteContext(null, '*');
  const coordinator = new RouteCoordinator(rootContext, new BrowserPathAdapter(window, options));

  c.register(
    AuRoute,
    Registration.instance(IRouteContext, rootContext),
    Registration.instance(IRouteCoordinator, coordinator),
    AppTask.creating(() => {
      coordinator.start();
    }),
    AppTask.deactivated(() => {
      coordinator.stop();
    }),
  );
};

export const Routing = {
  register: registerRouting({}),
  customize: (options: IRoutingOptions) => ({
    register: registerRouting(options),
  }),
};
