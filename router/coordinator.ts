import { DI, isPromise } from '@aurelia/kernel';
import type { RouteCanLoadCallback, RouteCanUnloadCallback, RouteGuardContext, RouteGuardRedirect, RouteGuardResult } from './guard';
import { RoutePhaseError, type RouteErrorResult, type RouteFailure, type RouteFailurePhase } from './error';
import type { IPathAdapter, PathNavigation } from './path-adapter';
import { RouteContext, type ActiveRouteSnapshot, type IRouteContext } from './route-context';
import { parseRouteLocation, stringifyRouteLocation, type RouteLocation } from './route-location';
import { type IRouteFocusService, noRouteFocusService } from './focus';
import { type IRouteScrollService, noRouteScrollService, type RouteScrollNavigation } from './scroll';
import type { RouteLifecycleContext, RouteLifecycleKind, RouteTransitionCause, RouteTransitionPlan, RouteValueSnapshot } from './lifecycle';
import type { IRouteViewSettlement } from './settlement';

declare const __DEV__: boolean;

export interface LoadOptions {
  replace?: boolean;
  reload?: boolean;
  plan?: RouteTransitionPlan;
}

export type RouteNavigationPhase = 'idle' | 'guarding' | 'loading' | 'activating' | 'settling' | 'committing';
export type RouteNavigationSource = 'initial' | 'load' | 'external' | 'redirect';
export type RouteNavigationOutcome = 'completed' | 'cancelled' | 'failed' | 'superseded';

export interface RouteNavigationResult {
  readonly id: number;
  readonly outcome: RouteNavigationOutcome;
  readonly requested: RouteLocation;
  readonly committed: RouteLocation;
  readonly error?: unknown;
}

export interface RouteNavigationState {
  readonly id: number;
  readonly pending: boolean;
  readonly phase: RouteNavigationPhase;
  readonly source: RouteNavigationSource | null;
  readonly from: RouteLocation;
  readonly to: RouteLocation | null;
  readonly href: string | null;
  readonly signal: AbortSignal | null;
  readonly result: RouteNavigationResult | null;
}

export type RouteNavigationCallback = (state: RouteNavigationState) => void;

interface InternalLoadOptions extends LoadOptions {
  redirect?: boolean;
  chain?: string[];
  external?: boolean;
  initial?: boolean;
  scrollNavigation?: RouteScrollNavigation;
  adapterNavigation?: PathNavigation;
  source?: RouteNavigationSource;
}

interface RetainedRouteTransitionWork {
  readonly context: RouteContext;
  readonly canLoad: RouteCanLoadCallback | null;
  readonly lifecycle: RouteLifecycleContext;
  readonly plan: Exclude<RouteTransitionPlan, 'none'>;
  readonly transition: (context: RouteLifecycleContext) => void | Promise<void>;
  readonly complete: ((context: RouteLifecycleContext) => void | Promise<void>) | null;
}

interface RouteActivationWork {
  readonly context: RouteContext;
  readonly canLoad: RouteCanLoadCallback | null;
  readonly lifecycle: RouteLifecycleContext;
  readonly activate: () => void | Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

interface RouteViewTransaction {
  readonly commit: () => void;
  readonly rollback: () => void | Promise<void>;
}

export interface IRouteCoordinator {
  readonly root: IRouteContext;
  readonly currentPath: string;
  readonly currentLocation: RouteLocation;
  readonly navigation: RouteNavigationState;

  start(): boolean | Promise<boolean>;
  stop(): void;
  load(path: string, options?: LoadOptions): boolean | Promise<boolean>;
  getActiveSnapshot(): ActiveRouteSnapshot;
  subscribe(callback: (path: string) => void): () => void;
  subscribeNavigation(callback: RouteNavigationCallback): () => void;
}

export const IRouteCoordinator = DI.createInterface<IRouteCoordinator>('IRouteCoordinator');

class NavigationCancelled extends Error {}

interface NavigationTransaction {
  readonly id: number;
  readonly location: RouteLocation;
  readonly normalizedPath: string;
  readonly previousLocation: RouteLocation;
  readonly previousActive: boolean;
  readonly options: InternalLoadOptions;
  readonly controller: AbortController;
  readonly checked: Set<RouteContext>;
  readonly retainedContexts: Set<RouteContext>;
  readonly retainedTransitions: RetainedRouteTransitionWork[];
  readonly obsoleteContexts: Set<RouteContext>;
  readonly usedErrorBoundaries: Set<RouteContext>;
  readonly activations: RouteActivationWork[];
  readonly viewTransactions: RouteViewTransaction[];
  readonly deferActivations: boolean;
  activeReplacement: RouteContext | null;
  retainedTransitionsComplete: boolean;
  pending: number;
  sealed: boolean;
  cancelled: boolean;
  error: unknown;
  redirect: { path: string; replace: boolean } | null;
  enterAnimations: Array<() => void | Promise<void>>;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
  completion: Promise<boolean>;
  treeStarted: boolean;
  finalized: boolean;
  finalizing: boolean;
  committing: boolean;
  superseded: boolean;
}

export class RouteCoordinator implements IRouteCoordinator {
  public currentPath: string = '/';
  public currentLocation: RouteLocation = parseRouteLocation('/');
  public navigation: RouteNavigationState = createIdleNavigationState(this.currentLocation);
  /** @internal */
  private readonly subscribers = new Set<(path: string) => void>();
  /** @internal */
  private readonly navigationSubscribers = new Set<RouteNavigationCallback>();
  /** @internal */
  private stopListening: (() => void) | null = null;
  /** @internal */
  private readonly stopRegistryListening: (() => void) | null;
  /** @internal */
  private stopping: Promise<void> | null = null;
  /** @internal */
  private started: boolean = false;
  /** @internal */
  private transaction: NavigationTransaction | null = null;
  /** @internal */
  private redirectChain: string[] = [];
  /** @internal */
  private navigationSequence: number = 0;
  /** @internal */
  private rollbackDepth: number = 0;
  /** @internal */
  private readonly adapter: IPathAdapter;
  /** @internal */
  private readonly createAbortController: () => AbortController;
  /** @internal */
  private readonly scrollService: IRouteScrollService;
  /** @internal */
  private readonly focusService: IRouteFocusService;
  /** @internal */
  private readonly viewSettlement: IRouteViewSettlement | null;

  /** @internal */
  public get _isRollingBack(): boolean {
    return this.rollbackDepth > 0;
  }

