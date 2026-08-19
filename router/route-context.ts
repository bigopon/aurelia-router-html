import { DI, emptyObject, isPromise } from '@aurelia/kernel';
import { computed } from '@aurelia/runtime';
import { createRouteHref, emptyRouteQuery, parseRouteLocation, type RouteHrefOptions, type RouteLocation, type RouteQuery } from './route-location';
import type { RouteCanLoadCallback, RouteCanUnloadCallback, RouteGuardFailure } from './guard';
import type { RouteErrorHandler, RouteFailure } from './error';
import type { RouteLifecycleData, RouteTransitionPlan, RouteTransitionTrigger } from './lifecycle';

export interface RouteState {
  readonly active: boolean;
  readonly failure: RouteFailure | null;
  readonly title: string | null;
  readonly data: RouteLifecycleData;
  readonly params: Readonly<Record<string, string>>;
  readonly residue: string;
  readonly path: string;
  readonly query: RouteQuery;
  readonly hash: string;
}

export type RouteContextCallback = (state: RouteState) => void;
export type SwapOrder = 'attach-next-detach-current' | 'detach-current-attach-next' | 'parallel';
export type RouteParams = Readonly<Record<string, string | number>>;

const defaultRouteTransitionTriggers: ReadonlySet<RouteTransitionTrigger> = new Set(['params']);
export interface RouteActiveOptions extends RouteHrefOptions {
  exact?: boolean;
  matchQuery?: boolean;
  matchHash?: boolean;
}

export interface RouteLoadOptions extends RouteHrefOptions {
  replace?: boolean;
  reload?: boolean;
  plan?: RouteTransitionPlan;
}

export interface RouteReloadOptions {
  plan?: RouteTransitionPlan;
}

interface RouteNavigationOptions {
  replace?: boolean;
  redirect?: boolean;
  reload?: boolean;
  plan?: RouteTransitionPlan;
}

export interface RouteContextOptions {
  exact?: boolean;
  fallback?: boolean;
  group?: boolean;
  guardFailure?: RouteGuardFailure;
  swapOrder?: SwapOrder;
  hrefFormatter?: (path: string) => string;
}

export interface IRouteContext {
  readonly parent: IRouteContext | null;
  readonly root: IRouteContext;
  readonly children: readonly IRouteContext[];
  readonly active: boolean;
  readonly failure: RouteFailure | null;
  readonly residue: string;
  readonly $path: string;
  readonly $params: Readonly<Record<string, string>>;
  readonly $query: RouteQuery;
  readonly $hash: string;
  readonly pattern: string;
  readonly fullPath: string;
  readonly title: string | null;
  readonly data: RouteLifecycleData;

  href(target?: string | IRouteContext, params?: RouteParams, options?: RouteHrefOptions): string;
  load(target?: string | IRouteContext, params?: RouteParams, options?: RouteLoadOptions): boolean | Promise<boolean>;
  reload(options?: RouteReloadOptions): boolean | Promise<boolean>;
  isActive(target?: string | IRouteContext, params?: RouteParams, options?: RouteActiveOptions): boolean;
  getPaths(includeSelf?: boolean): readonly string[];
  usePattern(pattern: string): void;
  apply(path: string, location?: Pick<RouteLocation, 'query' | 'hash'>): void;
  refresh(): void;
  createChild(pattern?: string, options?: RouteContextOptions): IRouteContext;
  subscribe(callback: RouteContextCallback): () => void;
  dispose(): void;
}

export const IRouteContext = DI.createInterface<IRouteContext>('IRouteContext');

export class RouteContext implements IRouteContext {
  public readonly children: RouteContext[] = [];
  public active: boolean = false;
  public residue: string = '/';
  public $path: string = '/';
  public $params: Readonly<Record<string, string>> = Object.freeze({});
  public $query: RouteQuery = emptyRouteQuery;
  public $hash: string = '';
  public pattern: string = '*';
  public title: string | null = null;
  public readonly data: RouteLifecycleData = {
    loading: undefined,
    loaded: undefined,
  };
  private _failure: RouteFailure | null = null;

  public get failure(): RouteFailure | null {
    return this._failure;
  }

  public get root(): IRouteContext {
    let context: IRouteContext = this;
    while (context.parent != null) {
      context = context.parent;
    }
    return context;
  }

