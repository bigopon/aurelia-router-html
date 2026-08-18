import type { RouteQuery } from './route-location';
import type { IRouteContext } from './route-context';

export interface RouteLifecycleData {
  readonly loading: unknown;
  readonly loaded: unknown;
}

export type RouteLifecycleKind = 'enter' | 'replace' | 'rerun';
export type RouteTransitionPlan = 'replace' | 'rerun' | 'none';
export type RouteTransitionTrigger = 'params' | 'query' | 'hash';
export type RouteTransitionCause = RouteTransitionTrigger | 'reload';

export interface RouteLifecycleContext {
  readonly kind: RouteLifecycleKind;
  readonly route: IRouteContext;
  readonly from: RouteValueSnapshot | null;
  readonly to: RouteValueSnapshot;
  readonly changes: readonly RouteTransitionCause[];
  readonly params: Readonly<Record<string, string>>;
  readonly query: RouteQuery;
  readonly hash: string;
  readonly previousData: RouteLifecycleData;
  readonly signal: AbortSignal;
}

export interface RouteValueSnapshot {
  readonly path: string;
  readonly residue: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: RouteQuery;
  readonly hash: string;
}