  public constructor(
    public readonly root: IRouteContext,
    adapter: IPathAdapter,
    createAbortController: () => AbortController = () => new AbortController(),
    scrollService: IRouteScrollService = noRouteScrollService,
    focusService: IRouteFocusService = noRouteFocusService,
    viewSettlement: IRouteViewSettlement | null = null,
  ) {
    this.adapter = adapter;
    this.createAbortController = createAbortController;
    this.scrollService = scrollService;
    this.focusService = focusService;
    this.viewSettlement = viewSettlement;
    if (root instanceof RouteContext) {
      root._setNavigator((path, options) => this.load(path, options));
      this.stopRegistryListening = root._subscribeRegistry(() => {
        if (!this.started || this.transaction != null) {
          return;
        }
        this.root.apply(this.currentLocation.pathname, this.currentLocation);
      });
    } else {
      this.stopRegistryListening = null;
    }
  }

  public start(): boolean | Promise<boolean> {
    if (this.started) {
      return true;
    }
    if (this.stopping != null) {
      return this.stopping.then(() => this.start());
    }

    this.started = true;
    this.scrollService.start();
    this.focusService.start();
    this.stopListening = this.adapter.subscribe((path, adapterNavigation) => {
      if (!this.started) {
        return;
      }
      const result = this.navigate(path, {
        adapterNavigation,
        external: adapterNavigation?.kind !== 'intent',
        scrollNavigation: adapterNavigation?.kind === 'traverse' ? 'external' : 'push',
        source: 'external',
      });
      if (isPromise(result)) {
        void result.catch(() => {});
      }
    });
    return this.navigate(this.adapter.getCurrentPath(), {
      external: true,
      initial: true,
      scrollNavigation: 'initial',
      source: 'initial',
    });
  }

  public stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    const finish = (): void => {
      this.stopListening?.();
      this.stopListening = null;
      this.stopRegistryListening?.();
      this.focusService.stop();
      this.scrollService.stop();
    };
    const transaction = this.transaction;
    if (transaction != null) {
      const cancellation = this.cancelTransaction(transaction, 'cancelled');
      if (isPromise(cancellation)) {
        const stopping = cancellation.then(
          () => finish(),
          () => finish(),
        );
        this.stopping = stopping;
        void stopping.then(() => {
          if (this.stopping === stopping) {
            this.stopping = null;
          }
        });
        return;
      }
    }
    finish();
  }

  public load(path: string, options: InternalLoadOptions = {}): boolean | Promise<boolean> {
    return this.navigate(path, options);
  }

  /** @internal */
  public _runRouteActivation(
    context: RouteContext,
    canLoad: RouteCanLoadCallback | null,
    lifecycle: RouteLifecycleContext,
    activate: () => void | Promise<void>,
    skipCanLoad: boolean = false,
  ): void | Promise<void> {
    if (this._isRollingBack) {
      return activate();
    }
    const transaction = this.transaction;
    if (transaction == null) {
      return this.runActivationOutsideNavigation(context, canLoad, lifecycle, activate);
    }

    const activeReplacement = transaction.activeReplacement;
    const isReplacementDescendant = activeReplacement != null && context._isDescendantOf(activeReplacement);
    if (transaction.deferActivations && !transaction.retainedTransitionsComplete && !isReplacementDescendant) {
      transaction.pending++;
      return new Promise<void>((resolve, reject) => {
        transaction.activations.push({ context, canLoad, lifecycle, activate, resolve, reject });
      });
    }

    transaction.pending++;
    const complete = (): void => {
      transaction.pending = Math.max(0, transaction.pending - 1);
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
        return this.raceTransaction(transaction, recovery).then(complete, fail);
      }
      complete();
    };

    let result: void | Promise<void>;
    try {
      result = skipCanLoad ? activate() : this.runCanLoad(transaction, context, canLoad, lifecycle, activate);
    } catch (error) {
      return recover(error);
    }

    if (!isPromise(result)) {
      complete();
      return;
    }

