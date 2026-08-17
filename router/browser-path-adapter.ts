import type { IPathAdapter } from './path-adapter';
import { createRouteQuery, normalizeRoutePath, parseRouteLocation, stringifyRouteLocation } from './route-location';

export type BrowserRoutingMode = 'path' | 'hash' | 'query';

export interface BrowserAdapterOptions {
  interceptLinks?: boolean;
  routingMode?: BrowserRoutingMode;
  routeQueryKey?: string;
}

export class BrowserPathAdapter implements IPathAdapter {
  protected readonly routingMode: BrowserRoutingMode;
  protected readonly routeQueryKey: string;

  public constructor(
    protected readonly window: Window,
    protected readonly options: BrowserAdapterOptions = {},
  ) {
    this.routingMode = options.routingMode ?? 'path';
    this.routeQueryKey = options.routeQueryKey?.trim() || 'app';
  }

  public getCurrentPath(): string {
    return this.routeFromUrl(new URL(this.window.location.href)) ?? '/';
  }

  public formatHref(path: string): string {
    const location = parseRouteLocation(path);
    switch (this.routingMode) {
      case 'hash':
        return `#${stringifyRouteLocation(location).replace(/^\//, '') || '/'}`;
      case 'query': {
        const routeValue = location.pathname
          .replace(/^\//, '')
          .split('/')
          .map(encodeURIComponent)
          .join('/');
        const query = location.query.toString();
        const routeEntry = `${encodeURIComponent(this.routeQueryKey)}=${routeValue}`;
        return `?${routeEntry}${query === '' ? '' : `&${query}`}${location.hash === '' ? '' : `#${location.hash}`}`;
      }
      case 'path':
      default:
        return stringifyRouteLocation(location);
    }
  }

  public push(path: string): void {
    this.window.history.pushState(null, '', this.formatHref(path));
  }

  public replace(path: string): void {
    this.window.history.replaceState(this.window.history.state, '', this.formatHref(path));
  }

  public subscribe(callback: (path: string) => void): () => void {
    const onPopState = () => {
      callback(this.getCurrentPath());
    };

    const onClick = (event: MouseEvent) => {
      if (!this.options.interceptLinks || event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = target instanceof Element
        ? target.closest('a[href]')
        : null;

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.hasAttribute('download') || anchor.hasAttribute('external') || anchor.hasAttribute('data-external')) {
        return;
      }

      const anchorTarget = anchor.getAttribute('target');
      if (anchorTarget != null && anchorTarget !== '' && anchorTarget !== '_self' && anchorTarget !== this.window.name) {
        return;
      }

      const url = new URL(anchor.href, this.window.document.baseURI);
      if (url.origin !== this.window.location.origin) {
        return;
      }

      const nextPath = this.routeFromUrl(url);
      if (nextPath == null) {
        return;
      }

      event.preventDefault();
      this.push(nextPath);
      callback(nextPath);
    };

    this.window.addEventListener('popstate', onPopState);
    if (this.options.interceptLinks) {
      this.window.document.addEventListener('click', onClick);
    }

    return () => {
      this.window.removeEventListener('popstate', onPopState);
      if (this.options.interceptLinks) {
        this.window.document.removeEventListener('click', onClick);
      }
    };
  }

  protected routeFromUrl(url: URL): string | null {
    switch (this.routingMode) {
      case 'hash': {
        if (url.hash === '') {
          return '/';
        }
        return stringifyRouteLocation(parseRouteLocation(normalizeRoutePath(url.hash.slice(1))));
      }
      case 'query': {
        if (!url.searchParams.has(this.routeQueryKey)) {
          return null;
        }
        const pathname = normalizeRoutePath(url.searchParams.get(this.routeQueryKey) ?? '/');
        const query = new URLSearchParams(url.search);
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

export class BrowserHashAdapter extends BrowserPathAdapter {
  public constructor(window: Window, options: Omit<BrowserAdapterOptions, 'routingMode'> = {}) {
    super(window, { ...options, routingMode: 'hash' });
  }
}

export class BrowserQueryAdapter extends BrowserPathAdapter {
  public constructor(window: Window, options: Omit<BrowserAdapterOptions, 'routingMode'> = {}) {
    super(window, { ...options, routingMode: 'query' });
  }
}
