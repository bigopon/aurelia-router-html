import { DI } from '@aurelia/kernel';
import type { IPathAdapter } from './path-adapter';
import { RouteContext, type IRouteContext } from './route-context';
import { parseRouteLocation, stringifyRouteLocation, type RouteLocation } from './route-location';

export interface LoadOptions {
  replace?: boolean;
}

interface InternalLoadOptions extends LoadOptions {
  redirect?: boolean;
}

export interface IRouteCoordinator {
  readonly root: IRouteContext;
  readonly currentPath: string;
  readonly currentLocation: RouteLocation;

  start(): void;
  stop(): void;
  load(path: string, options?: LoadOptions): void;
  subscribe(callback: (path: string) => void): () => void;
}

export const IRouteCoordinator = DI.createInterface<IRouteCoordinator>('IRouteCoordinator');

export class RouteCoordinator implements IRouteCoordinator {
  public currentPath: string = '/';
  public currentLocation: RouteLocation = parseRouteLocation('/');
  private readonly subscribers = new Set<(path: string) => void>();
  private stopListening: (() => void) | null = null;
  private started: boolean = false;
  private navigationDepth: number = 0;
  private redirectChain: string[] = [];

  public constructor(
    public readonly root: IRouteContext,
    private readonly adapter: IPathAdapter,
  ) {
    if (root instanceof RouteContext) {
      root._setNavigator((path, options) => this.load(path, options));
    }
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.stopListening = this.adapter.subscribe(path => {
      this.applyLocation(path);
      this.notify();
    });
    this.applyLocation(this.adapter.getCurrentPath());
    this.notify();
  }

  public stop(): void {
    if (!this.started) {
      return;
    }
    this.stopListening?.();
    this.stopListening = null;
    this.started = false;
  }

  public load(path: string, options: InternalLoadOptions = {}): void {
    const location = parseRouteLocation(path);
    const normalizedPath = stringifyRouteLocation(location);
    const startsNavigation = this.navigationDepth === 0;
    if (startsNavigation) {
      this.redirectChain = [normalizedPath];
    } else if (options.redirect === true) {
      const loopStart = this.redirectChain.indexOf(normalizedPath);
      if (loopStart >= 0) {
        throw new Error(`Redirect loop detected: ${[...this.redirectChain.slice(loopStart), normalizedPath].join(' -> ')}`);
      }
      this.redirectChain.push(normalizedPath);
    }

    this.navigationDepth++;
    try {
      if (options.replace === true) {
        this.adapter.replace(normalizedPath);
      } else {
        this.adapter.push(normalizedPath);
      }

      this.currentLocation = location;
      this.currentPath = location.pathname;
      this.root.apply(location.pathname, location);
      this.notify();
    } finally {
      this.navigationDepth--;
      if (startsNavigation) {
        this.redirectChain = [];
      }
    }
  }

  public subscribe(callback: (path: string) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentPath);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.currentPath);
    }
  }

  private applyLocation(path: string): void {
    const startsNavigation = this.navigationDepth === 0;
    const location = parseRouteLocation(path);
    const normalizedPath = stringifyRouteLocation(location);
    if (startsNavigation) {
      this.redirectChain = [normalizedPath];
    }
    this.navigationDepth++;
    try {
      this.currentLocation = location;
      this.currentPath = location.pathname;
      this.root.apply(this.currentPath, this.currentLocation);
    } finally {
      this.navigationDepth--;
      if (startsNavigation) {
        this.redirectChain = [];
      }
    }
  }
}
