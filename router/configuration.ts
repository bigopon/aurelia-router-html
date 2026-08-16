import { IContainer, Registration, type Key } from '@aurelia/kernel';
import { IWindow } from '@aurelia/runtime-html';
import { AppTask } from 'aurelia';
import { normalizeRouteAnimationOptions, IRouteAnimationOptions, type RouteAnimationInput } from './animation';
import { AuRoute } from './au-route';
import { AuLink } from './au-link';
import { BrowserPathAdapter, type BrowserAdapterOptions } from './browser-path-adapter';
import { IRouteCoordinator, RouteCoordinator } from './coordinator';
import { IPathAdapter } from './path-adapter';
import { IRouteContext, RouteContext, type SwapOrder } from './route-context';

export interface RoutingOptions extends BrowserAdapterOptions {
  swapOrder?: SwapOrder;
  animations?: RouteAnimationInput;
  adapter?: IPathAdapter | Key;
  adapterFactory?: (container: IContainer) => IPathAdapter;
}

const registerRouting = (options: RoutingOptions = {}) => (c: IContainer) => {
  if (options.adapter != null && options.adapterFactory != null) {
    throw new Error('Routing options cannot specify both adapter and adapterFactory.');
  }

  const adapter = options.adapterFactory?.(c)
    ?? (options.adapter == null
      ? (c.has(IPathAdapter, true)
        ? c.get(IPathAdapter)
        : new BrowserPathAdapter(c.get(IWindow), options))
      : (isPathAdapter(options.adapter)
        ? options.adapter
        : c.get(options.adapter) as IPathAdapter));
  if (!isPathAdapter(adapter)) {
    throw new Error('The configured routing adapter does not implement IPathAdapter.');
  }
  const animationOptions = normalizeRouteAnimationOptions(options.animations);
  const rootContext = new RouteContext(null, '*', {
    swapOrder: options.swapOrder,
    hrefFormatter: path => adapter.formatHref(path),
  });
  const coordinator = new RouteCoordinator(rootContext, adapter);

  c.register(
    AuRoute,
    AuLink,
    Registration.instance(IPathAdapter, adapter),
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

function isPathAdapter(value: unknown): value is IPathAdapter {
  const adapter = value as Partial<IPathAdapter> | null;
  return adapter != null
    && typeof adapter.getCurrentPath === 'function'
    && typeof adapter.formatHref === 'function'
    && typeof adapter.push === 'function'
    && typeof adapter.replace === 'function'
    && typeof adapter.subscribe === 'function';
}

export const Routing = {
  register: registerRouting({}),
  customize: (options: RoutingOptions) => ({
    register: registerRouting(options),
  }),
};
