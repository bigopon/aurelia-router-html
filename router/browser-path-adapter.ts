import type { IPathAdapter } from './path-adapter';
import { createRouteQuery, normalizeRoutePath, parseRouteLocation, stringifyRouteLocation } from './route-location';

export type BrowserRoutingMode = 'path' | 'hash' | 'query';

export interface BrowserAdapterOptions {
  interceptLinks?: boolean;
  routingMode?: BrowserRoutingMode;
  routeQueryKey?: string;
  basePath?: string;
}

export class BrowserPathAdapter implements IPathAdapter {
  protected readonly routingMode: BrowserRoutingMode;
  protected readonly routeQueryKey: string;
  protected readonly basePath: string;

  public constructor(
    protected readonly window: Window,
    protected readonly options: BrowserAdapterOptions = {},
  ) {
    this.routingMode = options.routingMode ?? 'path';
    this.routeQueryKey = options.routeQueryKey?.trim() || 'app';
    this.basePath = this.resolveBasePath(options.basePath);
  }

  public getCurrentPath(): string {
    return this.routeFromUrl(new URL(this.window.location.href)) ?? '/';
  }

  public formatHref(path: string): string {
    const location = parseRouteLocation(path);
    switch (this.routingMode) {
      case 'hash':
        return `${this.baseDocumentPath()}#${stringifyRouteLocation(location).replace(/^\//, '') || '/'}`;
      case 'query': {
        const routeValue = location.pathname
          .replace(/^\//, '')
          .split('/')
          .map(encodeURIComponent)
          .join('/');
        const query = location.query.toString();
        const routeEntry = `${encodeURIComponent(this.routeQueryKey)}=${routeValue}`;
        return `${this.baseDocumentPath()}?${routeEntry}${query === '' ? '' : `&${query}`}${location.hash === '' ? '' : `#${location.hash}`}`;
      }
      case 'path':
      default:
        return `${this.pathWithBase(location.pathname)}${location.query.toString() === '' ? '' : `?${location.query}`}${location.hash === '' ? '' : `#${location.hash}`}`;
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
      if (target == null || !('nodeType' in target)) {
        return;
      }

      const node = target as Node;
      const element = node.nodeType === 1 ? node as Element : node.parentElement;
      const anchor = element?.closest<HTMLAnchorElement>('a[href]');

      if (anchor == null) {
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
    const pathname = this.pathWithoutBase(url.pathname);
    if (pathname == null) {
      return null;
    }

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
          pathname,
          query: createRouteQuery(url.search),
          hash: url.hash.slice(1),
        });
    }
  }

  private resolveBasePath(configured: string | undefined): string {
    if (configured != null) {
      if (configured.includes('?') || configured.includes('#')) {
        throw new Error('Browser router basePath must contain only a URL pathname.');
      }
      return normalizeRoutePath(configured);
    }

    const base = this.window.document?.querySelector<HTMLBaseElement>('base[href]');
    if (base == null) {
      return '/';
    }

    const url = new URL(base.href, this.window.location.href);
    return url.origin === this.window.location.origin
      ? normalizeRoutePath(url.pathname)
      : '/';
  }

  private baseDocumentPath(): string {
    return this.basePath === '/' ? '' : `${this.basePath}/`;
  }

  private pathWithBase(pathname: string): string {
    if (this.basePath === '/') {
      return pathname;
    }
    return pathname === '/' ? `${this.basePath}/` : `${this.basePath}${pathname}`;
  }

  private pathWithoutBase(pathname: string): string | null {
    const normalized = normalizeRoutePath(pathname);
    if (this.basePath === '/') {
      return normalized;
    }
    if (normalized === this.basePath) {
      return '/';
    }
    return normalized.startsWith(`${this.basePath}/`)
      ? normalizeRoutePath(normalized.slice(this.basePath.length))
      : null;
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
