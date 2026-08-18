import { DI } from '@aurelia/kernel';
import { queueAsyncTask } from '@aurelia/runtime';

export type RouteSettledCallback = () => void;

export interface IRouteViewSettlement {
  begin(): void;
  end(): void;
  whenSettled?(): void | Promise<void>;
  queue(callback: RouteSettledCallback): void;
  cancel(callback: RouteSettledCallback): void;
}

export const IRouteViewSettlement = DI.createInterface<IRouteViewSettlement>('IRouteViewSettlement');

export class RouteViewSettlement implements IRouteViewSettlement {
  private readonly callbacks = new Set<RouteSettledCallback>();
  private readonly waiters = new Set<() => void>();
  private pendingViews: number = 0;
  private flushQueued: boolean = false;

  public begin(): void {
    this.pendingViews++;
  }

  public end(): void {
    this.pendingViews = Math.max(0, this.pendingViews - 1);
    this.queueFlush();
  }

  public whenSettled(): void | Promise<void> {
    if (this.pendingViews === 0) {
      return;
    }
    return new Promise<void>(resolve => {
      this.waiters.add(resolve);
      this.queueFlush();
    });
  }

  public queue(callback: RouteSettledCallback): void {
    this.callbacks.add(callback);
    this.queueFlush();
  }

  public cancel(callback: RouteSettledCallback): void {
    this.callbacks.delete(callback);
  }

  private queueFlush(): void {
    if (this.pendingViews > 0 || this.flushQueued || this.callbacks.size === 0 && this.waiters.size === 0) {
      return;
    }

    this.flushQueued = true;
    void queueAsyncTask(() => {
      this.flushQueued = false;
      if (this.pendingViews > 0) {
        return;
      }
      if (this.waiters.size > 0) {
        const waiters = [...this.waiters];
        this.waiters.clear();
        for (const resolve of waiters) {
          resolve();
        }
        void Promise.resolve().then(() => this.queueFlush());
        return;
      }
      if (this.callbacks.size === 0) {
        return;
      }
      const callbacks = [...this.callbacks];
      this.callbacks.clear();
      for (const callback of callbacks) {
        callback();
      }
      this.queueFlush();
    });
  }
}
