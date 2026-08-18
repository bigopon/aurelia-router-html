import { DI, isPromise } from '@aurelia/kernel';
import type { RouteCanLoadCallback, RouteCanUnloadCallback, RouteGuardContext, RouteGuardRedirect, RouteGuardResult } from './guard';
import { RoutePhaseError, type RouteErrorResult, type RouteFailure, type RouteFailurePhase } from './error';
import type { IPathAdapter } from './path-adapter';
import { RouteContext, type IRouteContext } from './route-context';
import { parseRouteLocation, stringifyRouteLocation, type RouteLocation } from './route-location';
import { type IRouteFocusService, noRouteFocusService } from './focus';
import { type IRouteScrollService, noRouteScrollService, type RouteScrollNavigation } from './scroll';
import type { RouteLifecycleContext } from './lifecycle';

declare const __DEV__: boolean;

export interface LoadOptions {
  replace?: boolean;
}

interface InternalLoadOptions extends LoadOptions {
  redirect?: boolean;
  chain?: string[];
  external?: boolean;
  initial?: boolean;
  scrollNavigation?: RouteScrollNavigation;
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
  readonly usedErrorBoundaries: Set<RouteContext>;
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
    private readonly scrollService: IRouteScrollService = noRouteScrollService,
    private readonly focusService: IRouteFocusService = noRouteFocusService,
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
    this.scrollService.start();
    this.focusService.start();
    this.stopListening = this.adapter.subscribe(path => {
      const result = this.navigate(path, { external: true, scrollNavigation: 'external' });
      if (isPromise(result)) {
        void result.catch(() => {});
      }
    });
    return this.navigate(this.adapter.getCurrentPath(), {
      external: true,
      initial: true,
      scrollNavigation: 'initial',
    });
  }

  public stop(): void {
    if (!this.started) {
      return;
    }
    this.stopListening?.();
    this.stopListening = null;
    this.started = false;
    this.transaction?.controller.abort();
    this.focusService.stop();
    this.scrollService.stop();
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
    const complete = (): void => {
      transaction.pending--;
      this.tryFinish(transaction);
    };
    const fail = (error: unknown): never => {
      this.captureFailure(transaction, error);
      complete();
      throw error;
    };
    const recover = (error: unknown): void | Promise<void> => {
      let recovery: void | Promise<void>;
      try {
        recovery = this.resolveRouteFailure(transaction, context, error);
      } catch (recoveryError) {
        return fail(recoveryError);
      }
      if (isPromise(recovery)) {
        return recovery.then(complete, fail);
      }
      complete();
    };

    let result: void | Promise<void>;
    try {
      result = this.runCanLoad(transaction, context, canLoad, activate);
    } catch (error) {
      return recover(error);
    }

    if (!isPromise(result)) {
      complete();
      return;
    }

    return result.then(complete, recover);
  }

  /** @internal */
  public _runRoutePhase<T>(phase: RouteFailurePhase, callback: () => T | Promise<T>): T | Promise<T> {
    let result: T | Promise<T>;
    try {
      result = callback();
    } catch (error) {
      throw error instanceof RoutePhaseError ? error : new RoutePhaseError(phase, error);
    }
    if (!isPromise(result)) {
      return result;
    }
    return result.catch(error => {
      throw error instanceof RoutePhaseError ? error : new RoutePhaseError(phase, error);
    });
  }

  /** @internal */
  public _createLifecycleContext(route: RouteContext): RouteLifecycleContext {
    const transaction = this.transaction;
    return {
      route,
      params: route.$params,
      query: route.$query,
      hash: route.$hash,
      previousData: route._getData(),
      signal: transaction?.controller.signal ?? this.createAbortController().signal,
    };
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

    this.scrollService.beforeNavigation(
      options.scrollNavigation
        ?? (options.replace === true ? 'replace' : 'push'),
    );

    const controller = this.createAbortController();
    const leaving = this.root instanceof RouteContext ? this.root._getLeaving(location.pathname) : [];
    const routeChanged = leaving.length > 0 || !this.root.active;
    const guardContext = (route: RouteContext): RouteGuardContext => ({ route, signal: controller.signal });
    const canUnload = this.runCanUnload(leaving, 0, guardContext);
    if (isPromise(canUnload)) {
      return canUnload.then(allowed => allowed
        ? this.beginNavigation(location, normalizedPath, { ...options, chain }, controller, routeChanged)
        : false);
    }
    return canUnload
      ? this.beginNavigation(location, normalizedPath, { ...options, chain }, controller, routeChanged)
      : false;
  }

  private beginNavigation(
    location: RouteLocation,
    normalizedPath: string,
    options: InternalLoadOptions,
    controller: AbortController,
    routeChanged: boolean,
  ): boolean | Promise<boolean> {
    this.focusService.beforeNavigation(routeChanged);
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
      usedErrorBoundaries: new Set(),
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
      this.focusService.cancelNavigation();
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
      this.focusService.cancelNavigation();
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
          scrollNavigation: transaction.options.scrollNavigation,
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
    this.scrollService.afterNavigation(
      transaction.location,
      transaction.options.scrollNavigation
        ?? (transaction.options.replace === true ? 'replace' : 'push'),
    );
    this.focusService.afterNavigation(
      transaction.options.scrollNavigation
        ?? (transaction.options.replace === true ? 'replace' : 'push'),
    );
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
    const result = this._runRoutePhase('can-load', () => callback({ route: context, signal: transaction.controller.signal }));
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

  private resolveRouteFailure(
    transaction: NavigationTransaction,
    source: RouteContext,
    caught: unknown,
  ): void | Promise<void> {
    if (caught instanceof NavigationCancelled) {
      throw caught;
    }
    if (transaction.cancelled) {
      throw new NavigationCancelled();
    }
    if (transaction.error !== undefined) {
      throw caught instanceof RoutePhaseError ? caught.original : caught;
    }
    const phaseError = caught instanceof RoutePhaseError
      ? caught
      : new RoutePhaseError('activation', caught);
    const recovery = source.parent;
    if (!(recovery instanceof RouteContext)) {
      throw phaseError.original;
    }
    return this.runErrorHandlers(transaction, source, source, recovery, phaseError.phase, phaseError.original);
  }

  private runErrorHandlers(
    transaction: NavigationTransaction,
    source: RouteContext,
    start: RouteContext,
    recovery: RouteContext,
    phase: RouteFailurePhase,
    error: unknown,
  ): void | Promise<void> {
    let boundary: RouteContext | null = start;
    while (boundary != null) {
      const handler = boundary._onError;
      if (handler != null && !transaction.usedErrorBoundaries.has(boundary)) {
        const failure: RouteFailure = {
          error,
          source,
          boundary,
          recovery,
          phase,
          signal: transaction.controller.signal,
        };
        let result: RouteErrorResult | Promise<RouteErrorResult>;
        try {
          result = handler(failure);
        } catch (handlerError) {
          throw this.createHandlerError(error, handlerError);
        }
        if (isPromise(result)) {
          const nextBoundary = boundary.parent instanceof RouteContext ? boundary.parent : null;
          return result.then(
            value => this.handleErrorResult(transaction, failure, value, nextBoundary),
            handlerError => {
              if (transaction.cancelled) {
                throw new NavigationCancelled();
              }
              throw this.createHandlerError(error, handlerError);
            },
          );
        }
        return this.handleErrorResult(
          transaction,
          failure,
          result,
          boundary.parent instanceof RouteContext ? boundary.parent : null,
        );
      }
      boundary = boundary.parent instanceof RouteContext ? boundary.parent : null;
    }
    throw error;
  }

  private handleErrorResult(
    transaction: NavigationTransaction,
    failure: RouteFailure,
    result: RouteErrorResult,
    nextBoundary: RouteContext | null,
  ): void | Promise<void> {
    if (transaction.cancelled) {
      throw new NavigationCancelled();
    }
    if (result == null || result === false) {
      if (nextBoundary == null) {
        throw failure.error;
      }
      return this.runErrorHandlers(
        transaction,
        failure.source as RouteContext,
        nextBoundary,
        failure.recovery as RouteContext,
        failure.phase,
        failure.error,
      );
    }
    if (typeof result === 'object' && 'recover' in result) {
      if (result.recover !== 'local') {
        throw this.createHandlerError(failure.error, new Error(`Unknown route recovery mode "${String(result.recover)}".`));
      }
      transaction.usedErrorBoundaries.add(failure.boundary as RouteContext);
      const recovered = (failure.source as RouteContext)._excludeLocally(failure);
      if (__DEV__ && !recovered) {
        console.warn(`[au-route] The locally recovered route "${failure.source.fullPath}" has no matching sibling fallback or route.`);
      }
      return;
    }

    const instruction: RouteGuardRedirect = typeof result === 'string'
      ? { target: result }
      : result;
    if (typeof instruction !== 'object' || instruction == null || !('target' in instruction)) {
      throw this.createHandlerError(failure.error, new Error('An on-error callback returned an unsupported recovery result.'));
    }
    transaction.usedErrorBoundaries.add(failure.boundary as RouteContext);
    const { replace = true, ...hrefOptions } = instruction.options ?? {};
    transaction.redirect = {
      path: (failure.boundary as RouteContext)._resolveGuardRedirect(instruction.target, instruction.params, hrefOptions),
      replace,
    };
    transaction.cancelled = true;
    transaction.controller.abort();
  }

  private createHandlerError(original: unknown, handlerError: unknown): AggregateError {
    return new AggregateError([original, handlerError], 'A route error handler failed.');
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
    const recovered = context._excludeLocally();
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
