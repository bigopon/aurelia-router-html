import { DI } from '@aurelia/kernel';

export interface RouteState {
  readonly active: boolean;
  readonly params: Readonly<Record<string, string>>;
  readonly residue: string;
  readonly path: string;
}

export type RouteContextCallback = (state: RouteState) => void;
export type SwapOrder = 'attach-next-detach-current' | 'detach-current-attach-next' | 'parallel';

export interface RouteContextOptions {
  swapOrder?: SwapOrder;
}

export interface IRouteContext {
  readonly parent: IRouteContext | null;
  readonly children: readonly IRouteContext[];
  readonly active: boolean;
  readonly residue: string;
  readonly $path: string;
  readonly $params: Readonly<Record<string, string>>;
  readonly pattern: string;

  usePattern(pattern: string): void;
  apply(path: string): void;
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
  public pattern: string = '*';

  private _matcher: RegExp = /^(?<rest__>\/.*|\/)?$/;
  private readonly _subscriptions = new Set<RouteContextCallback>();
  private _disposed: boolean = false;
  private readonly _swapOrder: SwapOrder;

  public constructor(
    public readonly parent: IRouteContext | null,
    pattern: string = '*',
    options: RouteContextOptions = {},
  ) {
    this._swapOrder = options.swapOrder ?? (
      parent instanceof RouteContext
        ? parent._swapOrder
        : 'attach-next-detach-current'
    );
    this.usePattern(pattern);
  }

  public usePattern(pattern: string): void {
    this.pattern = normalizePattern(pattern);
    this._matcher = compilePattern(this.pattern);
  }

  public apply(path: string): void {
    if (this._disposed) {
      return;
    }

    const normalizedPath = normalizePath(path);
    this.$path = normalizedPath;
    this._matcher.lastIndex = 0;
    const match = this._matcher.exec(normalizedPath);

    if (match === null) {
      this._deactivateBranch(normalizedPath);
      return;
    }

    const groups = match.groups ?? {};
    const nextResidue = normalizeResidue(groups.rest__);
    const nextParams = freezeParams(extractParams(groups));
    const stateChanged =
      !this.active
      || this.residue !== nextResidue
      || !shallowEqual(this.$params, nextParams)
      || this.$path !== normalizedPath;

    this.active = true;
    this.residue = nextResidue;
    this.$params = nextParams;

    if (stateChanged) {
      this._notify();
    }

    if (this.children.length === 0) {
      return;
    }

    const matches: RouteContext[] = [];
    const misses: RouteContext[] = [];
    for (const child of this.children) {
      if (child._match(nextResidue) === null) {
        misses.push(child);
        continue;
      }

      matches.push(child);
    }

    switch (this._swapOrder) {
      case 'detach-current-attach-next':
        for (const child of misses) {
          child._deactivateBranch('/__inactive__');
        }
        for (const child of matches) {
          child.apply(nextResidue);
        }
        break;
      case 'attach-next-detach-current':
      default:
        for (const child of matches) {
          child.apply(nextResidue);
        }
        for (const child of misses) {
          child._deactivateBranch('/__inactive__');
        }
        break;
      case 'parallel':
        for (const child of this.children) {
          if (matches.includes(child)) {
            child.apply(nextResidue);
          } else {
            child._deactivateBranch('/__inactive__');
          }
        }
        break;
    }
  }

  public createChild(pattern?: string, options: RouteContextOptions = {}): IRouteContext {
    const child = new RouteContext(this, pattern, { swapOrder: options.swapOrder ?? this._swapOrder });
    this.children.push(child);
    child.apply(this.active ? this.residue : '/__inactive__');
    return child;
  }

  public subscribe(callback: RouteContextCallback): () => void {
    this._subscriptions.add(callback);
    callback(this._currentState());
    return () => {
      this._subscriptions.delete(callback);
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

    const parent = this.parent;
    if (parent instanceof RouteContext) {
      const index = parent.children.indexOf(this);
      if (index >= 0) {
        parent.children.splice(index, 1);
      }
    }
  }

  private _deactivateBranch(path: string): void {
    const stateChanged = this.active || this.residue !== '/' || Object.keys(this.$params).length > 0 || this.$path !== path;

    this.active = false;
    this.$path = path;
    this.residue = '/';
    this.$params = Object.freeze({});

    if (stateChanged) {
      this._notify();
    }

    for (const child of this.children) {
      child._deactivateBranch('/__inactive__');
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
    };
  }
}

function compilePattern(pattern: string): RegExp {
  if (pattern === '*') {
    return /^(?<rest__>\/.*|\/)?$/;
  }

  if (pattern === '/') {
    return /^\/$/;
  }

  const parts = pattern.split('/').filter(Boolean);
  const compiled = parts.map(part => {
    if (part.startsWith(':')) {
      const name = part.slice(1);
      return `(?<${escapeGroupName(name)}>[^/]+)`;
    }
    return escapeRegex(part);
  });

  return new RegExp(`^/${compiled.join('/')}(?<rest__>/.*)?$`);
}

function extractParams(groups: Record<string, string | undefined>): Record<string, string> {
  const params: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(groups)) {
    if (key === 'rest__' || value == null) {
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
  if (pattern === '*' || pattern === '/') {
    return pattern;
  }

  const trimmed = pattern.trim();
  if (trimmed === '') {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeGroupName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}
