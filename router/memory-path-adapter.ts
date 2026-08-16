import type { IPathAdapter } from './path-adapter';
import { parseRouteLocation, stringifyRouteLocation } from './route-location';

export interface MemoryNavigationOptions {
  replace?: boolean;
}

export class MemoryPathAdapter implements IPathAdapter {
  private readonly entries: string[];
  private readonly subscribers = new Set<(path: string) => void>();
  private index: number = 0;

  public constructor(initialPath: string = '/') {
    this.entries = [this.normalize(initialPath)];
  }

  public getCurrentPath(): string {
    return this.entries[this.index];
  }

  public formatHref(path: string): string {
    return this.normalize(path);
  }

  public push(path: string): void {
    this.entries.splice(this.index + 1);
    this.entries.push(this.normalize(path));
    this.index = this.entries.length - 1;
  }

  public replace(path: string): void {
    this.entries[this.index] = this.normalize(path);
  }

  public navigate(path: string, options: MemoryNavigationOptions = {}): void {
    if (options.replace === true) {
      this.replace(path);
    } else {
      this.push(path);
    }
    this.notify();
  }

  public back(): boolean {
    return this.go(-1);
  }

  public forward(): boolean {
    return this.go(1);
  }

  public go(delta: number): boolean {
    const offset = Math.trunc(delta);
    if (!Number.isFinite(offset) || offset === 0) {
      return false;
    }
    const nextIndex = this.index + offset;
    if (nextIndex < 0 || nextIndex >= this.entries.length || nextIndex === this.index) {
      return false;
    }
    this.index = nextIndex;
    this.notify();
    return true;
  }

  public subscribe(callback: (path: string) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    const path = this.getCurrentPath();
    for (const subscriber of this.subscribers) {
      subscriber(path);
    }
  }

  private normalize(path: string): string {
    return stringifyRouteLocation(parseRouteLocation(path));
  }
}
