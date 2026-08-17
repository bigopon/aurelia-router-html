import { DI } from '@aurelia/kernel';
import type { RouteLocation } from './route-location';
import type { IRouteViewSettlement, RouteSettledCallback } from './settlement';

export type RouteScrollRestoration = 'restore' | 'top' | 'preserve' | 'manual';
export type RouteScrollNavigation = 'initial' | 'push' | 'replace' | 'external';

export interface RouteScrollOptions {
  hash?: boolean;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  inline?: ScrollLogicalPosition;
  restoration?: RouteScrollRestoration;
}

export interface IRouteScrollService {
  start(): void;
  beforeNavigation(navigation?: RouteScrollNavigation): void;
  afterNavigation(location: RouteLocation, navigation?: RouteScrollNavigation): void;
  stop(): void;
}

export const IRouteScrollService = DI.createInterface<IRouteScrollService>('IRouteScrollService');

interface ScrollPosition {
  readonly left: number;
  readonly top: number;
}

interface PendingScroll {
  readonly location: RouteLocation;
  readonly navigation: Exclude<RouteScrollNavigation, 'external'> | 'pop';
  readonly entryId: string;
}

const scrollEntryKey = '__auRouteScrollEntry';

export class BrowserRouteScrollService implements IRouteScrollService {
  private readonly window: Window;
  private readonly applyPendingScroll: RouteSettledCallback = () => this.applyScroll();
  private readonly positions = new Map<string, ScrollPosition>();
  private pending: PendingScroll | null = null;
  private currentEntryId: string | null = null;
  private pendingPopEntryId: string | null = null;
  private entrySequence: number = 0;
  private previousNativeRestoration: ScrollRestoration | null = null;
  private started: boolean = false;

  public constructor(
    private readonly document: Document,
    private readonly settlement: IRouteViewSettlement,
    private readonly options: RouteScrollOptions = {},
  ) {
    const window = document.defaultView;
    if (window == null) {
      throw new Error('Browser route scrolling requires a document with a window.');
    }
    this.window = window;
  }

  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.previousNativeRestoration = this.window.history.scrollRestoration;
    this.window.history.scrollRestoration = 'manual';
    this.currentEntryId = this.ensureEntryId();
    this.capturePosition(this.currentEntryId);
    this.window.addEventListener('scroll', this.onScroll, { passive: true });
    this.window.addEventListener('popstate', this.onPopState);
  }

  public afterNavigation(location: RouteLocation, navigation: RouteScrollNavigation = 'push'): void {
    this.settlement.cancel(this.applyPendingScroll);
    if (!this.started) {
      this.start();
    }

    const isPop = navigation === 'external'
      && this.pendingPopEntryId != null
      && this.readEntryId() === this.pendingPopEntryId;
    let entryId: string;
    if (isPop) {
      entryId = this.pendingPopEntryId!;
    } else if (navigation === 'replace' && this.currentEntryId != null) {
      entryId = this.writeEntryId(this.currentEntryId);
    } else {
      entryId = this.ensureEntryId();
    }

    this.pendingPopEntryId = null;
    this.currentEntryId = entryId;
    this.pending = {
      location,
      navigation: isPop ? 'pop' : navigation === 'external' ? 'push' : navigation,
      entryId,
    };
    this.settlement.queue(this.applyPendingScroll);
  }

  public stop(): void {
    this.pending = null;
    this.pendingPopEntryId = null;
    this.settlement.cancel(this.applyPendingScroll);
    if (!this.started) {
      return;
    }
    this.captureCurrentPosition();
    this.window.removeEventListener('scroll', this.onScroll);
    this.window.removeEventListener('popstate', this.onPopState);
    if (this.previousNativeRestoration != null) {
      this.window.history.scrollRestoration = this.previousNativeRestoration;
    }
    this.previousNativeRestoration = null;
    this.started = false;
  }

  public beforeNavigation(_navigation: RouteScrollNavigation = 'push'): void {
    if (!this.started) {
      this.start();
    }
    this.captureCurrentPosition();
  }

  private readonly onScroll = (): void => {
    this.captureCurrentPosition();
  };

  private readonly onPopState = (): void => {
    this.captureCurrentPosition();
    this.pendingPopEntryId = this.readEntryId() ?? this.ensureEntryId();
  };

  private applyScroll(): void {
    const pending = this.pending;
    this.pending = null;
    if (pending == null) {
      return;
    }

    const restoration = this.options.restoration ?? 'restore';
    if (restoration === 'manual') {
      return;
    }
    if (pending.navigation === 'pop' && restoration === 'restore') {
      const position = this.positions.get(pending.entryId);
      if (position != null) {
        this.scrollTo(position);
        return;
      }
    }

    if (this.options.hash !== false && pending.location.hash !== '' && this.scrollToFragment(pending.location.hash)) {
      return;
    }

    if (restoration === 'preserve') {
      return;
    }
    this.scrollTo({ left: 0, top: 0 });
  }

  private scrollToFragment(fragment: string): boolean {
    const rawTarget = this.findPotentialTarget(fragment);
    let decodedFragment = fragment;
    try {
      decodedFragment = decodeURIComponent(fragment);
    } catch {
      // A malformed fragment can still match its literal encoded form.
    }
    const target = rawTarget ?? (decodedFragment === fragment ? null : this.findPotentialTarget(decodedFragment));
    if (target != null) {
      target.scrollIntoView({
        behavior: this.options.behavior,
        block: this.options.block,
        inline: this.options.inline,
      });
      return true;
    }
    if (decodedFragment.toLowerCase() === 'top') {
      this.scrollTo({ left: 0, top: 0 });
      return true;
    }
    return false;
  }

  private findPotentialTarget(fragment: string): HTMLElement | null {
    const byId = this.document.getElementById(fragment);
    if (byId != null) {
      return byId;
    }
    const namedElements = this.document.getElementsByName(fragment);
    for (let index = 0; index < namedElements.length; index++) {
      const named = namedElements.item(index)!;
      if (named.localName === 'a') {
        return named;
      }
    }
    return null;
  }

  private scrollTo(position: ScrollPosition): void {
    this.window.scrollTo({
      left: position.left,
      top: position.top,
      behavior: 'auto',
    });
    if (this.currentEntryId != null) {
      this.positions.set(this.currentEntryId, position);
    }
  }

  private captureCurrentPosition(): void {
    if (this.currentEntryId != null) {
      this.capturePosition(this.currentEntryId);
    }
  }

  private capturePosition(entryId: string): void {
    this.positions.set(entryId, {
      left: this.window.scrollX,
      top: this.window.scrollY,
    });
  }

  private ensureEntryId(): string {
    return this.readEntryId() ?? this.writeEntryId(this.createEntryId());
  }

  private createEntryId(): string {
    return typeof this.window.crypto.randomUUID === 'function'
      ? `route-${this.window.crypto.randomUUID()}`
      : `route-${Date.now().toString(36)}-${++this.entrySequence}`;
  }

  private readEntryId(): string | null {
    const state = this.window.history.state;
    return typeof state === 'object' && state != null && typeof state[scrollEntryKey] === 'string'
      ? state[scrollEntryKey]
      : null;
  }

  private writeEntryId(entryId: string): string {
    const state = this.window.history.state;
    const nextState = typeof state === 'object' && state != null
      ? { ...state, [scrollEntryKey]: entryId }
      : { [scrollEntryKey]: entryId };
    this.window.history.replaceState(nextState, '');
    return entryId;
  }
}

export const noRouteScrollService: IRouteScrollService = {
  start() {},
  beforeNavigation() {},
  afterNavigation() {},
  stop() {},
};
