import { DI, isPromise } from '@aurelia/kernel';
import type { RouteCanLoadCallback, RouteCanUnloadCallback, RouteGuardContext, RouteGuardRedirect, RouteGuardResult } from './guard';
import type { IPathAdapter } from './path-adapter';
import { RouteContext, type IRouteContext } from './route-context';
import { parseRouteLocation, stringifyRouteLocation, type RouteLocation } from './route-location';

declare const __DEV__: boolean;

export interface LoadOptions {
  replace?: boolean;
}

interface InternalLoadOptions extends LoadOptions {
  redirect?: boolean;
  chain?: string[];
  external?: boolean;
  initial?: boolean;
}

export interface IRouteCoordinator {
  readonly root: IRouteContext;
  readonly currentPath: string;
  readonly currentLocation: RouteLocation;

  start(): boolean | Promise<boolean>;
  stop(): void;
  load(path: string, options?: LoadOptions): boolean | Promise<boolean>;
  subscribe(callback: (path: string) => void): () => void;
}

export const IRouteCoordinator = DI.createInterface<IRouteCoordinator>('IRouteCoordinator');

class NavigationCancelled extends Error {}

interface NavigationTransaction {
  readonly location: RouteLocation;
  readonly normalizedPath: string;
  readonly previousLocation: RouteLocation;
  readonly previousActive: boolean;
  readonly options: InternalLoadOptions;
  readonly controller: AbortController;
  readonly checked: Set<RouteContext>;
  pending: number;
  sealed: boolean;
  cancelled: boolean;
  error: unknown;
  redirect: { path: string; replace: boolean } | null;
  enterAnimations: Array<() => void | Promise<void>>;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
  completion: Promise<boolean>;
}

export class RouteCoordinator implements IRouteCoordinator {
  public currentPath: string = '/';
  public currentLocation: RouteLocation = parseRouteLocation('/');
  private readonly subscribers = new Set<(path: string) => void>();
  private stopListening: (() => void) | null = null;
  private started: boolean = false;
  private transaction: NavigationTransaction | null = null;
  private redirectChain: string[] = [];
  /** @internal */ public _isRollingBack: boolean = false;

  public constructor(
    public readonly root: IRouteContext,
    private readonly adapter: IPathAdapter,
    private readonly createAbortController: () => AbortController = () => new AbortController(),
  ) {
    if (root instanceof RouteContext) {
      root._setNavigator((path, options) => this.load(path, options));
    }
  }

  public start(): boolean | Promise<boolean> {
    if (this.started) {
      return true;
    }

    this.started = true;
    this.stopListening = this.adapter.subscribe(path => {
      const result = this.navigate(path, { external: true });
      if (isPromise(result)) {
        void result.catch(() => {});
      }
    });
    return this.navigate(this.adapter.getCurrentPath(), { external: true, initial: true });
  }

  public stop(): void {
    if (!this.started) {
      return;
    }
    this.stopListening?.();
    this.stopListening = null;
    this.started = false;
    this.transaction?.controller.abort();
  }

  public load(path: string, options: InternalLoadOptions = {}): boolean | Promise<boolean> {
    return this.navigate(path, options);
  }

  /** @internal */
  public _runRouteActivation(
    context: RouteContext,
    canLoad: RouteCanLoadCallback | null,
    activate: () => void | Promise<void>,
  ): void | Promise<void> {
    const transaction = this.transaction;
    if (transaction == null) {
      return this.runActivationOutsideNavigation(context, canLoad, activate);
    }

    transaction.pending++;
    let result: void | Promise<void>;
    try {
      result = this.runCanLoad(transaction, context, canLoad, activate);
    } catch (error) {
      this.captureFailure(transaction, error);
      transaction.pending--;
      this.tryFinish(transaction);
      throw error;
    }

    if (!isPromise(result)) {
      transaction.pending--;
      this.tryFinish(transaction);
      return;
    }

    return result.then(
      () => {
        transaction.pending--;
        this.tryFinish(transaction);
      },
      error => {
        this.captureFailure(transaction, error);
        transaction.pending--;
        this.tryFinish(transaction);
        throw error;
      },
    );
  }

  /** @internal */
  public _runEnterAnimation(animation: () => void | Promise<void>): void | Promise<void> {
    const transaction = this.transaction;
    if (transaction == null) {
      return animation();
    }
    transaction.enterAnimations.push(animation);
  }

