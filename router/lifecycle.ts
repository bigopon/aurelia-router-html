import type { RouteQuery } from './route-location';
import type { IRouteContext } from './route-context';

export interface RouteLifecycleData {
  readonly loading: unknown;
  readonly loaded: unknown;
}

export interface RouteLifecycleContext {
  readonly route: IRouteContext;
  readonly params: Readonly<Record<string, string>>;
  readonly query: RouteQuery;
  readonly hash: string;
  readonly previousData: RouteLifecycleData;
  readonly signal: AbortSignal;
}