  public get fullPath(): string {
    if (this.parent == null) {
      return '/';
    }

    const patterns: string[] = [];
    let context: IRouteContext | null = this;
    while (context?.parent != null) {
      if (context.pattern !== '/') {
        patterns.unshift(context.pattern.replace(/^\//, ''));
      }
      context = context.parent;
    }
    return normalizePath(patterns.join('/'));
  }

  private _matcher: RoutePatternMatcher = createRoutePatternMatcher(/^(?<rest__>\/.*|\/)?$/);
  private readonly _subscriptions = new Set<RouteContextCallback>();
  private readonly _registrySubscriptions = new Set<() => void>();
  private _disposed: boolean = false;
  private readonly _exact: boolean;
  private readonly _fallback: boolean;
  private readonly _group: boolean;
  private readonly _swapOrder: SwapOrder;
  private readonly _hrefFormatter: (path: string) => string;
  private _registered: boolean = true;
  private _navigator: ((path: string, options: RouteNavigationOptions) => unknown) | null = null;
  private _navigationVersion: number = 0;
  private _deferredDeactivations: Set<RouteContext> | null = null;
  private _localGuardFailures: Set<RouteContext> | null = null;
  private _failureSnapshot: Map<RouteContext, RouteFailure | null> | null = null;
  private _dataSnapshot: Map<RouteContext, RouteLifecycleData> | null = null;
  private _transactionFailureOwners: Set<RouteContext> | null = null;
  private _reloadRequested: boolean = false;
  /** @internal */ public _canLoad: RouteCanLoadCallback | null = null;
  /** @internal */ public _canUnload: RouteCanUnloadCallback | null = null;
  /** @internal */ public _transitionOn: ReadonlySet<RouteTransitionTrigger> = defaultRouteTransitionTriggers;
  /** @internal */ public _transitionPlan: RouteTransitionPlan = 'rerun';
  private _hasLifecycleHooks: boolean = false;
  /** @internal */ public _onError: RouteErrorHandler | null = null;
  /** @internal */ public readonly _guardFailure: RouteGuardFailure;

  public constructor(
    public readonly parent: IRouteContext | null,
    pattern: string = '*',
    options: RouteContextOptions = {},
  ) {
    this._exact = options.exact ?? false;
    this._fallback = options.fallback ?? false;
    this._group = options.group ?? false;
    this._guardFailure = options.guardFailure ?? 'navigation';
    this._swapOrder = options.swapOrder ?? (
      parent instanceof RouteContext
        ? parent._swapOrder
        : 'attach-next-detach-current'
    );
    this._hrefFormatter = options.hrefFormatter ?? (
      parent instanceof RouteContext ? parent._hrefFormatter : path => path
    );
    this.usePattern(pattern);
  }

  public href(target: string | IRouteContext = this, params: RouteParams = {}, options: RouteHrefOptions = {}): string {
    return this._hrefFormatter(this._createHref(target, params, options));
  }

  public load(target: string | IRouteContext = this, params: RouteParams = {}, options: RouteLoadOptions = {}): boolean | Promise<boolean> {
    const { plan, reload, replace, ...hrefOptions } = options;
    return this._navigate(target, params, hrefOptions, { plan, reload, replace });
  }

  public reload(options: RouteReloadOptions = {}): boolean | Promise<boolean> {
    const target = this.active ? this.root.$path : this.parent == null ? this.$path : this;
    return this.load(target, {}, {
      plan: options.plan,
      preserveHash: true,
      preserveQuery: true,
      reload: true,
      replace: true,
    });
  }

  /** @internal */
  public _redirect(target: string, params: RouteParams, replace: boolean): boolean | Promise<boolean> {
    return this._navigate(target, params, {}, { replace, redirect: true });
  }

  /** @internal */
  public _setNavigator(navigator: (path: string, options: RouteNavigationOptions) => unknown): void {
    this._navigator = navigator;
  }

  private _navigate(target: string | IRouteContext, params: RouteParams, hrefOptions: RouteHrefOptions, navigationOptions: RouteNavigationOptions): boolean | Promise<boolean> {
    const root = this.root as RouteContext;
    const href = this._createHref(target, params, hrefOptions);
    if (root._navigator == null) {
      throw new Error('The route context is not connected to a navigation adapter.');
    }
    const result = root._navigator(href, navigationOptions);
    return isPromise(result) ? result as Promise<boolean> : typeof result === 'boolean' ? result : true;
  }

  /** @internal */
  public _setGuards(
    canLoad: RouteCanLoadCallback | null,
    canUnload: RouteCanUnloadCallback | null,
  ): void {
    this._canLoad = canLoad;
    this._canUnload = canUnload;
  }

  /** @internal */
  public _setTransitionPolicy(
    transitionOn: ReadonlySet<RouteTransitionTrigger> = defaultRouteTransitionTriggers,
    transitionPlan: RouteTransitionPlan = 'rerun',
    hasLifecycleHooks: boolean = false,
  ): void {
    this._transitionOn = transitionOn;
    this._transitionPlan = transitionPlan;
    this._hasLifecycleHooks = hasLifecycleHooks;
  }

  /** @internal */
  public _setErrorHandler(onError: RouteErrorHandler | null): void {
    this._onError = onError;
  }

  /** @internal */
  public _getData(): RouteLifecycleData {
    return { ...this.data };
  }

  /** @internal */
  public _setData(phase: keyof RouteLifecycleData, value: unknown): void {
    (this.data as Record<keyof RouteLifecycleData, unknown>)[phase] = value;
  }

  private _restoreData(data: RouteLifecycleData | undefined): void {
    const values = this.data as Record<keyof RouteLifecycleData, unknown>;
    values.loading = data?.loading;
    values.loaded = data?.loaded;
  }

  /** @internal */
  public _hasGuards(): boolean {
    if (this._canLoad != null || this._canUnload != null) {
      return true;
    }
    return this.children.some(child => child._hasGuards());
  }

  /** @internal */
  public _getLeaving(
    path: string,
    location?: Pick<RouteLocation, 'query' | 'hash'>,
    reload: boolean = false,
    planOverride?: RouteTransitionPlan,
  ): RouteContext[] {
    const next = new Map<RouteContext, Readonly<Record<string, string>>>();
    this._collectMatchParams(normalizePath(path), next);
    const replacementRoots = location == null
      ? []
      : [...next].filter(([context, params]) =>
        context.parent != null
        && context.active
        && (planOverride ?? context._transitionPlan) === 'replace'
        && context._isRetainedTransitionTriggered(params, location, reload),
      ).map(([context]) => context);
    return this._getContexts()
      .filter(context => context.active && (
        !next.has(context)
        || replacementRoots.some(root => context === root || context._isDescendantOf(root))
      ))
      .sort((left, right) => right._depth() - left._depth());
  }

  /** @internal */
  public _hasRetainedTransitionWork(
    path: string,
    location: Pick<RouteLocation, 'query' | 'hash'>,
    reload: boolean,
    planOverride?: RouteTransitionPlan,
  ): boolean {
    const matches = new Map<RouteContext, Readonly<Record<string, string>>>();
    this._collectMatchParams(normalizePath(path), matches);
    for (const [context, params] of matches) {
      if (!context.active || context.parent == null) {
        continue;
      }
      const plan = planOverride ?? context._transitionPlan;
      if (plan === 'none' || plan === 'rerun' && context._canLoad == null && !context._hasLifecycleHooks) {
        continue;
      }
      if (context._isRetainedTransitionTriggered(params, location, reload)) {
        return true;
      }
    }
    return false;
  }

  private _isRetainedTransitionTriggered(
    params: Readonly<Record<string, string>>,
    location: Pick<RouteLocation, 'query' | 'hash'>,
    reload: boolean,
  ): boolean {
    return reload
      || this._transitionOn.has('params') && !shallowEqual(this.$params, params)
      || this._transitionOn.has('query') && this.$query.toString() !== location.query.toString()
      || this._transitionOn.has('hash') && this.$hash !== location.hash;
  }

  /** @internal */
  public _resolveGuardRedirect(target: string | IRouteContext, params: RouteParams = {}, options: RouteHrefOptions = {}): string {
    const origin = this.parent instanceof RouteContext ? this.parent : this;
    return origin._createHref(target, { ...this.$params, ...params }, options);
  }

  /** @internal */
  public _beginNavigationTransaction(): void {
    const root = this.root as RouteContext;
    root._deferredDeactivations = new Set();
    root._localGuardFailures = new Set();
    root._failureSnapshot = new Map(root._getContexts().map(context => [context, context.failure]));
    root._dataSnapshot = new Map(root._getContexts().map(context => [context, context._getData()]));
    root._transactionFailureOwners = new Set();
  }

  /** @internal */
  public _commitNavigationTransaction(): void {
    const root = this.root as RouteContext;
    const deferred = root._deferredDeactivations;
    const failureOwners = root._transactionFailureOwners;
    root._deferredDeactivations = null;
    root._localGuardFailures = null;
    root._failureSnapshot = null;
    root._dataSnapshot = null;
    root._transactionFailureOwners = null;
    for (const context of root._getContexts()) {
      if (context.failure != null && failureOwners?.has(context) !== true) {
        context._setFailure(null);
      }
    }
    if (deferred == null) {
      return;
    }
    for (const context of deferred) {
      if (context.active) {
        context._deactivateBranch('/__inactive__', root.$query, root.$hash);
      }
    }
  }

  /** @internal */
  public _cancelNavigationTransaction(): void {
    const root = this.root as RouteContext;
    const failureSnapshot = root._failureSnapshot;
    const dataSnapshot = root._dataSnapshot;
    root._deferredDeactivations = null;
    root._localGuardFailures = null;
    root._failureSnapshot = null;
    root._dataSnapshot = null;
    root._transactionFailureOwners = null;
    if (failureSnapshot != null) {
      for (const context of root._getContexts()) {
        context._setFailure(failureSnapshot.get(context) ?? null);
      }
    }
    if (dataSnapshot != null) {
      for (const context of root._getContexts()) {
        context._restoreData(dataSnapshot.get(context));
      }
    }
  }

  /** @internal */
  public _excludeLocally(failure: RouteFailure | null = null): boolean {
    const root = this.root as RouteContext;
    const transactionFailures = root._localGuardFailures;
    const failures = transactionFailures ?? new Set<RouteContext>();
    if (transactionFailures == null) {
      root._localGuardFailures = failures;
    }
    failures.add(this);
    this._deactivateBranch('/__inactive__', this.$query, this.$hash);

    const parent = this.parent;
    if (!(parent instanceof RouteContext)) {
      if (transactionFailures == null) {
        root._localGuardFailures = null;
      }
      return false;
    }
    if (failure != null) {
      parent._setFailure(failure);
      root._transactionFailureOwners?.add(parent);
    }
    parent.refresh();
    const recovered = parent._selectMatches(parent.residue).some(child => child.active);
    if (transactionFailures == null) {
      root._localGuardFailures = null;
    }
    return recovered;
  }

  /** @internal */
  public _restoreInactive(location: RouteLocation): void {
    const root = this.root as RouteContext;
    root._deferredDeactivations = null;
    root._localGuardFailures = null;
    root._failureSnapshot = null;
    root._dataSnapshot = null;
    root._transactionFailureOwners = null;
    for (const child of root.children) {
      child._deactivateBranch('/__inactive__', location.query, location.hash);
    }
    root.active = false;
    root._failure = null;
    root.residue = '/';
    root.$params = Object.freeze({});
    root.$path = location.pathname;
    root.$query = location.query;
    root.$hash = location.hash;
  }

  /** @internal */
  public _setReloadRequested(value: boolean): void {
    (this.root as RouteContext)._reloadRequested = value;
  }

  /** @internal */
  public _isReloadRequested(): boolean {
    return (this.root as RouteContext)._reloadRequested;
  }

  /** @internal */
  public _isDisposed(): boolean {
    return this._disposed;
  }

  /** @internal */
  public _isDescendantOf(ancestor: RouteContext): boolean {
    let context = this.parent;
    while (context instanceof RouteContext) {
      if (context === ancestor) {
        return true;
      }
      context = context.parent;
    }
    return false;
  }

  /** @internal */
  public _deactivate(): void {
    this._deactivateBranch('/__inactive__', this.$query, this.$hash);
  }

  public isActive(target: string | IRouteContext = this, params: RouteParams = {}, options: RouteActiveOptions = {}): boolean {
    if (target instanceof RouteContext && target._disposed) {
      return false;
    }
    if (target instanceof RouteContext && target._group) {
      return target.active;
    }

    let href: string | null;
    try {
      href = this._tryCreateHref(target, params, options);
    } catch (error) {
      if (!isRouteParameterResolutionError(error)) {
        throw error;
      }
      return false;
    }
    if (href == null) {
      return false;
    }

    const targetLocation = parseRouteLocation(href);
    const currentPath = this.root.$path;
    const pathMatches = options.exact || targetLocation.pathname === '/'
      ? currentPath === targetLocation.pathname
      : currentPath === targetLocation.pathname || currentPath.startsWith(`${targetLocation.pathname}/`);
    if (!pathMatches) {
      return false;
    }
    if (options.matchQuery && !queryEqual(this.$query, targetLocation.query)) {
      return false;
    }
    return !options.matchHash || this.$hash === targetLocation.hash;
  }

  private _createHref(target: string | IRouteContext, params: RouteParams, options: RouteHrefOptions): string {
    if (target instanceof RouteContext && target._group) {
      throw new Error('A pathless route group is structural and cannot be used as a navigation destination.');
    }
    const href = this._tryCreateHref(target, params, options);
    if (href == null) {
      throw new Error(`No route matching "${target}" is registered below "${this.fullPath}".`);
    }
    return href;
  }

  private _tryCreateHref(target: string | IRouteContext, params: RouteParams, options: RouteHrefOptions): string | null {
    const resolvedParams: Record<string, string | number> = Object.create(null);
    const ancestry: IRouteContext[] = [];
    let context: IRouteContext | null = this;
    while (context != null) {
      ancestry.unshift(context);
      context = context.parent;
    }
    for (const ancestor of ancestry) {
      Object.assign(resolvedParams, ancestor.$params);
    }
    Object.assign(resolvedParams, params);

    const targetContext = typeof target === 'string'
      ? this._findContext(target)
      : target;
    if (targetContext == null) {
      const pathname = typeof target === 'string'
        ? this._createConcretePath(target, resolvedParams)
        : null;
      return pathname == null
        ? null
        : createRouteHref(pathname, this.$query, this.$hash, options);
    }

    const pathname = generateHref(targetContext.fullPath, resolvedParams);
    return createRouteHref(pathname, this.$query, this.$hash, options);
  }

  public getPaths(includeSelf: boolean = true): readonly string[] {
    const paths: string[] = [];
    if (includeSelf && this.parent != null && !this._group) {
      paths.push(this.fullPath);
    }
    for (const child of this.children) {
      paths.push(...child.getPaths(true));
    }
    return paths;
  }

  public usePattern(pattern: string): void {
    const normalizedPattern = normalizePattern(pattern);
    const matcher = compilePattern(normalizedPattern, this._exact, this.parent === null);
    this.pattern = normalizedPattern;
    this._matcher = matcher;
  }

  /** @internal */
  public _setRegistered(value: boolean): void {
    if (this._registered === value || this._disposed) {
      return;
    }
    this._registered = value;
    if (!value) {
      this._deactivateBranch('/__inactive__', this.$query, this.$hash);
    }
    const parent = this.parent;
    if (parent instanceof RouteContext) {
      if (parent.active) {
        parent.refresh();
      }
      parent._notifyRegistryChanged();
    }
  }

  /** @internal */
  public _setTitle(title: string | null): void {
    const normalized = title == null || title.trim() === '' ? null : title.trim();
    if (this.title === normalized) {
      return;
    }
    this.title = normalized;
    this._notify();
  }

  public apply(path: string, location: Pick<RouteLocation, 'query' | 'hash'> = { query: emptyRouteQuery, hash: '' }): void {
    if (this._disposed) {
      return;
    }

    const root = this.root as RouteContext;
    if (this.parent == null) {
      this._navigationVersion++;
    }
    const navigationVersion = root._navigationVersion;
    const normalizedPath = normalizePath(path);
    const match = this._group ? this._matchGroup(normalizedPath) : this._matcher.exec(normalizedPath);

    if (match === null) {
      this._deactivateBranch(normalizedPath, location.query, location.hash);
      return;
    }

    const groups = match.groups ?? {};
    const nextResidue = this._group ? normalizedPath : normalizeResidue(groups.rest__);
    const nextParams = this._group ? freezeParams({}) : freezeParams(extractParams(groups));
    const stateChanged =
      !this.active
      || this.residue !== nextResidue
      || !shallowEqual(this.$params, nextParams)
      || this.$path !== normalizedPath
      || this.$query.toString() !== location.query.toString()
      || this.$hash !== location.hash;

    this.active = true;
    this.residue = nextResidue;
    this.$params = nextParams;
    this.$path = normalizedPath;
    this.$query = location.query;
    this.$hash = location.hash;

    if (stateChanged || root._reloadRequested) {
      this._notify();
    }

    if (root._navigationVersion !== navigationVersion) {
      return;
    }
    this.refresh();
  }

  public refresh(): void {
    if (!this.active || this.children.length === 0) {
      return;
    }

    const nextResidue = this.residue;
    const root = this.root as RouteContext;
    const navigationVersion = root._navigationVersion;
    const location = { query: this.$query, hash: this.$hash };
    const matches = this._selectMatches(nextResidue);
    const matchSet = new Set(matches);
    const misses = this.children.filter(child => !matchSet.has(child));
    const deferredDeactivations = root._deferredDeactivations;
    if (deferredDeactivations != null) {
      for (const child of matches) {
        deferredDeactivations.delete(child);
      }
      for (const child of misses) {
        if (child.active) {
          deferredDeactivations.add(child);
        }
      }
    }

    switch (this._swapOrder) {
      case 'detach-current-attach-next':
        for (const child of misses) {
          if (deferredDeactivations == null) {
            child._deactivateBranch('/__inactive__', this.$query, this.$hash);
          }
          if (root._navigationVersion !== navigationVersion) return;
        }
        for (const child of matches) {
          child.apply(nextResidue, location);
          if (root._navigationVersion !== navigationVersion) return;
        }
        break;
      case 'attach-next-detach-current':
      default:
        for (const child of matches) {
          child.apply(nextResidue, location);
          if (root._navigationVersion !== navigationVersion) return;
        }
        for (const child of misses) {
          if (deferredDeactivations == null) {
            child._deactivateBranch('/__inactive__', this.$query, this.$hash);
          }
          if (root._navigationVersion !== navigationVersion) return;
        }
        break;
      case 'parallel':
        for (const child of this.children) {
          if (matchSet.has(child)) {
            child.apply(nextResidue, location);
          } else {
            if (deferredDeactivations == null) {
              child._deactivateBranch('/__inactive__', this.$query, this.$hash);
            }
          }
          if (root._navigationVersion !== navigationVersion) return;
        }
        break;
    }
  }

  public createChild(pattern?: string, options: RouteContextOptions = {}): IRouteContext {
    const child = new RouteContext(this, pattern, {
      exact: options.exact,
      fallback: options.fallback,
      group: options.group,
      guardFailure: options.guardFailure,
      swapOrder: options.swapOrder ?? this._swapOrder,
      hrefFormatter: this._hrefFormatter,
    });
    this.children.push(child);
    if (this.active) {
      this.refresh();
    } else {
      child._deactivateBranch('/__inactive__', this.$query, this.$hash);
    }
    this._notifyRegistryChanged();
    return child;
  }

  public subscribe(callback: RouteContextCallback): () => void {
    this._subscriptions.add(callback);
    callback(this._currentState());
    return () => {
      this._subscriptions.delete(callback);
    };
  }

  /** @internal */
  public _subscribeRegistry(callback: () => void): () => void {
    this._registrySubscriptions.add(callback);
    return () => {
      this._registrySubscriptions.delete(callback);
    };
  }

  public dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    while (this.children.length > 0) {
      this.children.pop()!.dispose();
    }
    this._subscriptions.clear();
    this._registrySubscriptions.clear();

    const parent = this.parent;
    if (parent instanceof RouteContext) {
      const index = parent.children.indexOf(this);
      if (index >= 0) {
        parent.children.splice(index, 1);
        parent._notifyRegistryChanged();
      }
    }
  }

  /** @internal */
  private _notifyRegistryChanged(): void {
    let context: RouteContext | null = this;
    while (context != null) {
      if (!context._disposed) {
        for (const callback of context._registrySubscriptions) {
          callback();
        }
      }
      context = context.parent instanceof RouteContext ? context.parent : null;
    }
  }

  private _deactivateBranch(path: string, query: RouteQuery = this.$query, hash: string = this.$hash): void {
    const stateChanged = this.active
      || this.failure != null
      || this.residue !== '/'
      || Object.keys(this.$params).length > 0
      || this.$path !== path
      || this.$query.toString() !== query.toString()
      || this.$hash !== hash;

    this.active = false;
    this._failure = null;
    this.$path = path;
    this.residue = '/';
    this.$params = Object.freeze({});
    this.$query = query;
    this.$hash = hash;

    if (stateChanged) {
      this._notify();
    }

    for (const child of this.children) {
      child._deactivateBranch('/__inactive__', query, hash);
    }
  }

  private _match(path: string): { residue: string } | null {
    if (!this._registered) {
      return null;
    }
    if (this._group) {
      return this._matchGroup(path);
    }

    const normalizedPath = normalizePath(path);
    const match = this._matcher.exec(normalizedPath);
    if (match === null) {
      return null;
    }

    const groups = match.groups ?? {};
    return {
      residue: normalizeResidue(groups.rest__),
    };
  }

  private _matchGroup(path: string): { groups: Record<string, string>; residue: string } | null {
    const normalizedPath = normalizePath(path);
    return this._selectOwnMatches(normalizedPath).length === 0
      ? null
      : { groups: Object.freeze({}), residue: normalizedPath };
  }

  private _selectOwnMatches(path: string): RouteContext[] {
    const failures = (this.root as RouteContext)._localGuardFailures;
    const matchingChildren = this.children.filter(child =>
      child._registered && failures?.has(child) !== true && child._match(path) !== null,
    );
    const regularMatches = matchingChildren.filter(child => !child._fallback);
    return regularMatches.length > 0
      ? regularMatches
      : matchingChildren.filter(child => child._fallback);
  }

  private _selectMatches(path: string): RouteContext[] {
    return this._selectOwnMatches(path);
  }

  private _findContext(path: string): IRouteContext | null {
    const trimmed = path.trim();
    const searchContext = trimmed.startsWith('/') && this.root instanceof RouteContext
      ? this.root
      : this;
    const target = stripCurrentPrefix(trimmed);
    const normalizedPattern = normalizePattern(target);
    const normalizedPath = normalizePath(target);
    const contexts = searchContext._getContexts();
    return contexts.find(context => context._registered && context.fullPath === normalizedPath)
      ?? contexts.find(context => context._registered && context.pattern === normalizedPattern)
      ?? null;
  }

  private _createConcretePath(path: string, params: RouteParams): string | null {
    if (/[:*]/.test(path)) {
      return null;
    }

    const trimmed = path.trim();
    const searchContext = trimmed.startsWith('/') && this.root instanceof RouteContext
      ? this.root
      : this;
    return trimmed.startsWith('/')
      ? normalizePath(trimmed)
      : normalizePath(`${generateHref(searchContext.fullPath, params)}/${stripCurrentPrefix(trimmed)}`);
  }

  private _getContexts(): RouteContext[] {
    const contexts: RouteContext[] = this._registered ? [this] : [];
    for (let index = 0; index < contexts.length; index++) {
      contexts.push(...contexts[index].children);
    }
    return contexts;
  }

  private _collectMatches(path: string, matches: Set<RouteContext>): void {
    const normalizedPath = normalizePath(path);
    const match = this._group ? this._matchGroup(normalizedPath) : this._matcher.exec(normalizedPath);
    if (match == null) {
      return;
    }
    matches.add(this);
    const residue = this._group ? normalizedPath : normalizeResidue(match.groups?.rest__);
    const selected = this._selectOwnMatches(residue);
    for (const child of selected) {
      child._collectMatches(residue, matches);
    }
  }

  private _collectMatchParams(
    path: string,
    matches: Map<RouteContext, Readonly<Record<string, string>>>,
  ): void {
    const normalizedPath = normalizePath(path);
    const match = this._group ? this._matchGroup(normalizedPath) : this._matcher.exec(normalizedPath);
    if (match == null) {
      return;
    }
    matches.set(this, this._group ? emptyObject as Readonly<Record<string, string>> : extractParams(match.groups ?? {}));
    const residue = this._group ? normalizedPath : normalizeResidue(match.groups?.rest__);
    const selected = this._selectOwnMatches(residue);
    for (const child of selected) {
      child._collectMatchParams(residue, matches);
    }
  }

  private _depth(): number {
    let depth = 0;
    let context = this.parent;
    while (context != null) {
      depth++;
      context = context.parent;
    }
    return depth;
  }

  private _notify(): void {
    const state = this._currentState();
    for (const callback of this._subscriptions) {
      callback(state);
    }
  }

  private _currentState(): RouteState {
    return {
      active: this.active,
      failure: this.failure,
      title: this.title,
      data: this.data,
      params: this.$params,
      residue: this.residue,
      path: this.$path,
      query: this.$query,
      hash: this.$hash,
    };
  }

  private _setFailure(failure: RouteFailure | null): void {
    if (this.failure === failure) {
      return;
    }
    this._failure = failure;
    this._notify();
  }
}

computed<RouteContext>({ deps: ['root.$path', '$query', '$hash'] })(
  RouteContext.prototype.href,
  { kind: 'method' } as ClassMethodDecoratorContext<RouteContext>,
);

computed<RouteContext>({ deps: ['root.$path', '$query', '$hash'] })(
  RouteContext.prototype.isActive,
  { kind: 'method' } as ClassMethodDecoratorContext<RouteContext>,
);

interface RouteParameterSegment {
  readonly name: string;
  readonly optional: boolean;
  readonly constraint: string | null;
  readonly pattern: RegExp | null;
}

interface RouteParameterConstraint {
  readonly group: string;
  readonly pattern: RegExp;
}

interface RoutePatternMatcher {
  exec(path: string): RegExpExecArray | null;
}

const routeParameterPattern = /^:(?<name>[^?\s{}]+)(?:\{\{(?<constraint>.+)\}\})?(?<optional>\?)?$/;

function compilePattern(pattern: string, exact: boolean, transparentRoot: boolean): RoutePatternMatcher {
  if (pattern === '*') {
    if (transparentRoot) {
      return createRoutePatternMatcher(/^(?<rest__>\/.*|\/)?$/);
    }
    return createRoutePatternMatcher(exact
      ? /^\/(?<wildcard__>[^/]+)$/
      : /^\/(?<wildcard__>[^/]+)(?<rest__>\/.*)?$/);
  }

  if (pattern === '/') {
    return createRoutePatternMatcher(exact
      ? /^\/$/
      : /^(?<rest__>\/.*|\/)?$/);
  }

  const parts = pattern.split('/').filter(Boolean);
  const restIndex = parts.indexOf('**');
  const consumesRest = restIndex >= 0;
  const routeParts = consumesRest ? parts.slice(0, -1) : parts;
  const constraints: RouteParameterConstraint[] = [];
  let compiled = '';
  for (const part of routeParts) {
    if (part === '*') {
      compiled += '/(?<wildcard__>[^/]+)';
      continue;
    }
    if (part.startsWith(':')) {
      const parameter = parseRouteParameter(part);
      const group = escapeGroupName(parameter.name);
      if (parameter.pattern != null) {
        constraints.push({
          group,
          pattern: parameter.pattern,
        });
      }
      const capture = `(?<${group}>[^/]+)`;
      compiled += parameter.optional ? `(?:/${capture})?` : `/${capture}`;
      continue;
    }
    compiled += `/${escapeRegex(part)}`;
  }

  if (consumesRest) {
    return createRoutePatternMatcher(routeParts.length === 0
      ? /^\/(?<restWildcard__>.*)$/
      : new RegExp(`^${compiled}(?:/(?<restWildcard__>.*))?$`), constraints);
  }

  const pathExpression = routeParts.every(part => part.startsWith(':') && parseRouteParameter(part).optional)
    ? `(?:${compiled}|/)`
    : compiled;
  return createRoutePatternMatcher(exact
    ? new RegExp(`^${pathExpression}$`)
    : new RegExp(`^${pathExpression}(?<rest__>/.*)?$`), constraints);
}

function createRoutePatternMatcher(expression: RegExp, constraints: readonly RouteParameterConstraint[] = []): RoutePatternMatcher {
  return {
    exec(path: string): RegExpExecArray | null {
      const match = expression.exec(path);
      if (match == null || constraints.length === 0) {
        return match;
      }
      const groups = match.groups ?? {};
      for (const constraint of constraints) {
        const value = groups[constraint.group];
        if (value == null) {
          continue;
        }
        constraint.pattern.lastIndex = 0;
        if (!constraint.pattern.test(value)) {
          return null;
        }
      }
      return match;
    },
  };
}

function parseRouteParameter(segment: string): RouteParameterSegment {
  const match = routeParameterPattern.exec(segment);
  const { name, constraint, optional } = match?.groups ?? {};
  if (name == null) {
    throw new Error(`Invalid route parameter segment "${segment}". Expected :name, :name?, :name{{pattern}}, or :name{{pattern}}?.`);
  }
  let pattern: RegExp | null = null;
  if (constraint != null) {
    try {
      pattern = new RegExp(constraint);
    } catch (error) {
      throw new Error(`Invalid constraint "${constraint}" for route parameter "${name}".`, { cause: error });
    }
  }
  return {
    name,
    optional: optional === '?',
    constraint: constraint ?? null,
    pattern,
  };
}

function extractParams(groups: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(groups)) {
    if (key === 'rest__') {
      continue;
    }
    if (key === 'restWildcard__') {
      params['**'] = value == null ? '' : decodeURIComponent(value);
      continue;
    }
    if (key === 'wildcard__') {
      params['*'] = decodeURIComponent(value!);
      continue;
    }
    if (value == null) {
      continue;
    }
    params[key] = decodeURIComponent(value);
  }
  return params;
}

