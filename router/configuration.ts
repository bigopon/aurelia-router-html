import { IContainer, Registration } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import { AppTask } from 'aurelia';
import { normalizeRouteAnimationOptions, IRouteAnimationOptions, type RouteAnimationInput } from './animation';
import { AuRoute } from './au-route';
import { AuLink } from './au-link';
import { BrowserPathAdapter, type BrowserAdapterOptions } from './browser-path-adapter';
import { IRouteCoordinator, RouteCoordinator } from './coordinator';
import { IRouteContext, RouteContext, type SwapOrder } from './route-context';

export interface RoutingOptions extends BrowserAdapterOptions {
  swapOrder?: SwapOrder;
  animations?: RouteAnimationInput;
}

const registerRouting = (options: RoutingOptions = {}) => (c: IContainer) => {
  const window = c.get(IWindow);
  const animationOptions = normalizeRouteAnimationOptions(options.animations);
  const adapter = new BrowserPathAdapter(window, options);
  const rootContext = new RouteContext(null, '*', {
    swapOrder: options.swapOrder,
    hrefFormatter: path => adapter.formatHref(path),
  });
  const coordinator = new RouteCoordinator(rootContext, adapter);

  c.register(
    AuRoute,
    AuLink,
    Registration.instance(IRouteAnimationOptions, animationOptions),
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
  customize: (options: RoutingOptions) => ({
    register: registerRouting(options),
  }),
};
