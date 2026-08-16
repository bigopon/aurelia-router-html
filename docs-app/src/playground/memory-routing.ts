import { IContainer, Registration } from '@aurelia/kernel';
import { AppTask } from 'aurelia';
import { IRouteAnimationOptions, normalizeRouteAnimationOptions, type RouteAnimationInput } from '../../../router/animation';
import { AuRoute } from '../../../router/au-route';
import { AuLink } from '../../../router/au-link';
import { IRouteCoordinator, RouteCoordinator } from '../../../router/coordinator';
import { IPathAdapter, type PathAdapter } from '../../../router/path-adapter';
import { IRouteContext, RouteContext, type SwapOrder } from '../../../router/route-context';
import type { BrowserRoutingMode } from '../../../router/browser-path-adapter';
import { createRouteQuery, normalizeRoutePath, parseRouteLocation, stringifyRouteLocation } from '../../../router/route-location';

interface PlaygroundRoutingOptions {
  swapOrder?: SwapOrder;
  animations?: RouteAnimationInput;
  interceptLinks?: boolean;
  routingMode?: BrowserRoutingMode;
  routeQueryKey?: string;
  adapter?: PathAdapter;
  adapterFactory?: (container: IContainer) => PathAdapter;
}

class MemoryPathAdapter implements PathAdapter {
  private path: string;
  private callback: ((path: string) => void) | null = null;
  private readonly routingMode: BrowserRoutingMode;
  private readonly routeQueryKey: string;

  public constructor(private readonly options: PlaygroundRoutingOptions) {
    this.routingMode = options.routingMode ?? 'path';
    this.routeQueryKey = options.routeQueryKey?.trim() || 'app';
    this.path = this.routeFromHref(globalThis.__PLAYGROUND_INITIAL_PATH__ ?? '/') ?? '/';
  }

  public getCurrentPath(): string {
    return this.path;
  }

  public formatHref(path: string): string {
    const location = parseRouteLocation(path);
    switch (this.routingMode) {
      case 'hash':
        return `#${stringifyRouteLocation(location).replace(/^\//, '')}`;
      case 'query': {
        const routeValue = location.pathname
          .replace(/^\//, '')
          .split('/')
          .map(encodeURIComponent)
          .join('/');
        const query = location.query.toString();
        return `?${encodeURIComponent(this.routeQueryKey)}=${routeValue}${query === '' ? '' : `&${query}`}${location.hash === '' ? '' : `#${location.hash}`}`;
      }
      case 'path':
      default:
        return stringifyRouteLocation(location);
    }
  }

  public push(path: string): void {
    this.setPath(path, false);
  }

  public replace(path: string): void {
    this.setPath(path, false);
  }

  public subscribe(callback: (path: string) => void): () => void {
    this.callback = callback;
    document.addEventListener('click', this.onClick);
    return () => {
      document.removeEventListener('click', this.onClick);
      this.callback = null;
    };
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (!this.options.interceptLinks || event.defaultPrevented || event.button !== 0) {
      return;
    }
    const target = event.target;
    const anchor = target instanceof Element ? target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('data-external')) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (href == null || /^[a-z]+:/i.test(href)) {
      return;
    }
    const next = this.routeFromHref(href);
    if (next == null) {
      return;
    }
    event.preventDefault();
    this.setPath(next, true);
  };

  private setPath(path: string, notify: boolean): void {
    this.path = stringifyRouteLocation(parseRouteLocation(path));
    if (notify) {
      this.callback?.(this.path);
    }
    window.parent.postMessage({
      channel: 'router-html-playground',
      type: 'navigation',
      path: this.formatHref(this.path),
    }, '*');
  }

  private routeFromHref(href: string): string | null {
    const url = new URL(href, 'https://playground.invalid/');
    switch (this.routingMode) {
      case 'hash':
        return url.hash === ''
          ? null
          : stringifyRouteLocation(parseRouteLocation(normalizeRoutePath(url.hash.slice(1))));
      case 'query': {
        if (!url.searchParams.has(this.routeQueryKey)) {
          return null;
        }
        const query = new URLSearchParams(url.search);
        const pathname = normalizeRoutePath(query.get(this.routeQueryKey) ?? '/');
        query.delete(this.routeQueryKey);
        return stringifyRouteLocation({
          pathname,
          query: createRouteQuery(query),
          hash: url.hash.slice(1),
        });
      }
      case 'path':
      default:
        return stringifyRouteLocation({
          pathname: normalizeRoutePath(url.pathname),
          query: createRouteQuery(url.search),
          hash: url.hash.slice(1),
        });
    }
  }
}

export function createPlaygroundRouting() {
  const register = (options: PlaygroundRoutingOptions = {}) => (container: IContainer) => {
    if (options.adapter != null && options.adapterFactory != null) {
      throw new Error('Routing options cannot specify both adapter and adapterFactory.');
    }
    const adapter = options.adapterFactory?.(container)
      ?? options.adapter
      ?? new MemoryPathAdapter(options);
    const root = new RouteContext(null, '*', {
      swapOrder: options.swapOrder,
      hrefFormatter: path => adapter.formatHref(path),
    });
    const coordinator = new RouteCoordinator(root, adapter);
    container.register(
      AuRoute,
      AuLink,
      Registration.instance(IPathAdapter, adapter),
      Registration.instance(IRouteAnimationOptions, normalizeRouteAnimationOptions(options.animations)),
      Registration.instance(IRouteContext, root),
      Registration.instance(IRouteCoordinator, coordinator),
      AppTask.creating(() => coordinator.start()),
      AppTask.deactivated(() => coordinator.stop()),
    );
  };
  return {
    register: register({}),
    customize: (options: PlaygroundRoutingOptions) => ({ register: register(options) }),
  };
}

declare global {
  var __PLAYGROUND_INITIAL_PATH__: string | undefined;
}
