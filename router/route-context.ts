import { DI } from '@aurelia/kernel';
import { computed } from '@aurelia/runtime';
import { createRouteHref, emptyRouteQuery, parseRouteLocation, type RouteHrefOptions, type RouteLocation, type RouteQuery } from './route-location';

export interface RouteState {
  readonly active: boolean;
  readonly params: Readonly<Record<string, string>>;
  readonly residue: string;
  readonly path: string;
  readonly query: RouteQuery;
  readonly hash: string;
}

export type RouteContextCallback = (state: RouteState) => void;
export type SwapOrder = 'attach-next-detach-current' | 'detach-current-attach-next' | 'parallel';
export type RouteParams = Readonly<Record<string, string | number>>;
export interface RouteActiveOptions extends RouteHrefOptions {
  exact?: boolean;
  matchQuery?: boolean;
  matchHash?: boolean;
}

export interface RouteContextOptions {
  exact?: boolean;
  fallback?: boolean;
  swapOrder?: SwapOrder;
  hrefFormatter?: (path: string) => string;
}

export interface IRouteContext {
  readonly parent: IRouteContext | null;
  readonly root: IRouteContext;
  readonly children: readonly IRouteContext[];
  readonly active: boolean;
  readonly residue: string;
  readonly $path: string;
  readonly $params: Readonly<Record<string, string>>;
  readonly $query: RouteQuery;
  readonly $hash: string;
  readonly pattern: string;
  readonly fullPath: string;

  href(target?: string | IRouteContext, params?: RouteParams, options?: RouteHrefOptions): string;
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

  private _matcher: RegExp = /^(?<rest__>\/.*|\/)?$/;
  private readonly _subscriptions = new Set<RouteContextCallback>();
  private readonly _registrySubscriptions = new Set<() => void>();
  private _disposed: boolean = false;
  private readonly _exact: boolean;
  private readonly _fallback: boolean;
  private readonly _swapOrder: SwapOrder;
  private readonly _hrefFormatter: (path: string) => string;

