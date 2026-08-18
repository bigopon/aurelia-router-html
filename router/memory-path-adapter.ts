import type { IPathAdapter, PathNavigation } from './path-adapter';
import { parseRouteLocation, stringifyRouteLocation } from './route-location';

export interface MemoryNavigationOptions {
  replace?: boolean;
}

export class MemoryPathAdapter implements IPathAdapter {
  private readonly entries: string[];
  private readonly subscribers = new Set<(path: string, navigation?: PathNavigation) => void>();
  private index: number = 0;
  private acceptedEntries: string[];
  private acceptedIndex: number = 0;

  public constructor(initialPath: string = '/') {
    this.entries = [this.normalize(initialPath)];
    this.acceptedEntries = [...this.entries];
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
    this.acceptCurrent();
  }

  public replace(path: string): void {
    this.entries[this.index] = this.normalize(path);
    this.acceptCurrent();
  }

  public navigate(path: string, options: MemoryNavigationOptions = {}): void {
    const previousEntries = [...this.acceptedEntries];
    const previousIndex = this.acceptedIndex;
    if (options.replace === true) {
      this.entries[this.index] = this.normalize(path);
    } else {
      this.entries.splice(this.index + 1);
      this.entries.push(this.normalize(path));
      this.index = this.entries.length - 1;
    }
    this.notify(this.createTraversal(previousEntries, previousIndex, [...this.entries], this.index));
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
    this.notify(this.createTraversal(
      [...this.acceptedEntries],
      this.acceptedIndex,
      [...this.entries],
      this.index,
    ));
    return true;
  }

  public subscribe(callback: (path: string, navigation?: PathNavigation) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(navigation?: PathNavigation): void {
    if (this.subscribers.size === 0) {
      navigation?.commit();
      return;
    }
    const path = this.getCurrentPath();
    for (const subscriber of this.subscribers) {
      subscriber(path, navigation);
    }
  }

  private createTraversal(
    previousEntries: string[],
    previousIndex: number,
    targetEntries: string[],
    targetIndex: number,
  ): PathNavigation {
    let settled = false;
    return {
      kind: 'traverse',
      commit: path => {
        if (settled) {
          return;
        }
        settled = true;
        if (path != null) {
          targetEntries[targetIndex] = this.normalize(path);
        }
        this.entries.splice(0, this.entries.length, ...targetEntries);
        this.index = targetIndex;
        this.acceptCurrent();
      },
      rollback: () => {
        if (settled) {
          return;
        }
        settled = true;
        this.entries.splice(0, this.entries.length, ...previousEntries);
        this.index = previousIndex;
        this.acceptCurrent();
      },
    };
  }

  private acceptCurrent(): void {
    this.acceptedEntries = [...this.entries];
    this.acceptedIndex = this.index;
  }

  private normalize(path: string): string {
    return stringifyRouteLocation(parseRouteLocation(path));
  }
}