  public subscribe(callback: (path: string) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentPath);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private navigate(path: string, options: InternalLoadOptions): boolean | Promise<boolean> {
    const location = parseRouteLocation(path);
    const normalizedPath = stringifyRouteLocation(location);
    const active = this.transaction;
    if (active != null) {
      if (options.redirect === true) {
        this.assertNoRedirectLoop(normalizedPath, options.chain ?? this.redirectChain);
        active.redirect = { path: normalizedPath, replace: options.replace !== false };
        active.cancelled = true;
        active.controller.abort();
        return active.completion;
      }

      if (active.options.initial === true) {
        return active.completion.then(
          () => this.navigate(normalizedPath, options),
          () => this.navigate(normalizedPath, options),
        );
      }

      active.cancelled = true;
      active.controller.abort();
      return active.completion.then(
        () => this.navigate(normalizedPath, options),
        () => this.navigate(normalizedPath, options),
      );
    }

    const chain = options.chain ?? (options.redirect === true
      ? (this.redirectChain.length > 0
        ? this.redirectChain
        : [stringifyRouteLocation(this.currentLocation)])
      : [normalizedPath]);
    if (options.redirect === true) {
      this.assertNoRedirectLoop(normalizedPath, chain);
      chain.push(normalizedPath);
    }
    this.redirectChain = chain;

    const controller = this.createAbortController();
    const leaving = this.root instanceof RouteContext ? this.root._getLeaving(location.pathname) : [];
    const guardContext = (route: RouteContext): RouteGuardContext => ({ route, signal: controller.signal });
    const canUnload = this.runCanUnload(leaving, 0, guardContext);
    if (isPromise(canUnload)) {
      return canUnload.then(allowed => allowed
        ? this.beginNavigation(location, normalizedPath, { ...options, chain }, controller)
        : false);
    }
    return canUnload
      ? this.beginNavigation(location, normalizedPath, { ...options, chain }, controller)
      : false;
  }

  private beginNavigation(
    location: RouteLocation,
    normalizedPath: string,
    options: InternalLoadOptions,
    controller: AbortController,
  ): boolean | Promise<boolean> {
    let resolve!: (value: boolean) => void;
    let reject!: (reason: unknown) => void;
    const completion = new Promise<boolean>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const transaction: NavigationTransaction = {
      location,
      normalizedPath,
      previousLocation: this.currentLocation,
      previousActive: this.root.active,
      options,
      controller,
      checked: new Set(),
      pending: 0,
      sealed: false,
      cancelled: false,
      error: undefined,
      redirect: null,
      enterAnimations: [],
      resolve,
      reject,
      completion,
    };
    this.transaction = transaction;
    if (this.root instanceof RouteContext) {
      this.root._beginNavigationTransaction();
    }

    try {
      this.root.apply(location.pathname, location);
    } catch (error) {
      this.captureFailure(transaction, error);
    }
    transaction.sealed = true;
    if (transaction.pending === 0 && transaction.error !== undefined) {
      this.transaction = null;
      transaction.controller.abort();
      if (this.root instanceof RouteContext) {
        this.root._cancelNavigationTransaction();
      }
      this.restorePreviousLocation(transaction);
      throw transaction.error;
    }
    const result = this.tryFinish(transaction);
    return result ?? completion;
  }

  private tryFinish(transaction: NavigationTransaction): boolean | Promise<boolean> | undefined {
    if (!transaction.sealed || transaction.pending > 0 || this.transaction !== transaction) {
      return;
    }

    this.transaction = null;
    const failed = transaction.cancelled || transaction.error !== undefined || transaction.redirect != null;
    if (failed) {
      transaction.controller.abort();
      if (this.root instanceof RouteContext) {
        this.root._cancelNavigationTransaction();
      }

      if (transaction.redirect != null) {
        const { path, replace } = transaction.redirect;
        this.restorePreviousLocation(transaction);
        if (!replace && transaction.options.external !== true) {
          if (transaction.options.replace === true) {
            this.adapter.replace(transaction.normalizedPath);
          } else {
            this.adapter.push(transaction.normalizedPath);
          }
        }
        const replaceDestination = replace
          ? transaction.options.external === true || transaction.options.replace === true
          : false;
        const redirected = this.navigate(path, {
          replace: replaceDestination,
          redirect: true,
          chain: transaction.options.chain ?? this.redirectChain,
        });
        if (isPromise(redirected)) {
          void redirected.then(transaction.resolve, transaction.reject);
          return transaction.completion;
        }
        transaction.resolve(redirected);
        return redirected;
      }

      this.restorePreviousLocation(transaction);

      if (transaction.options.external === true) {
        this.adapter.replace(stringifyRouteLocation(transaction.previousLocation));
      }
      if (transaction.error !== undefined) {
        transaction.reject(transaction.error);
        return transaction.completion;
      }
      transaction.resolve(false);
      return false;
    }

    if (transaction.options.external !== true) {
      if (transaction.options.replace === true) {
        this.adapter.replace(transaction.normalizedPath);
      } else {
        this.adapter.push(transaction.normalizedPath);
      }
    }
    if (this.root instanceof RouteContext) {
      this.root._commitNavigationTransaction();
    }
    for (const animation of transaction.enterAnimations) {
      try {
        const result = animation();
        if (isPromise(result)) {
          void result.catch(() => {});
        }
      } catch {
        // Animation failure must not roll back an already committed navigation.
      }
    }
    this.currentLocation = transaction.location;
    this.currentPath = transaction.location.pathname;
    this.notify();
    transaction.resolve(true);
    this.redirectChain = [];
    return true;
  }

