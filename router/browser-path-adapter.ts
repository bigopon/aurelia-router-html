import type { IPathAdapter, PathNavigation } from './path-adapter';
import { createRouteQuery, normalizeRoutePath, parseRouteLocation, stringifyRouteLocation } from './route-location';

export type BrowserRoutingMode = 'path' | 'hash' | 'query';

export interface BrowserAdapterOptions {
  interceptLinks?: boolean;
  routingMode?: BrowserRoutingMode;
  routeQueryKey?: string;
  basePath?: string;
}

interface BrowserHistoryEntry {
  readonly key: string;
  readonly index: number;
}

interface BrowserNavigationEntry {
  readonly index: number;
}

interface BrowserNavigation {
  readonly currentEntry: BrowserNavigationEntry | null;
}

type BrowserWindow = Window & {
  readonly navigation?: BrowserNavigation;
};

const browserHistoryEntryKey = '__auRouteNavigationEntry';

export class BrowserPathAdapter implements IPathAdapter {
  /** @internal */
  protected readonly routingMode: BrowserRoutingMode;
  /** @internal */
  protected readonly routeQueryKey: string;
  /** @internal */
  protected readonly basePath: string;
  /** @internal */
  private historyKey: string | null = null;
  /** @internal */
  private historyIndex: number = 0;
  /** @internal */
  private acceptedNavigationIndex: number | null = null;
  /** @internal */
  private acceptedHref: string | null = null;
  /** @internal */
  private acceptedState: unknown = null;
  /** @internal */
  private compensatingPop: { expectedIndex: number; resolve: () => void } | null = null;
  /** @internal */
  protected readonly window: Window;
  /** @internal */
  protected readonly options: BrowserAdapterOptions;

  public constructor(
    window: Window,
    options: BrowserAdapterOptions = {},
  ) {
    this.window = window;
    this.options = options;
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
    this.ensureHistoryEntry();
    const index = this.historyIndex + 1;
    this.window.history.pushState(this.withHistoryEntry(null, index), '', this.formatHref(path));
    this.acceptHistoryEntry(index);
  }

  public replace(path: string): void {
    this.ensureHistoryEntry();
    this.window.history.replaceState(this.withHistoryEntry(this.window.history.state, this.historyIndex), '', this.formatHref(path));
    this.acceptHistoryEntry(this.historyIndex);
  }

