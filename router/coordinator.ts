import { DI } from '@aurelia/kernel';
import type { PathAdapter } from './path-adapter';
import type { IRouteContext } from './route-context';

export interface LoadOptions {
  replace?: boolean;
}

export interface IRouteCoordinator {
  readonly root: IRouteContext;
  readonly currentPath: string;

  start(): void;
  stop(): void;
  load(path: string, options?: LoadOptions): void;
  subscribe(callback: (path: string) => void): () => void;
}

export const IRouteCoordinator = DI.createInterface<IRouteCoordinator>('IRouteCoordinator');

export class RouteCoordinator implements IRouteCoordinator {
  public currentPath: string = '/';
  private readonly subscribers = new Set<(path: string) => void>();
  private readonly stopListening: () => void;
  private started: boolean = false;

  public constructor(
    public readonly root: IRouteContext,
    private readonly adapter: PathAdapter,
  ) {
    this.stopListening = this.adapter.subscribe(path => {
      this.currentPath = normalizePath(path);
      this.root.apply(this.currentPath);
      this.notify();
    });
  }

  public start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.currentPath = normalizePath(this.adapter.getCurrentPath());
    this.root.apply(this.currentPath);
    this.notify();
  }

  public stop(): void {
    this.stopListening();
    this.started = false;
  }

  public load(path: string, options: LoadOptions = {}): void {
    const normalizedPath = normalizePath(path);
    if (options.replace === true) {
      this.adapter.replace(normalizedPath);
    } else {
      this.adapter.push(normalizedPath);
    }

    this.currentPath = normalizedPath;
    this.root.apply(normalizedPath);
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
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '') {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}
