import { DI } from '@aurelia/kernel';
import type { RouteScrollNavigation } from './scroll';
import type { IRouteViewSettlement, RouteSettledCallback } from './settlement';

export type RouteFocusFallback = 'none' | 'heading';

export interface RouteFocusOptions {
  fallback?: RouteFocusFallback;
  initial?: boolean;
  preventScroll?: boolean;
}

export interface IRouteFocusService {
  start(): void;
  beforeNavigation(routeChanged: boolean): void;
  register(element: HTMLElement): () => void;
  afterNavigation(navigation?: RouteScrollNavigation): void;
  cancelNavigation(): void;
  stop(): void;
}

export const IRouteFocusService = DI.createInterface<IRouteFocusService>('IRouteFocusService');

export class BrowserRouteFocusService implements IRouteFocusService {
  private readonly candidates = new Set<HTMLElement>();
  private readonly applyPendingFocus: RouteSettledCallback = () => this.applyFocus();
  private collecting: boolean = false;
  private routeChanged: boolean = false;
  private stopped: boolean = false;

  public constructor(
    private readonly document: Document,
    private readonly settlement: IRouteViewSettlement,
    private readonly options: RouteFocusOptions = {},
  ) {}

  public start(): void {
    this.stopped = false;
  }

  public beforeNavigation(routeChanged: boolean): void {
    this.settlement.cancel(this.applyPendingFocus);
    this.candidates.clear();
    this.routeChanged = routeChanged;
    this.collecting = routeChanged;
  }

  public register(element: HTMLElement): () => void {
    if (this.collecting && !this.stopped) {
      this.candidates.add(element);
    }
    return () => {
      this.candidates.delete(element);
    };
  }

  public afterNavigation(navigation: RouteScrollNavigation = 'push'): void {
    this.collecting = false;
    if (this.stopped || !this.routeChanged || navigation === 'initial' && this.options.initial !== true) {
      this.routeChanged = false;
      this.candidates.clear();
      return;
    }
    this.routeChanged = false;
    this.settlement.queue(this.applyPendingFocus);
  }

  public cancelNavigation(): void {
    this.collecting = false;
    this.routeChanged = false;
    this.candidates.clear();
    this.settlement.cancel(this.applyPendingFocus);
  }

  public stop(): void {
    this.stopped = true;
    this.cancelNavigation();
  }

  private applyFocus(): void {
    let target: HTMLElement | null = null;
    for (const candidate of this.candidates) {
      if (candidate.isConnected) {
        target = candidate;
      }
    }
    this.candidates.clear();
    target ??= this.options.fallback === 'heading'
      ? this.document.querySelector<HTMLElement>('main h1, main [role="heading"][aria-level="1"]')
      : null;
    if (target == null) {
      return;
    }
    if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: this.options.preventScroll !== false });
  }
}

export const noRouteFocusService: IRouteFocusService = {
  start() {},
  beforeNavigation() {},
  register: () => () => {},
  afterNavigation() {},
  cancelNavigation() {},
  stop() {},
};
