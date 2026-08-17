import { DI } from '@aurelia/kernel';
import type { RouteLocation } from './route-location';
import type { IRouteViewSettlement, RouteSettledCallback } from './settlement';

export interface RouteScrollOptions {
  hash?: boolean;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
}

export interface IRouteScrollService {
  afterNavigation(location: RouteLocation): void;
  stop(): void;
}

export const IRouteScrollService = DI.createInterface<IRouteScrollService>('IRouteScrollService');

export class BrowserRouteScrollService implements IRouteScrollService {
  private readonly scroll: RouteSettledCallback = () => this.scrollToHash();
  private pendingHash: string | null = null;

  public constructor(
    private readonly document: Document,
    private readonly settlement: IRouteViewSettlement,
    private readonly options: RouteScrollOptions = {},
  ) {}

  public afterNavigation(location: RouteLocation): void {
    this.settlement.cancel(this.scroll);
    this.pendingHash = this.options.hash === false || location.hash === ''
      ? null
      : location.hash;
    if (this.pendingHash != null) {
      this.settlement.queue(this.scroll);
    }
  }

  public stop(): void {
    this.pendingHash = null;
    this.settlement.cancel(this.scroll);
  }

  private scrollToHash(): void {
    const hash = this.pendingHash;
    this.pendingHash = null;
    if (hash == null) {
      return;
    }

    let targetName: string;
    try {
      targetName = decodeURIComponent(hash);
    } catch {
      targetName = hash;
    }
    const target = this.document.getElementById(targetName)
      ?? this.document.getElementsByName(targetName)[0];
    target?.scrollIntoView({
      behavior: this.options.behavior,
      block: this.options.block,
      inline: this.options.inline,
    });
  }
}

export const noRouteScrollService: IRouteScrollService = {
  afterNavigation() {},
  stop() {},
};
