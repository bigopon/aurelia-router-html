import { DI } from '@aurelia/kernel';
import type { PathAdapter } from './path-adapter';
import type { IRouteContext } from './route-context';
import { parseRouteLocation, stringifyRouteLocation, type RouteLocation } from './route-location';

export interface LoadOptions {
  replace?: boolean;
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
  private readonly stopListening: () => void;
  private started: boolean = false;

  public constructor(
    public readonly root: IRouteContext,
    private readonly adapter: PathAdapter,
  ) {
    this.stopListening = this.adapter.subscribe(path => {
      this.applyLocation(path);
      this.notify();
    });
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.applyLocation(this.adapter.getCurrentPath());
    this.notify();
  }

  public stop(): void {
    this.stopListening();
    this.started = false;
  }

  public load(path: string, options: LoadOptions = {}): void {
    const location = parseRouteLocation(path);
    const normalizedPath = stringifyRouteLocation(location);
    if (options.replace === true) {
      this.adapter.replace(normalizedPath);
    } else {
      this.adapter.push(normalizedPath);
    }

    this.currentLocation = location;
    this.currentPath = location.pathname;
    this.root.apply(location.pathname, location);
    this.notify();
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
    this.currentLocation = parseRouteLocation(path);
    this.currentPath = this.currentLocation.pathname;
    this.root.apply(this.currentPath, this.currentLocation);
  }
}