    return this.raceTransaction(transaction, result).then(complete, recover);
  }

  /** @internal */
  public _runCanLoadOnly(
    context: RouteContext,
    canLoad: RouteCanLoadCallback | null,
    lifecycle: RouteLifecycleContext,
  ): void | Promise<void> {
    if (canLoad == null) {
      return;
    }
    const transaction = this.transaction;
    if (transaction == null) {
      return this.runActivationOutsideNavigation(context, canLoad, lifecycle, () => {});
    }
    return this.runCanLoad(transaction, context, canLoad, lifecycle, () => {});
  }

  /** @internal */
  public _runRetainedTransition(
    context: RouteContext,
    canLoad: RouteCanLoadCallback | null,
    from: RouteValueSnapshot,
    changes: readonly RouteTransitionCause[],
    plan: Exclude<RouteTransitionPlan, 'none'>,
    transition: (context: RouteLifecycleContext) => void | Promise<void>,
    complete: ((context: RouteLifecycleContext) => void | Promise<void>) | null = null,
  ): void | Promise<void> {
    const transaction = this.transaction;
    const lifecycle = this._createLifecycleContext(context, plan, from, changes);
    if (transaction == null) {
      return this.runRetainedTransitionOutsideNavigation(context, canLoad, lifecycle, transition, complete);
    }

    if (transaction.finalized || transaction.retainedContexts.has(context)) {
      return;
    }
    transaction.retainedContexts.add(context);
    const work: RetainedRouteTransitionWork = { context, canLoad, lifecycle, plan, transition, complete };
    if (!transaction.sealed) {
      transaction.retainedTransitions.push(work);
      return;
    }
    return this.trackRetainedTransitions(transaction, [work]);
  }

  /** @internal */
  public _runRoutePhase<T>(phase: RouteFailurePhase, callback: () => T | Promise<T>): T | Promise<T> {
    const transaction = this.transaction;
    if (transaction != null) {
      this.publishPhase(transaction, navigationPhaseForRoutePhase(phase));
    }
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
  public _createLifecycleContext(
    route: RouteContext,
    kind: RouteLifecycleKind = 'enter',
    from: RouteValueSnapshot | null = null,
    changes: readonly RouteTransitionCause[] = [],
  ): RouteLifecycleContext {
    const transaction = this.transaction;
    const to = routeValueSnapshot(route);
    return Object.freeze({
      kind,
      route,
      from,
      to,
      changes: Object.freeze([...changes]),
      params: to.params,
      query: to.query,
      hash: to.hash,
      previousData: Object.freeze(route._getData()),
      signal: transaction?.controller.signal ?? this.createAbortController().signal,
    });
  }

  /** @internal */
  public _getTransitionPlan(configured: RouteTransitionPlan): RouteTransitionPlan {
    return this.transaction?.options.plan ?? configured;
  }

  /** @internal */
  public _isReplacementDescendantActivation(context: RouteContext): boolean {
    const replacement = this.transaction?.activeReplacement;
    return replacement != null && context._isDescendantOf(replacement);
  }

  /** @internal */
  public _registerViewTransaction(
    commit: () => void,
    rollback: () => void | Promise<void>,
  ): boolean {
    const transaction = this.transaction;
    if (transaction == null || transaction.finalized) {
      return false;
    }
    transaction.viewTransactions.push({ commit, rollback });
    return true;
  }

  /** @internal */
  public _runViewRollback(rollback: () => void | Promise<void>): void | Promise<void> {
    this.rollbackDepth++;
    let result: void | Promise<void>;
    try {
      result = rollback();
    } catch (error) {
      this.rollbackDepth--;
      throw error;
    }
    if (isPromise(result)) {
      return result.then(
        () => { this.rollbackDepth--; },
        error => {
          this.rollbackDepth--;
          throw error;
        },
      );
    }
    this.rollbackDepth--;
  }

  /** @internal */
  public _isReloadNavigation(): boolean {
    return this.transaction?.options.reload === true;
  }

  /** @internal */
  public _assertNavigationSignal(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new NavigationCancelled();
    }
  }

  /** @internal */
  public _runEnterAnimation(animation: () => void | Promise<void>): void | Promise<void> {
    const transaction = this.transaction;
    if (transaction == null) {
      return animation();
    }
    transaction.enterAnimations.push(animation);
  }

  public getActiveSnapshot(): ActiveRouteSnapshot {
    const snapshot = this.root.getActiveSnapshot();
    return Object.freeze({
      path: this.currentPath,
      matches: snapshot.matches,
      branches: snapshot.branches,
    });
  }

  public subscribe(callback: (path: string) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentPath);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public subscribeNavigation(callback: RouteNavigationCallback): () => void {
    this.navigationSubscribers.add(callback);
    callback(this.navigation);
    return () => {
      this.navigationSubscribers.delete(callback);
    };
  }

  /** @internal */
  private navigate(path: string, options: InternalLoadOptions): boolean | Promise<boolean> {
    const location = parseRouteLocation(path);
    const normalizedPath = stringifyRouteLocation(location);
    const active = this.transaction;
    if (active != null) {
      if (active.committing) {
        return active.completion.then(
          () => this.navigate(normalizedPath, options),
          () => this.navigate(normalizedPath, options),
        );
      }
      if (options.redirect === true) {
        this.assertNoRedirectLoop(normalizedPath, options.chain ?? this.redirectChain);
        active.redirect = { path: normalizedPath, replace: options.replace !== false };
        active.cancelled = true;
        active.controller.abort();
        return active.completion;
      }

      active.superseded = true;
      const keepLatestTraversal =
        active.options.adapterNavigation?.kind === 'traverse'
        && options.adapterNavigation?.kind === 'traverse';
      const cancelled = this.cancelTransaction(active, 'superseded', undefined, false, !keepLatestTraversal);
      return isPromise(cancelled)
        ? cancelled.then(
          () => this.navigate(normalizedPath, options),
          () => this.navigate(normalizedPath, options),
        )
        : this.navigate(normalizedPath, options);
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
    const transaction = this.createTransaction(location, normalizedPath, { ...options, chain }, controller);
    this.transaction = transaction;
    this.publishNavigation(transaction, 'guarding');
    const leaving = this.root instanceof RouteContext
      ? this.root._getLeaving(location.pathname, location, options.reload === true, options.plan)
      : [];
    const routeChanged = leaving.length > 0 || !this.root.active;
    const guardContext = (route: RouteContext): RouteGuardContext => ({ route, signal: controller.signal });
    let canUnload: boolean | Promise<boolean>;
    try {
      canUnload = this.runCanUnload(leaving, 0, guardContext);
    } catch (error) {
      return this.cancelTransaction(transaction, 'failed', error, true);
    }
    if (isPromise(canUnload)) {
      void this.raceTransaction(transaction, canUnload).then(
        allowed => {
          if (transaction.finalized) {
            return;
          }
          if (allowed) {
            this.beginNavigation(transaction, routeChanged);
          } else {
            this.cancelTransaction(transaction, 'cancelled');
          }
        },
        error => {
          if (error instanceof NavigationCancelled) {
            this.cancelTransaction(transaction, transaction.superseded ? 'superseded' : 'cancelled');
          } else {
            this.cancelTransaction(transaction, 'failed', error);
          }
        },
      );
      return transaction.completion;
    }
    return canUnload
      ? this.beginNavigation(transaction, routeChanged)
      : this.cancelTransaction(transaction, 'cancelled');
  }

  /** @internal */
  private beginNavigation(
    transaction: NavigationTransaction,
    routeChanged: boolean,
  ): boolean | Promise<boolean> {
    if (transaction.finalized || this.transaction !== transaction) {
      return transaction.completion;
    }
    this.focusService.beforeNavigation(routeChanged);
    transaction.treeStarted = true;
    if (this.root instanceof RouteContext) {
      this.root._beginNavigationTransaction();
    }

    try {
      if (this.root instanceof RouteContext) {
        this.root._setReloadRequested(transaction.options.reload === true);
      }
      this.root.apply(transaction.location.pathname, transaction.location);
    } catch (error) {
      this.captureFailure(transaction, error);
    } finally {
      if (this.root instanceof RouteContext) {
        this.root._setReloadRequested(false);
      }
    }
    let retainedTransitions: void | Promise<void>;
    if (!transaction.cancelled && transaction.error === undefined && transaction.retainedTransitions.length > 0) {
      try {
        const prepared = this.prepareRetainedTransitions(transaction, transaction.retainedTransitions);
        retainedTransitions = this.trackRetainedTransitions(transaction, prepared);
      } catch (error) {
        this.captureFailure(transaction, error);
      }
    }
    transaction.sealed = true;
    if (transaction.deferActivations) {
      if (isPromise(retainedTransitions!)) {
        void retainedTransitions.then(
          () => {
            transaction.retainedTransitionsComplete = true;
            this.tryFinish(transaction);
          },
          () => {
            transaction.retainedTransitionsComplete = true;
            this.rejectDeferredActivations(transaction);
            this.tryFinish(transaction);
          },
        );
      } else {
        transaction.retainedTransitionsComplete = true;
        if (transaction.cancelled || transaction.error !== undefined) {
          this.rejectDeferredActivations(transaction);
        } else {
          this.runDeferredActivations(transaction);
        }
      }
    } else {
      transaction.retainedTransitionsComplete = true;
    }
    if (transaction.pending === 0 && transaction.error !== undefined) {
      return this.cancelTransaction(transaction, 'failed', transaction.error, true);
    }
    const result = this.tryFinish(transaction);
    return result ?? transaction.completion;
  }

  /** @internal */
  private runDeferredActivations(transaction: NavigationTransaction): void | Promise<void> {
    const activations = transaction.activations.splice(0);
    const pending: Promise<void>[] = [];
    let synchronousError: unknown;
    let hasSynchronousError = false;
    transaction.pending++;
    for (const work of activations) {
      transaction.pending = Math.max(0, transaction.pending - 1);
      if (
        transaction.finalized
        || transaction.cancelled
        || this.transaction !== transaction
        || transaction.obsoleteContexts.has(work.context)
        || work.context._isDisposed()
        || !work.context.active
      ) {
        work.resolve();
        continue;
      }

      let result: void | Promise<void>;
      try {
        result = this._runRouteActivation(work.context, work.canLoad, work.lifecycle, work.activate);
      } catch (error) {
        work.reject(error);
        if (!hasSynchronousError) {
          synchronousError = error;
          hasSynchronousError = true;
        }
        continue;
      }
      if (isPromise(result)) {
        pending.push(result.then(
          () => work.resolve(),
          error => {
            work.reject(error);
            throw error;
          },
        ));
      } else {
        work.resolve();
      }
    }
    transaction.pending = Math.max(0, transaction.pending - 1);
    if (hasSynchronousError) {
      if (pending.length === 0) {
        throw synchronousError;
      }
      return Promise.allSettled(pending).then(() => { throw synchronousError; });
    }
    if (pending.length > 0) {
      return Promise.all(pending).then(() => {});
    }
  }

  /** @internal */
  private rejectDeferredActivations(transaction: NavigationTransaction): void {
    const activations = transaction.activations.splice(0);
    for (const work of activations) {
      transaction.pending = Math.max(0, transaction.pending - 1);
      work.reject(new NavigationCancelled());
    }
  }

  /** @internal */
  private tryFinish(transaction: NavigationTransaction): boolean | Promise<boolean> | undefined {
    if (transaction.finalized || transaction.finalizing || !transaction.sealed || transaction.pending > 0 || this.transaction !== transaction) {
      return;
    }

    const failed = transaction.cancelled || transaction.error !== undefined || transaction.redirect != null;
    if (failed) {
      if (transaction.redirect != null) {
        return this.redirectTransaction(transaction);
      }
      return this.cancelTransaction(
        transaction,
        transaction.error === undefined ? transaction.superseded ? 'superseded' : 'cancelled' : 'failed',
        transaction.error,
      );
    }

    const settledViews = this.viewSettlement?.whenSettled?.();
    if (isPromise(settledViews!)) {
      transaction.finalizing = true;
      this.publishPhase(transaction, 'settling');
      void this.raceTransaction(transaction, settledViews).then(
        () => {
          if (transaction.finalized) {
            return;
          }
          transaction.finalizing = false;
          this.tryFinish(transaction);
        },
        error => {
          if (transaction.finalized || error instanceof NavigationCancelled) {
            return;
          }
          transaction.finalizing = false;
          this.cancelTransaction(transaction, 'failed', error);
        },
      );
      return transaction.completion;
    }

    transaction.finalizing = true;
    transaction.committing = true;
    this.publishPhase(transaction, 'committing');
    let adapterCommit: void | Promise<void>;
    try {
      const adapterNavigation = transaction.options.adapterNavigation;
      if (adapterNavigation != null) {
        adapterCommit = adapterNavigation.commit(transaction.normalizedPath, {
          replace: transaction.options.replace,
        });
      } else if (transaction.options.external !== true) {
        adapterCommit = transaction.options.replace === true
          ? this.adapter.replace(transaction.normalizedPath)
          : this.adapter.push(transaction.normalizedPath);
      }
    } catch (error) {
      transaction.finalizing = false;
      transaction.committing = false;
      return this.cancelTransaction(transaction, 'failed', error);
    }
    if (isPromise(adapterCommit!)) {
      void adapterCommit.then(
        () => this.commitTransaction(transaction),
        error => {
          transaction.finalizing = false;
          transaction.committing = false;
          this.cancelTransaction(transaction, 'failed', error);
        },
      );
      return transaction.completion;
    }
    return this.commitTransaction(transaction);
  }

  /** @internal */
  private commitTransaction(transaction: NavigationTransaction): boolean {
    if (transaction.finalized) {
      return false;
    }
    transaction.finalized = true;
    transaction.finalizing = false;
    transaction.committing = false;
    if (this.transaction === transaction) {
      this.transaction = null;
    }
    this.commitViewTransactions(transaction);
    if (this.root instanceof RouteContext) {
      this.root._commitNavigationTransaction();
    }
    const enterAnimations: Promise<unknown>[] = [];
    for (const animation of transaction.enterAnimations) {
      try {
        const result = animation();
        if (isPromise(result)) {
          enterAnimations.push(result);
        }
      } catch {
        // Animation failure must not roll back an already committed navigation.
      }
    }
    this.currentLocation = transaction.location;
    this.currentPath = transaction.location.pathname;
    this.notify();
    const navigation = transaction.options.scrollNavigation
      ?? (transaction.options.replace === true ? 'replace' : 'push');
    const runPostCommitEffects = (): void => {
      if (this.navigation.id !== transaction.id || this.navigation.pending) {
        return;
      }
      this.scrollService.afterNavigation(transaction.location, navigation);
      this.focusService.afterNavigation(navigation);
    };
    if (enterAnimations.length === 0) {
      runPostCommitEffects();
    } else {
      void Promise.allSettled(enterAnimations).then(() => {
        runPostCommitEffects();
      });
    }
    transaction.resolve(true);
    this.publishTerminal(transaction, 'completed');
    this.redirectChain = [];
    return true;
  }

  /** @internal */
  private createTransaction(
    location: RouteLocation,
    normalizedPath: string,
    options: InternalLoadOptions,
    controller: AbortController,
  ): NavigationTransaction {
    let resolve!: (value: boolean) => void;
    let reject!: (reason: unknown) => void;
    const completion = new Promise<boolean>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      id: ++this.navigationSequence,
      location,
      normalizedPath,
      previousLocation: this.currentLocation,
      previousActive: this.root.active,
      options,
      controller,
      checked: new Set(),
      retainedContexts: new Set(),
      retainedTransitions: [],
      obsoleteContexts: new Set(),
      usedErrorBoundaries: new Set(),
      activations: [],
      viewTransactions: [],
      deferActivations: this.root instanceof RouteContext
        && this.root._hasRetainedTransitionWork(location.pathname, location, options.reload === true, options.plan),
      activeReplacement: null,
      retainedTransitionsComplete: false,
      pending: 0,
      sealed: false,
      cancelled: false,
      error: undefined,
      redirect: null,
      enterAnimations: [],
      resolve,
      reject,
      completion,
      treeStarted: false,
      finalized: false,
      finalizing: false,
      committing: false,
      superseded: false,
    };
  }

  /** @internal */
  private cancelTransaction(
    transaction: NavigationTransaction,
    outcome: Exclude<RouteNavigationOutcome, 'completed'>,
    error?: unknown,
    throwSynchronously: boolean = false,
    rollbackAdapter: boolean = true,
  ): boolean | Promise<boolean> {
    if (transaction.finalized) {
      return transaction.completion;
    }
    transaction.finalized = true;
    transaction.finalizing = false;
    transaction.committing = false;
    transaction.cancelled = true;
    transaction.controller.abort();
    this.rejectDeferredActivations(transaction);
    this.focusService.cancelNavigation();
    if (transaction.treeStarted && this.root instanceof RouteContext) {
      this.root._cancelNavigationTransaction();
      this.restorePreviousLocation(transaction);
    }

    const pendingRollbacks: Promise<void>[] = [];
    const recordRollbackError = (rollbackError: unknown): void => {
      error = error === undefined
        ? rollbackError
        : new AggregateError([error, rollbackError], 'Navigation and rollback both failed.');
      outcome = 'failed';
    };
    try {
      const viewRollback = this.rollbackViewTransactions(transaction);
      if (isPromise(viewRollback!)) {
        pendingRollbacks.push(viewRollback);
      }
    } catch (rollbackError) {
      recordRollbackError(rollbackError);
    }
    try {
      let adapterRollback: void | Promise<void>;
      if (transaction.options.adapterNavigation != null) {
        if (rollbackAdapter) {
          adapterRollback = transaction.options.adapterNavigation.rollback();
        }
      } else if (transaction.options.external === true && transaction.options.initial !== true) {
        this.adapter.replace(stringifyRouteLocation(transaction.previousLocation));
      }
      if (isPromise(adapterRollback!)) {
        pendingRollbacks.push(adapterRollback);
      }
    } catch (rollbackError) {
      recordRollbackError(rollbackError);
    }

    const settle = (): boolean => {
      if (this.transaction === transaction) {
        this.transaction = null;
      }
      if (error !== undefined) {
        this.publishTerminal(transaction, 'failed', error);
        transaction.reject(error);
        return false;
      }
      this.publishTerminal(transaction, outcome);
      transaction.resolve(false);
      return false;
    };
    if (pendingRollbacks.length > 0) {
      void Promise.allSettled(pendingRollbacks).then(results => {
        for (const result of results) {
          if (result.status === 'rejected') {
            recordRollbackError(result.reason);
          }
        }
        settle();
      });
      return transaction.completion;
    }
    const settled = settle();
    if (error !== undefined) {
      if (throwSynchronously) {
        void transaction.completion.catch(() => {});
        throw error;
      }
      return transaction.completion;
    }
    return settled;
  }

  /** @internal */
  private redirectTransaction(transaction: NavigationTransaction): boolean | Promise<boolean> {
    const { path, replace } = transaction.redirect!;
    transaction.finalized = true;
    transaction.finalizing = true;
    transaction.committing = false;
    transaction.cancelled = true;
    transaction.controller.abort();
    this.rejectDeferredActivations(transaction);
    this.focusService.cancelNavigation();
    if (transaction.treeStarted && this.root instanceof RouteContext) {
      this.root._cancelNavigationTransaction();
      this.restorePreviousLocation(transaction);
    }

    const continueNavigation = (
      adapterNavigation: PathNavigation | undefined,
      throwSynchronously: boolean,
    ): boolean | Promise<boolean> => {
      transaction.finalizing = false;
      transaction.committing = false;
      if (this.transaction === transaction) {
        this.transaction = null;
      }
      try {
        return this.continueRedirect(transaction, path, replace, adapterNavigation);
      } catch (error) {
        const failed = this.failRedirectTransaction(transaction, error, adapterNavigation);
        if (throwSynchronously) {
          void failed.catch(() => {});
          throw error;
        }
        return failed;
      }
    };

    const settleAdapter = (throwSynchronously: boolean): boolean | Promise<boolean> => {
      let adapterNavigation = transaction.options.adapterNavigation;
      if (!replace) {
        transaction.committing = true;
        try {
          if (adapterNavigation != null) {
            const committed = adapterNavigation.commit(transaction.normalizedPath, {
              replace: transaction.options.replace,
            });
            if (isPromise(committed)) {
              void committed.then(
                () => { continueNavigation(undefined, false); },
                error => { this.failRedirectTransaction(transaction, error, adapterNavigation); },
              );
              return transaction.completion;
            }
            adapterNavigation = undefined;
          } else if (transaction.options.external !== true) {
            if (transaction.options.replace === true) {
              this.adapter.replace(transaction.normalizedPath);
            } else {
              this.adapter.push(transaction.normalizedPath);
            }
          }
        } catch (error) {
          return this.failRedirectTransaction(transaction, error, adapterNavigation);
        }
      }
      return continueNavigation(adapterNavigation, throwSynchronously);
    };

    let viewRollback: void | Promise<void>;
    try {
      viewRollback = this.rollbackViewTransactions(transaction);
    } catch (error) {
      return this.failRedirectTransaction(transaction, error, transaction.options.adapterNavigation);
    }
    if (isPromise(viewRollback!)) {
      void viewRollback.then(
        () => { settleAdapter(false); },
        error => { this.failRedirectTransaction(transaction, error, transaction.options.adapterNavigation); },
      );
      return transaction.completion;
    }
    return settleAdapter(true);
  }

  /** @internal */
  private continueRedirect(
    transaction: NavigationTransaction,
    path: string,
    replace: boolean,
    adapterNavigation: PathNavigation | undefined,
  ): boolean | Promise<boolean> {
    const replaceDestination = replace
      ? transaction.options.external === true || transaction.options.replace === true
      : false;
    const redirected = this.navigate(path, {
      adapterNavigation,
      external: adapterNavigation?.kind === 'traverse',
      replace: replaceDestination,
      redirect: true,
      chain: transaction.options.chain ?? this.redirectChain,
      scrollNavigation: transaction.options.scrollNavigation,
      source: 'redirect',
    });
    if (isPromise(redirected)) {
      void redirected.then(transaction.resolve, transaction.reject);
      return transaction.completion;
    }
    transaction.resolve(redirected);
    return redirected;
  }

  /** @internal */
  private failRedirectTransaction(
    transaction: NavigationTransaction,
    error: unknown,
    adapterNavigation?: PathNavigation,
  ): Promise<boolean> {
    transaction.finalized = true;
    transaction.finalizing = false;
    transaction.committing = false;
    if (this.transaction == null) {
      this.transaction = transaction;
    }
    const settle = (failure: unknown): void => {
      if (this.transaction === transaction) {
        this.transaction = null;
      }
      this.redirectChain = [];
      this.publishTerminal(transaction, 'failed', failure);
      transaction.reject(failure);
    };

    let rollback: void | Promise<void>;
    try {
      rollback = adapterNavigation?.rollback();
    } catch (rollbackError) {
      settle(new AggregateError([error, rollbackError], 'Redirect and location rollback both failed.'));
      return transaction.completion;
    }
    if (isPromise(rollback!)) {
      void rollback.then(
        () => settle(error),
        rollbackError => settle(new AggregateError([error, rollbackError], 'Redirect and location rollback both failed.')),
      );
      return transaction.completion;
    }
    settle(error);
    return transaction.completion;
  }

  /** @internal */
  private publishNavigation(transaction: NavigationTransaction, phase: RouteNavigationPhase): void {
    this.navigation = Object.freeze({
      id: transaction.id,
      pending: true,
      phase,
      source: transaction.options.source ?? (transaction.options.initial === true
        ? 'initial'
        : transaction.options.external === true ? 'external' : 'load'),
      from: transaction.previousLocation,
      to: transaction.location,
      href: this.adapter.formatHref(transaction.normalizedPath),
      signal: transaction.controller.signal,
      result: null,
    });
    this.notifyNavigation();
  }

  /** @internal */
  private publishPhase(transaction: NavigationTransaction, phase: RouteNavigationPhase): void {
    if (transaction.finalized || this.navigation.id !== transaction.id || !this.navigation.pending || this.navigation.phase === phase) {
      return;
    }
    this.navigation = Object.freeze({
      ...this.navigation,
      phase,
    });
    this.notifyNavigation();
  }

  /** @internal */
  private publishTerminal(
    transaction: NavigationTransaction,
    outcome: RouteNavigationOutcome,
    error?: unknown,
  ): void {
    if (this.navigation.id !== transaction.id) {
      return;
    }
    const result: RouteNavigationResult = Object.freeze({
      id: transaction.id,
      outcome,
      requested: transaction.location,
      committed: this.currentLocation,
      ...(error === undefined ? {} : { error }),
    });
    this.navigation = Object.freeze({
      id: transaction.id,
      pending: false,
      phase: 'idle',
      source: this.navigation.source,
      from: transaction.previousLocation,
      to: null,
      href: null,
      signal: null,
      result,
    });
    this.notifyNavigation();
  }

  /** @internal */
  private notifyNavigation(): void {
    for (const subscriber of this.navigationSubscribers) {
      subscriber(this.navigation);
    }
  }

  /** @internal */
  private raceTransaction<T>(transaction: NavigationTransaction, operation: Promise<T>): Promise<T> {
    const signal = transaction.controller.signal;
    if (signal.aborted || transaction.finalized) {
      return Promise.reject(new NavigationCancelled());
    }
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        signal.removeEventListener('abort', onAbort);
        callback();
      };
      const onAbort = (): void => finish(() => reject(new NavigationCancelled()));
      signal.addEventListener('abort', onAbort, { once: true });
      operation.then(
        value => finish(() => resolve(value)),
        error => finish(() => reject(error)),
      );
    });
  }

  /** @internal */
  private assertActiveTransaction(transaction: NavigationTransaction): void {
    if (
      transaction.cancelled
      || transaction.finalized
      || transaction.controller.signal.aborted
      || this.transaction !== transaction
    ) {
      throw new NavigationCancelled();
    }
  }

  /** @internal */
  private runCanUnload(
    routes: RouteContext[],
    index: number,
    createContext: (route: RouteContext) => RouteGuardContext,
  ): boolean | Promise<boolean> {
    for (let current = index; current < routes.length; current++) {
      const route = routes[current];
      const context = createContext(route);
      if (context.signal.aborted) {
        throw new NavigationCancelled();
      }
      const callback: RouteCanUnloadCallback | null = route._canUnload;
      if (callback == null) {
        continue;
      }
      const result = callback(context);
      if (isPromise(result)) {
        return result.then(allowed => {
          if (context.signal.aborted) {
            throw new NavigationCancelled();
          }
          return allowed === false
            ? false
            : this.runCanUnload(routes, current + 1, createContext);
        });
      }
      if (result === false) {
        return false;
      }
    }
    return true;
  }

  /** @internal */
  private runCanLoad(
    transaction: NavigationTransaction,
    context: RouteContext,
    callback: RouteCanLoadCallback | null,
    lifecycle: RouteLifecycleContext,
    activate: () => void | Promise<void>,
  ): void | Promise<void> {
    const proceed = (): void | Promise<void> => {
      this.assertActiveTransaction(transaction);
      if (!context.active || context._isDisposed()) {
        return;
      }
      return activate();
    };
    const guard = this.evaluateCanLoad(transaction, context, callback, lifecycle);
    return isPromise(guard) ? guard.then(proceed) : proceed();
  }

  /** @internal */
  private evaluateCanLoad(
    transaction: NavigationTransaction,
    context: RouteContext,
    callback: RouteCanLoadCallback | null,
    lifecycle: RouteLifecycleContext,
  ): void | Promise<void> {
    this.assertActiveTransaction(transaction);
    if (callback == null || transaction.checked.has(context)) {
      return;
    }
    transaction.checked.add(context);
    const result = this._runRoutePhase('can-load', () => callback(lifecycle));
    if (isPromise(result)) {
      return result.then(value => this.handleCanLoadResult(transaction, context, value));
    }
    return this.handleCanLoadResult(transaction, context, result);
  }

  /** @internal */
  private handleCanLoadResult(
    transaction: NavigationTransaction,
    context: RouteContext,
    result: RouteGuardResult,
  ): void {
    this.assertActiveTransaction(transaction);
    if (result == null || result === true) {
      return;
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
    const { plan: _plan, reload: _reload, replace = true, ...hrefOptions } = instruction.options ?? {};
    transaction.redirect = {
      path: context._resolveGuardRedirect(instruction.target, instruction.params, hrefOptions),
      replace,
    };
    transaction.cancelled = true;
    transaction.controller.abort();
    throw new NavigationCancelled();
  }

  /** @internal */
  private prepareRetainedTransitions(
    transaction: NavigationTransaction,
    transitions: readonly RetainedRouteTransitionWork[],
  ): readonly RetainedRouteTransitionWork[] {
    const replacements = transitions.filter(work => work.plan === 'replace');
    if (replacements.length === 0) {
      return transitions;
    }

    const isBelowReplacement = (context: RouteContext): boolean => replacements.some(
      replacement => replacement.context !== context && context._isDescendantOf(replacement.context),
    );
    for (const work of transitions) {
      if (isBelowReplacement(work.context)) {
        transaction.obsoleteContexts.add(work.context);
      }
    }
    for (const work of transaction.activations) {
      if (isBelowReplacement(work.context)) {
        transaction.obsoleteContexts.add(work.context);
      }
    }
    return transitions.filter(work => !transaction.obsoleteContexts.has(work.context));
  }

  /** @internal */
  private trackRetainedTransitions(
    transaction: NavigationTransaction,
    transitions: readonly RetainedRouteTransitionWork[],
  ): void | Promise<void> {
    if (transitions.length === 0) {
      return;
    }
    transaction.pending++;
    const complete = (): void => {
      transaction.pending = Math.max(0, transaction.pending - 1);
      this.tryFinish(transaction);
    };
    const fail = (error: unknown): never => {
      this.captureFailure(transaction, error);
      complete();
      throw error;
    };
    const completeTransitions = (): void | Promise<void> => {
      this.assertActiveTransaction(transaction);
      return this.runRetainedTransitionCompletions(transaction, transitions, transitions.length - 1);
    };
    const drainActivations = (): void | Promise<void> => {
      this.assertActiveTransaction(transaction);
      transaction.retainedTransitionsComplete = true;
      const activations = this.runDeferredActivations(transaction);
      return isPromise(activations)
        ? activations.then(completeTransitions)
        : completeTransitions();
    };
    const runTransitions = (): void | Promise<void> => {
      this.assertActiveTransaction(transaction);
      const transitionsStarted = this.runRetainedTransitions(transaction, transitions, 0);
      return isPromise(transitionsStarted)
        ? transitionsStarted.then(drainActivations)
        : drainActivations();
    };

    let result: void | Promise<void>;
    try {
      const guards = this.runRetainedCanLoadGuards(transaction, transitions, 0);
      result = isPromise(guards) ? guards.then(runTransitions) : runTransitions();
    } catch (error) {
      return fail(error);
    }
    if (!isPromise(result)) {
      complete();
      return;
    }
    return this.raceTransaction(transaction, result).then(complete, fail);
  }

  /** @internal */
  private runRetainedCanLoadGuards(
    transaction: NavigationTransaction,
    transitions: readonly RetainedRouteTransitionWork[],
    index: number,
  ): void | Promise<void> {
    for (let current = index; current < transitions.length; current++) {
      this.assertActiveTransaction(transaction);
      const work = transitions[current];
      if (
        work.canLoad == null
        || transaction.obsoleteContexts.has(work.context)
        || work.context._isDisposed()
        || !work.context.active
      ) {
        continue;
      }

      let result: void | Promise<void>;
      try {
        result = this.evaluateCanLoad(transaction, work.context, work.canLoad, work.lifecycle);
      } catch (error) {
        return this.recoverRetainedTransition(
          transaction,
          work,
          error,
          () => this.runRetainedCanLoadGuards(transaction, transitions, current + 1),
        );
      }
      if (isPromise(result)) {
        return result.then(
          () => {
            this.assertActiveTransaction(transaction);
            return this.runRetainedCanLoadGuards(transaction, transitions, current + 1);
          },
          error => this.recoverRetainedTransition(
            transaction,
            work,
            error,
            () => this.runRetainedCanLoadGuards(transaction, transitions, current + 1),
          ),
        );
      }
    }
  }

  /** @internal */
  private runRetainedTransitions(
    transaction: NavigationTransaction,
    transitions: readonly RetainedRouteTransitionWork[],
    index: number,
  ): void | Promise<void> {
    for (let current = index; current < transitions.length; current++) {
      this.assertActiveTransaction(transaction);
      const work = transitions[current];
      if (
        !work.context.active
        || work.context._isDisposed()
        || transaction.obsoleteContexts.has(work.context)
      ) {
        continue;
      }

      let result: void | Promise<void>;
      try {
        result = this.runRetainedTransitionCallback(transaction, work);
      } catch (error) {
        return this.recoverRetainedTransition(
          transaction,
          work,
          error,
          () => this.runRetainedTransitions(transaction, transitions, current + 1),
        );
      }
      if (isPromise(result)) {
        return result.then(
          () => {
            this.assertActiveTransaction(transaction);
            return this.runRetainedTransitions(transaction, transitions, current + 1);
          },
          error => this.recoverRetainedTransition(
            transaction,
            work,
            error,
            () => this.runRetainedTransitions(transaction, transitions, current + 1),
          ),
        );
      }
    }
  }

  /** @internal */
  private runRetainedTransitionCompletions(
    transaction: NavigationTransaction,
    transitions: readonly RetainedRouteTransitionWork[],
    index: number,
  ): void | Promise<void> {
    for (let current = index; current >= 0; current--) {
      this.assertActiveTransaction(transaction);
      const work = transitions[current];
      if (
        work.complete == null
        || !work.context.active
        || work.context._isDisposed()
        || transaction.obsoleteContexts.has(work.context)
      ) {
        continue;
      }

      let result: void | Promise<void>;
      try {
        result = work.complete(work.lifecycle);
      } catch (error) {
        return this.recoverRetainedTransition(
          transaction,
          work,
          error,
          () => this.runRetainedTransitionCompletions(transaction, transitions, current - 1),
        );
      }
      if (isPromise(result)) {
        return result.then(
          () => {
            this.assertActiveTransaction(transaction);
            return this.runRetainedTransitionCompletions(transaction, transitions, current - 1);
          },
          error => this.recoverRetainedTransition(
            transaction,
            work,
            error,
            () => this.runRetainedTransitionCompletions(transaction, transitions, current - 1),
          ),
        );
      }
    }
  }

  /** @internal */
  private runRetainedTransitionCallback(
    transaction: NavigationTransaction,
    work: RetainedRouteTransitionWork,
  ): void | Promise<void> {
    if (work.plan !== 'replace') {
      return work.transition(work.lifecycle);
    }

    transaction.activeReplacement = work.context;
    let result: void | Promise<void>;
    try {
      result = work.transition(work.lifecycle);
    } catch (error) {
      transaction.activeReplacement = null;
      throw error;
    }
    if (isPromise(result)) {
      return result.then(
        () => { transaction.activeReplacement = null; },
        error => {
          transaction.activeReplacement = null;
          throw error;
        },
      );
    }
    transaction.activeReplacement = null;
  }

  /** @internal */
  private recoverRetainedTransition(
    transaction: NavigationTransaction,
    work: RetainedRouteTransitionWork,
    error: unknown,
    next: () => void | Promise<void>,
  ): void | Promise<void> {
    let recovery: void | Promise<void>;
    try {
      recovery = this.resolveRouteFailure(transaction, work.context, error);
    } catch (recoveryError) {
      throw recoveryError;
    }
    if (isPromise(recovery)) {
      return recovery.then(() => {
        this.assertActiveTransaction(transaction);
        return next();
      });
    }
    this.assertActiveTransaction(transaction);
    return next();
  }

  /** @internal */
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

  /** @internal */
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

  /** @internal */
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

  /** @internal */
  private createHandlerError(original: unknown, handlerError: unknown): AggregateError {
    return new AggregateError([original, handlerError], 'A route error handler failed.');
  }

  /** @internal */
  private runActivationOutsideNavigation(
    context: RouteContext,
    callback: RouteCanLoadCallback | null,
    lifecycle: RouteLifecycleContext,
    activate: () => void | Promise<void>,
  ): void | Promise<void> {
    if (callback == null) {
      return activate();
    }
    const result = callback(lifecycle);
    if (isPromise(result)) {
      return result.then(value => {
        if (value == null || value === true) {
          return activate();
        }
        if (value === false && context._guardFailure === 'local') {
          this.rejectGuardLocally(context);
        }
      });
    }
    if (result == null || result === true) {
      return activate();
    }
    if (result === false && context._guardFailure === 'local') {
      this.rejectGuardLocally(context);
    }
  }

  /** @internal */
  private runRetainedTransitionOutsideNavigation(
    route: RouteContext,
    callback: RouteCanLoadCallback | null,
    lifecycle: RouteLifecycleContext,
    transition: (context: RouteLifecycleContext) => void | Promise<void>,
    complete: ((context: RouteLifecycleContext) => void | Promise<void>) | null,
  ): void | Promise<void> {
    const run = (): void | Promise<void> => {
      const result = transition(lifecycle);
      if (complete == null) {
        return result;
      }
      return isPromise(result)
        ? result.then(() => complete(lifecycle))
        : complete(lifecycle);
    };
    if (callback == null) {
      return run();
    }
    const result = callback(lifecycle);
    if (isPromise(result)) {
      return result.then(value => {
        if (value == null || value === true) {
          return run();
        }
        if (value === false && route._guardFailure === 'local') {
          this.rejectGuardLocally(route);
        }
      });
    }
    if (result == null || result === true) {
      return run();
    }
    if (result === false && route._guardFailure === 'local') {
      this.rejectGuardLocally(route);
    }
  }

  /** @internal */
  private rejectGuardLocally(context: RouteContext): void {
    const recovered = context._excludeLocally();
    if (__DEV__ && !recovered) {
      console.warn(`[au-route] The locally denied route "${context.fullPath}" has no matching sibling fallback or route.`);
    }
  }

  /** @internal */
  private commitViewTransactions(transaction: NavigationTransaction): void {
    const viewTransactions = transaction.viewTransactions.splice(0);
    for (const viewTransaction of viewTransactions) {
      try {
        viewTransaction.commit();
      } catch (error) {
        if (__DEV__) {
          console.warn('[au-route] A committed route view could not dispose its previous view.', error);
        }
      }
    }
  }

  /** @internal */
  private rollbackViewTransactions(transaction: NavigationTransaction): void | Promise<void> {
    const viewTransactions = transaction.viewTransactions.splice(0).reverse();
    if (viewTransactions.length === 0) {
      return;
    }
    return this._runViewRollback(() => {
      const errors: unknown[] = [];
      let pending: Promise<void> | null = null;
      const run = (viewTransaction: RouteViewTransaction): void | Promise<void> => {
        let result: void | Promise<void>;
        try {
          result = viewTransaction.rollback();
        } catch (error) {
          errors.push(error);
          return;
        }
        if (isPromise(result)) {
          return result.catch(error => { errors.push(error); });
        }
      };
      for (const viewTransaction of viewTransactions) {
        if (pending != null) {
          pending = pending.then(() => run(viewTransaction));
        } else {
          const result = run(viewTransaction);
          if (isPromise(result!)) {
            pending = result;
          }
        }
      }
      const finish = (): void => {
        if (errors.length === 1) {
          throw errors[0];
        }
        if (errors.length > 1) {
          throw new AggregateError(errors, 'Multiple route view rollbacks failed.');
        }
      };
      return pending == null ? finish() : pending.then(finish);
    });
  }

  /** @internal */
  private captureFailure(transaction: NavigationTransaction, error: unknown): void {
    if (transaction.finalized || error instanceof NavigationCancelled) {
      return;
    }
    transaction.error ??= error;
    transaction.controller.abort();
  }

  /** @internal */
  private assertNoRedirectLoop(path: string, chain: string[]): void {
    const loopStart = chain.indexOf(path);
    if (loopStart >= 0) {
      throw new Error(`Redirect loop detected: ${[...chain.slice(loopStart), path].join(' -> ')}`);
    }
  }

  /** @internal */
  private notify(): void {
    for (const subscriber of this.subscribers) {
      subscriber(this.currentPath);
    }
  }

  /** @internal */
  private restorePreviousLocation(transaction: NavigationTransaction): void {
    this._runViewRollback(() => {
      if (!transaction.previousActive && this.root instanceof RouteContext) {
        this.root._restoreInactive(transaction.previousLocation);
      } else {
        this.root.apply(transaction.previousLocation.pathname, transaction.previousLocation);
      }
    });
  }

}

function createIdleNavigationState(location: RouteLocation): RouteNavigationState {
  return Object.freeze({
    id: 0,
    pending: false,
    phase: 'idle',
    source: null,
    from: location,
    to: null,
    href: null,
    signal: null,
    result: null,
  });
}

function navigationPhaseForRoutePhase(phase: RouteFailurePhase): RouteNavigationPhase {
  switch (phase) {
    case 'can-load':
      return 'guarding';
    case 'loading':
      return 'loading';
    case 'activation':
      return 'activating';
    case 'loaded':
      return 'settling';
  }
}

function routeValueSnapshot(route: IRouteContext): RouteValueSnapshot {
  return Object.freeze({
    path: route.$path,
    residue: route.residue,
    params: route.$params,
    query: route.$query,
    hash: route.$hash,
  });
}