function freezeParams(params: Record<string, string>): Readonly<Record<string, string>> {
  return Object.freeze(params);
}

function normalizePattern(pattern: string): string {
  const trimmed = stripCurrentPrefix(pattern.trim());
  if (trimmed === '') {
    return '/';
  }
  if (trimmed === '.' || trimmed === './') {
    return '/';
  }
  if (trimmed === '*' || trimmed === '/*' || trimmed === '**' || trimmed === '/**') {
    return trimmed.endsWith('**') ? '**' : '*';
  }
  if (trimmed === '/') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
  const parts = normalized.split('/').filter(Boolean);
  const wildcardCount = parts.filter(part => part === '*').length;
  const restWildcardCount = parts.filter(part => part === '**').length;
  if (wildcardCount > 1) {
    throw new Error(`A route pattern can contain only one "*" wildcard: "${normalized}". Use named parameters when more than one segment varies.`);
  }
  if (restWildcardCount > 1) {
    throw new Error(`A route pattern can contain only one "**" wildcard: "${normalized}". Use named parameters when more than one segment varies.`);
  }
  const restIndex = parts.indexOf('**');
  if (restIndex >= 0 && restIndex !== parts.length - 1) {
    throw new Error(`The rest wildcard must be the final segment in route pattern "${normalized}".`);
  }
  return normalized;
}

