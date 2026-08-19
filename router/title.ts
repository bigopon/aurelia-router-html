import { DI } from '@aurelia/kernel';
import type { IRouteContext } from './route-context';
import type { IRouteViewSettlement, RouteSettledCallback } from './settlement';

export interface RouteTitleOptions {
  separator?: string;
  fallback?: string;
  compose?: (titles: readonly string[], contexts: readonly IRouteContext[]) => string;
}

export interface IRouteTitleService {
  start(): void;
  requestUpdate(): void;
  stop(): void;
}

export const IRouteTitleService = DI.createInterface<IRouteTitleService>('IRouteTitleService');

export class BrowserRouteTitleService implements IRouteTitleService {
  /** @internal */
  private readonly fallback: string;
  /** @internal */
  private stopped: boolean = false;
  /** @internal */
  private readonly update: RouteSettledCallback = () => this.updateTitle();
  /** @internal */
  private readonly root: IRouteContext;
  /** @internal */
  private readonly document: Document;
  /** @internal */
  private readonly settlement: IRouteViewSettlement;
  /** @internal */
  private readonly options: RouteTitleOptions;

  public constructor(
    root: IRouteContext,
    document: Document,
    settlement: IRouteViewSettlement,
    options: RouteTitleOptions = {},
  ) {
    this.root = root;
    this.document = document;
    this.settlement = settlement;
    this.options = options;
    this.fallback = options.fallback ?? document.title;
    if (options.fallback != null) {
      document.title = options.fallback;
    }
  }

  public start(): void {
    this.stopped = false;
  }

  public requestUpdate(): void {
    if (this.stopped) {
      return;
    }
    this.settlement.queue(this.update);
  }

  public stop(): void {
    this.stopped = true;
    this.settlement.cancel(this.update);
  }

  /** @internal */
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
  requestUpdate() {},
  stop() {},
};