  public subscribe(callback: (path: string, navigation?: PathNavigation) => void): () => void {
    this.ensureHistoryEntry();
    const onPopState = () => {
      const entry = this.readHistoryEntry();
      const compensation = this.compensatingPop;
      if (compensation != null && entry?.key === this.historyKey && entry.index === compensation.expectedIndex) {
        this.compensatingPop = null;
        this.acceptHistoryEntry(entry.index);
        compensation.resolve();
        return;
      }

      const previousIndex = this.historyIndex;
      const previousHref = this.acceptedHref ?? this.window.location.href;
      const previousState = this.acceptedState;
      const isManagedEntry = entry?.key === this.historyKey;
      const targetIndex = isManagedEntry
        ? entry.index
        : this.inferHistoryIndex(previousIndex);
      let settled = false;
      const navigation: PathNavigation = {
        kind: 'traverse',
        commit: (path?: string) => {
          if (settled) {
            return;
          }
          const index = targetIndex ?? previousIndex - 1;
          if (path != null && !this.isCurrentHref(this.formatHref(path))) {
            this.window.history.replaceState(this.withHistoryEntry(this.window.history.state, index), '', this.formatHref(path));
          } else if (!isManagedEntry) {
            this.window.history.replaceState(this.withHistoryEntry(this.window.history.state, index), '');
          }
          this.acceptHistoryEntry(index);
          settled = true;
        },
        rollback: () => {
          if (settled) {
            return;
          }
          if (isManagedEntry && targetIndex === previousIndex) {
            this.window.history.replaceState(previousState, '', previousHref);
            this.acceptHistoryEntry(previousIndex);
            settled = true;
            return;
          }
          const delta = targetIndex == null
            // Plain History exposes no traversal index. The only safe fallback we
            // promise is restoring the managed entry after Back reaches the
            // immediately preceding entry that existed when the router started.
            ? 1
            : previousIndex - targetIndex;
          if (delta === 0) {
            settled = true;
            return;
          }
          let resolveRollback!: () => void;
          const rollback = new Promise<void>(resolve => { resolveRollback = resolve; });
          this.compensatingPop = { expectedIndex: previousIndex, resolve: resolveRollback };
          try {
            this.window.history.go(delta);
          } catch (error) {
            this.compensatingPop = null;
            throw error;
          }
          settled = true;
          return rollback;
        },
      };
      callback(this.getCurrentPath(), navigation);
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
      let settled = false;
      callback(nextPath, {
        kind: 'intent',
        commit: (path = nextPath, options = {}) => {
          if (settled) {
            return;
          }
          if (options.replace === true) {
            this.replace(path);
          } else {
            this.push(path);
          }
          settled = true;
        },
        rollback: () => {
          settled = true;
        },
      });
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

  /** @internal */
  private ensureHistoryEntry(): void {
    const entry = this.readHistoryEntry();
    if (entry != null) {
      this.historyKey = entry.key;
      this.acceptHistoryEntry(entry.index);
      return;
    }
    this.historyKey = this.createHistoryKey();
    this.historyIndex = 0;
    this.window.history.replaceState(this.withHistoryEntry(this.window.history.state, 0), '');
    this.acceptHistoryEntry(0);
  }

  /** @internal */
  private acceptHistoryEntry(index: number): void {
    this.historyIndex = index;
    this.acceptedNavigationIndex = this.readNavigationIndex();
    this.acceptedHref = this.window.location.href;
    this.acceptedState = this.window.history.state;
  }

  /** @internal */
  private inferHistoryIndex(previousIndex: number): number | null {
    const targetNavigationIndex = this.readNavigationIndex();
    return this.acceptedNavigationIndex == null || targetNavigationIndex == null
      ? null
      : previousIndex + targetNavigationIndex - this.acceptedNavigationIndex;
  }

  /** @internal */
  private readNavigationIndex(): number | null {
    const index = (this.window as BrowserWindow).navigation?.currentEntry?.index;
    return typeof index === 'number' ? index : null;
  }

  /** @internal */
  private readHistoryEntry(): BrowserHistoryEntry | null {
    const state = this.window.history.state;
    if (typeof state !== 'object' || state == null) {
      return null;
    }
    const entry = (state as Record<string, unknown>)[browserHistoryEntryKey];
    if (typeof entry !== 'object' || entry == null) {
      return null;
    }
    const { key, index } = entry as Partial<BrowserHistoryEntry>;
    return typeof key === 'string' && typeof index === 'number'
      ? { key, index }
      : null;
  }

  /** @internal */
  private withHistoryEntry(state: unknown, index: number): Record<string, unknown> {
    const source = typeof state === 'object' && state != null
      ? state as Record<string, unknown>
      : {};
    return {
      ...source,
      [browserHistoryEntryKey]: {
        key: this.historyKey!,
        index,
      },
    };
  }

  /** @internal */
  private createHistoryKey(): string {
    return typeof this.window.crypto?.randomUUID === 'function'
      ? this.window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  /** @internal */
  private isCurrentHref(href: string): boolean {
    return new URL(href, this.window.location.href).href === this.window.location.href;
  }

  /** @internal */
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

  /** @internal */
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

  /** @internal */
  private baseDocumentPath(): string {
    return this.basePath === '/' ? '' : `${this.basePath}/`;
  }

  /** @internal */
  private pathWithBase(pathname: string): string {
    if (this.basePath === '/') {
      return pathname;
    }
    return pathname === '/' ? `${this.basePath}/` : `${this.basePath}${pathname}`;
  }

  /** @internal */
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