function stripCurrentPrefix(value: string): string {
  let result = value;
  while (result.startsWith('./')) {
    result = result.slice(2);
  }
  return result === '' ? '.' : result;
}

function normalizePath(path: string): string {
  if (path === '') {
    return '/';
  }

  let value = path.trim();
  if (/^[a-z][a-z0-9+\-.]*:\/\//i.test(value)) {
    value = new URL(value).pathname;
  }

  if (!value.startsWith('/')) {
    value = `/${value}`;
  }

  value = value.replace(/\/{2,}/g, '/');
  return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeResidue(value: string | undefined): string {
  if (value == null || value === '') {
    return '/';
  }
  return normalizePath(value);
}

function generateHref(pattern: string, params: RouteParams): string {
  const segments = pattern.split('/').filter(Boolean).flatMap(segment => {
    if (segment.startsWith(':')) {
      const parameter = parseRouteParameter(segment);
      if (parameter.optional && params[parameter.name] == null) {
        return [];
      }
      const encoded = encodeRouteParam(parameter.name, params, false);
      if (parameter.pattern != null) {
        parameter.pattern.lastIndex = 0;
        if (!parameter.pattern.test(encoded)) {
          throw new Error(`Route parameter "${parameter.name}" value "${String(params[parameter.name])}" does not satisfy constraint "${parameter.constraint}".`);
        }
      }
      return [encoded];
    }
    if (segment === '*') {
      return [encodeRouteParam('*', params, false)];
    }
    if (segment === '**') {
      return [encodeRouteParam('**', params, true)];
    }
    return [segment];
  });
  return normalizePath(segments.join('/'));
}

function encodeRouteParam(name: string, params: RouteParams, rest: boolean): string {
  const value = params[name];
  if (value == null) {
    throw new Error(`Route parameter "${name}" is required to generate this href.`);
  }
  const stringValue = String(value);
  return rest
    ? stringValue.split('/').filter(Boolean).map(encodeURIComponent).join('/')
    : encodeURIComponent(stringValue);
}

function shallowEqual(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

function queryEqual(left: RouteQuery, right: RouteQuery): boolean {
  const leftParams = new URLSearchParams(left.toString());
  const rightParams = new URLSearchParams(right.toString());
  leftParams.sort();
  rightParams.sort();
  return leftParams.toString() === rightParams.toString();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeGroupName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

function isRouteParameterResolutionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /^Route parameter ".+" (is required|value ".+" does not satisfy constraint)/.test(error.message);
}