  private runCanUnload(
    routes: RouteContext[],
    index: number,
    createContext: (route: RouteContext) => RouteGuardContext,
  ): boolean | Promise<boolean> {
    for (let current = index; current < routes.length; current++) {
      const route = routes[current];
      const callback: RouteCanUnloadCallback | null = route._canUnload;
      if (callback == null) {
        continue;
      }
      const result = callback(createContext(route));
      if (isPromise(result)) {
        return result.then(allowed => allowed === false
          ? false
          : this.runCanUnload(routes, current + 1, createContext));
      }
      if (result === false) {
        return false;
      }
    }
    return true;
  }

  private runCanLoad(
    transaction: NavigationTransaction,
    context: RouteContext,
    callback: RouteCanLoadCallback | null,
    activate: () => void | Promise<void>,
  ): void | Promise<void> {
    if (transaction.cancelled) {
      throw new NavigationCancelled();
    }
    if (callback == null || transaction.checked.has(context)) {
      return activate();
    }
    transaction.checked.add(context);
    const result = callback({ route: context, signal: transaction.controller.signal });
    if (isPromise(result)) {
      return result.then(value => this.handleCanLoadResult(transaction, context, value, activate));
    }
    return this.handleCanLoadResult(transaction, context, result, activate);
  }

  private handleCanLoadResult(
    transaction: NavigationTransaction,
    context: RouteContext,
    result: RouteGuardResult,
    activate: () => void | Promise<void>,
  ): void | Promise<void> {
    if (transaction.cancelled) {
      throw new NavigationCancelled();
    }
    if (result == null || result === true) {
      return activate();
    }
    if (result === false) {
      if (context._guardFailure === 'local') {
        this.rejectGuardLocally(context);
        return;
      }
      transaction.cancelled = true;
      transaction.controller.abort();
      throw new NavigationCancelled();
    }

    const instruction: RouteGuardRedirect = typeof result === 'string'
      ? { target: result }
      : result;
    const { replace = true, ...hrefOptions } = instruction.options ?? {};
    transaction.redirect = {
      path: context._resolveGuardRedirect(instruction.target, instruction.params, hrefOptions),
      replace,
    };
    transaction.cancelled = true;
    transaction.controller.abort();
    throw new NavigationCancelled();
  }

  private runActivationOutsideNavigation(
    context: RouteContext,
    callback: RouteCanLoadCallback | null,
    activate: () => void | Promise<void>,
  ): void | Promise<void> {
    if (callback == null) {
      return activate();
    }
    const controller = this.createAbortController();
    const result = callback({ route: context, signal: controller.signal });
    if (isPromise(result)) {
      return result.then(value => {
        if (value !== false) {
          return activate();
        }
        if (context._guardFailure === 'local') {
          this.rejectGuardLocally(context);
        }
      });
    }
    if (result !== false) {
      return activate();
    }
    if (context._guardFailure === 'local') {
      this.rejectGuardLocally(context);
    }
  }

  private rejectGuardLocally(context: RouteContext): void {
    const recovered = context._rejectGuardLocally();
    if (__DEV__ && !recovered) {
      console.warn(`[au-route] The locally denied route "${context.fullPath}" has no matching sibling fallback or route.`);
    }
  }

  private captureFailure(transaction: NavigationTransaction, error: unknown): void {
    if (error instanceof NavigationCancelled) {
      return;
    }
    transaction.error ??= error;
    transaction.controller.abort();
  }

  private assertNoRedirectLoop(path: string, chain: string[]): void {
    const loopStart = chain.indexOf(path);
    if (loopStart >= 0) {
      throw new Error(`Redirect loop detected: ${[...chain.slice(loopStart), path].join(' -> ')}`);
    }
  }

  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.currentPath);
    }
  }

  private restorePreviousLocation(transaction: NavigationTransaction): void {
    this._isRollingBack = true;
    try {
      if (!transaction.previousActive && this.root instanceof RouteContext) {
        this.root._restoreInactive(transaction.previousLocation);
      } else {
        this.root.apply(transaction.previousLocation.pathname, transaction.previousLocation);
      }
    } finally {
      this._isRollingBack = false;
    }
  }

}
