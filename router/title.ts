import { DI } from '@aurelia/kernel';
import { queueAsyncTask } from '@aurelia/runtime';
import type { IRouteContext } from './route-context';

export interface RouteTitleOptions {
  separator?: string;
  fallback?: string;
  compose?: (titles: readonly string[], contexts: readonly IRouteContext[]) => string;
}

export interface IRouteTitleService {
  start(): void;
  beginViewActivation(): void;
  endViewActivation(): void;
  requestUpdate(): void;
  stop(): void;
}

export const IRouteTitleService = DI.createInterface<IRouteTitleService>('IRouteTitleService');

export class BrowserRouteTitleService implements IRouteTitleService {
  private readonly fallback: string;
  private pendingActivations: number = 0;
  private updateQueued: boolean = false;
  private dirty: boolean = false;
  private stopped: boolean = false;
  private generation: number = 0;

  public constructor(
    private readonly root: IRouteContext,
    private readonly document: Document,
    private readonly options: RouteTitleOptions = {},
  ) {
    this.fallback = options.fallback ?? document.title;
    if (options.fallback != null) {
      document.title = options.fallback;
    }
  }

  public beginViewActivation(): void {
    this.pendingActivations++;
  }

  public start(): void {
    this.stopped = false;
  }

  public endViewActivation(): void {
    this.pendingActivations = Math.max(0, this.pendingActivations - 1);
    this.requestUpdate();
  }

  public requestUpdate(): void {
    if (this.stopped) {
      return;
    }
    this.dirty = true;
    if (this.pendingActivations > 0 || this.updateQueued) {
      return;
    }

    this.updateQueued = true;
    const generation = this.generation;
    void queueAsyncTask(() => {
      if (generation !== this.generation) {
        return;
      }
      this.updateQueued = false;
      if (this.stopped || this.pendingActivations > 0 || !this.dirty) {
        return;
      }
      this.dirty = false;
      this.updateTitle();
    });
  }

  public stop(): void {
    this.stopped = true;
    this.dirty = false;
    this.updateQueued = false;
    this.generation++;
  }

  private updateTitle(): void {
    const contexts: IRouteContext[] = [];
    const pending: IRouteContext[] = [...this.root.children].reverse();
    while (pending.length > 0) {
      const context = pending.pop()!;
      if (!context.active) {
        continue;
      }
      if (context.title != null) {
        contexts.push(context);
      }
      pending.push(...[...context.children].reverse());
    }

    const titles = contexts.map(context => context.title!);
    this.document.title = titles.length === 0
      ? this.fallback
      : this.options.compose?.(titles, contexts) ?? titles.join(this.options.separator ?? ' · ');
  }
}

export const noRouteTitleService: IRouteTitleService = {
  start() {},
  beginViewActivation() {},
  endViewActivation() {},
  requestUpdate() {},
  stop() {},
};