  public constructor(
    public readonly parent: IRouteContext | null,
    pattern: string = '*',
    options: RouteContextOptions = {},
  ) {
    this._exact = options.exact ?? false;
    this._fallback = options.fallback ?? false;
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

  public isActive(target: string | IRouteContext = this, params: RouteParams = {}, options: RouteActiveOptions = {}): boolean {
    if (target instanceof RouteContext && target._disposed) {
      return false;
    }

    const href = this._tryCreateHref(target, params, options);
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
    if (includeSelf && this.parent != null) {
      paths.push(this.fullPath);
    }
    for (const child of this.children) {
      paths.push(...child.getPaths(true));
    }
    return paths;
  }

  public usePattern(pattern: string): void {
    this.pattern = normalizePattern(pattern);
    this._matcher = compilePattern(this.pattern, this._exact, this.parent === null);
  }

  public apply(path: string, location: Pick<RouteLocation, 'query' | 'hash'> = { query: emptyRouteQuery, hash: '' }): void {
    if (this._disposed) {
      return;
    }

    const normalizedPath = normalizePath(path);
    this._matcher.lastIndex = 0;
    const match = this._matcher.exec(normalizedPath);

    if (match === null) {
      this._deactivateBranch(normalizedPath, location.query, location.hash);
      return;
    }

    const groups = match.groups ?? {};
    const nextResidue = normalizeResidue(groups.rest__);
    const nextParams = freezeParams(extractParams(groups));
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

    if (stateChanged) {
      this._notify();
    }

    this.refresh();
  }

  public refresh(): void {
    if (!this.active || this.children.length === 0) {
      return;
    }

    const nextResidue = this.residue;
    const location = { query: this.$query, hash: this.$hash };
    const matchingChildren: RouteContext[] = [];
    for (const child of this.children) {
      if (child._match(nextResidue) !== null) {
        matchingChildren.push(child);
      }
    }

    const regularMatches = matchingChildren.filter(child => !child._fallback);
    const matches = regularMatches.length > 0
      ? regularMatches
      : matchingChildren.filter(child => child._fallback);
    const matchSet = new Set(matches);
    const misses = this.children.filter(child => !matchSet.has(child));

    switch (this._swapOrder) {
      case 'detach-current-attach-next':
        for (const child of misses) {
          child._deactivateBranch('/__inactive__', this.$query, this.$hash);
        }
        for (const child of matches) {
          child.apply(nextResidue, location);
        }
        break;
      case 'attach-next-detach-current':
      default:
        for (const child of matches) {
          child.apply(nextResidue, location);
        }
        for (const child of misses) {
          child._deactivateBranch('/__inactive__', this.$query, this.$hash);
        }
        break;
      case 'parallel':
        for (const child of this.children) {
          if (matchSet.has(child)) {
            child.apply(nextResidue, location);
          } else {
            child._deactivateBranch('/__inactive__', this.$query, this.$hash);
          }
        }
        break;
    }
  }

  public createChild(pattern?: string, options: RouteContextOptions = {}): IRouteContext {
    const child = new RouteContext(this, pattern, {
      exact: options.exact,
      fallback: options.fallback,
      swapOrder: options.swapOrder ?? this._swapOrder,
      hrefFormatter: this._hrefFormatter,
    });
    this.children.push(child);
    if (this.active) {
      this.refresh();
    } else {
      child.apply('/__inactive__', { query: this.$query, hash: this.$hash });
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
      || this.residue !== '/'
      || Object.keys(this.$params).length > 0
      || this.$path !== path
      || this.$query.toString() !== query.toString()
      || this.$hash !== hash;

    this.active = false;
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
    const normalizedPath = normalizePath(path);
    this._matcher.lastIndex = 0;
    const match = this._matcher.exec(normalizedPath);
    if (match === null) {
      return null;
    }

    const groups = match.groups ?? {};
    return {
      residue: normalizeResidue(groups.rest__),
    };
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
    return contexts.find(context => context.fullPath === normalizedPath)
      ?? contexts.find(context => context.pattern === normalizedPattern)
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

  private _getContexts(): IRouteContext[] {
    const contexts: IRouteContext[] = [this];
    for (let index = 0; index < contexts.length; index++) {
      contexts.push(...contexts[index].children);
    }
    return contexts;
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
      params: this.$params,
      residue: this.residue,
      path: this.$path,
      query: this.$query,
      hash: this.$hash,
    };
  }
}

computed<RouteContext>({ deps: ['root.$path', '$query', '$hash'] })(
  RouteContext.prototype.isActive,
  { kind: 'method' } as ClassMethodDecoratorContext<RouteContext>,
);

function compilePattern(pattern: string, exact: boolean, transparentRoot: boolean): RegExp {
  if (pattern === '*') {
    if (transparentRoot) {
      return /^(?<rest__>\/.*|\/)?$/;
    }
    return exact
      ? /^\/[^/]+$/
      : /^\/[^/]+(?<rest__>\/.*)?$/;
  }

  if (pattern === '/') {
    return /^\/$/;
  }

  const parts = pattern.split('/').filter(Boolean);
  const restIndex = parts.indexOf('**');
  if (restIndex >= 0 && restIndex !== parts.length - 1) {
    throw new Error(`The rest wildcard must be the final segment in route pattern "${pattern}".`);
  }
  const consumesRest = restIndex >= 0;
  const routeParts = consumesRest ? parts.slice(0, -1) : parts;
  let compiled = '';
  for (const part of routeParts) {
    if (part === '*') {
      compiled += '/[^/]+';
      continue;
    }
    if (part.startsWith(':')) {
      const optional = part.endsWith('?');
      const name = part.slice(1, optional ? -1 : undefined);
      const parameter = `(?<${escapeGroupName(name)}>[^/]+)`;
      compiled += optional ? `(?:/${parameter})?` : `/${parameter}`;
      continue;
    }
    compiled += `/${escapeRegex(part)}`;
  }

  if (consumesRest) {
    return routeParts.length === 0
      ? /^\/(?<restWildcard__>.*)$/
      : new RegExp(`^${compiled}(?:/(?<restWildcard__>.*))?$`);
  }

  const pathExpression = routeParts.every(part => part.startsWith(':') && part.endsWith('?'))
    ? `(?:${compiled}|/)`
    : compiled;
  return exact
    ? new RegExp(`^${pathExpression}$`)
    : new RegExp(`^${pathExpression}(?<rest__>/.*)?$`);
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
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
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
      const optional = segment.endsWith('?');
      const name = segment.slice(1, optional ? -1 : undefined);
      return optional && params[name] == null
        ? []
        : [encodeRouteParam(name, params, false)];
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
