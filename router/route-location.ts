export type RouteQueryValue = string | number | boolean | null | undefined;
export type RouteQueryInput = string | URLSearchParams | Readonly<Record<string, RouteQueryValue | readonly RouteQueryValue[]>>;

export interface RouteQuery {
  readonly size: number;
  get(name: string): string | null;
  getAll(name: string): readonly string[];
  has(name: string): boolean;
  toString(): string;
}

export interface RouteLocation {
  readonly pathname: string;
  readonly query: RouteQuery;
  readonly hash: string;
}

export interface RouteHrefOptions {
  query?: RouteQueryInput | null;
  hash?: string | null;
  preserveQuery?: boolean;
  preserveHash?: boolean;
}

class QuerySnapshot implements RouteQuery {
  public readonly size: number;
  /** @internal */
  private readonly params: URLSearchParams;

  public constructor(input: string | URLSearchParams = '') {
    this.params = new URLSearchParams(input);
    let size = 0;
    this.params.forEach(() => size++);
    this.size = size;
  }

  public get(name: string): string | null {
    return this.params.get(name);
  }

  public getAll(name: string): readonly string[] {
    return this.params.getAll(name);
  }

  public has(name: string): boolean {
    return this.params.has(name);
  }

  public toString(): string {
    return this.params.toString();
  }
}

export const emptyRouteQuery: RouteQuery = Object.freeze(new QuerySnapshot());

export function parseRouteLocation(input: string): RouteLocation {
  const trimmed = input.trim();
  const hashIndex = trimmed.indexOf('#');
  const withoutHash = hashIndex < 0 ? trimmed : trimmed.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : trimmed.slice(hashIndex + 1);
  const queryIndex = withoutHash.indexOf('?');
  const pathname = normalizeRoutePath(queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex));
  const search = queryIndex < 0 ? '' : withoutHash.slice(queryIndex + 1);
  return Object.freeze({
    pathname,
    query: createRouteQuery(search),
    hash,
  });
}

export function stringifyRouteLocation(location: RouteLocation): string {
  const search = location.query.toString();
  return `${normalizeRoutePath(location.pathname)}${search === '' ? '' : `?${search}`}${location.hash === '' ? '' : `#${stripHash(location.hash)}`}`;
}

export function createRouteHref(
  pathname: string,
  currentQuery: RouteQuery,
  currentHash: string,
  options: RouteHrefOptions = {},
): string {
  const params = new URLSearchParams(options.preserveQuery ? currentQuery.toString() : '');
  if (options.query != null) {
    appendQuery(params, options.query);
  } else if (options.query === null) {
    const keys: string[] = [];
    params.forEach((_, key) => keys.push(key));
    for (const key of new Set(keys)) {
      params.delete(key);
    }
  }
  const hash = options.hash === null
    ? ''
    : options.hash == null
      ? options.preserveHash ? currentHash : ''
      : stripHash(options.hash);
  return stringifyRouteLocation({
    pathname: normalizeRoutePath(pathname),
    query: createRouteQuery(params),
    hash,
  });
}

export function createRouteQuery(input: RouteQueryInput | RouteQuery = ''): RouteQuery {
  if (typeof input === 'object' && input !== null && 'getAll' in input && 'toString' in input) {
    return Object.freeze(new QuerySnapshot(input.toString()));
  }
  if (typeof input === 'string' || input instanceof URLSearchParams) {
    return Object.freeze(new QuerySnapshot(input));
  }
  const params = new URLSearchParams();
  appendQuery(params, input);
  return Object.freeze(new QuerySnapshot(params));
}

export function normalizeRoutePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '') {
    return '/';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/{2,}/g, '/');
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function appendQuery(params: URLSearchParams, input: RouteQueryInput): void {
  if (typeof input === 'string' || input instanceof URLSearchParams) {
    new URLSearchParams(input).forEach((value, key) => params.append(key, value));
    return;
  }
  for (const [key, value] of Object.entries(input)) {
    params.delete(key);
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item != null) {
        params.append(key, String(item));
      }
    }
  }
}

function stripHash(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}
