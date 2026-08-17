import type { IRouteContext, RouteLoadOptions, RouteParams } from './route-context';

export type RouteGuardFailure = 'navigation' | 'local';

export interface RouteGuardRedirect {
  readonly target: string | IRouteContext;
  readonly params?: RouteParams;
  readonly options?: RouteLoadOptions;
}

export interface RouteGuardContext {
  readonly route: IRouteContext;
  readonly signal: AbortSignal;
}

export type RouteGuardResult = boolean | string | RouteGuardRedirect | null | undefined;
export type RouteCanLoadCallback = (transition: RouteGuardContext) => RouteGuardResult | Promise<RouteGuardResult>;
export type RouteCanUnloadCallback = (transition: RouteGuardContext) => boolean | null | undefined | Promise<boolean | null | undefined>;
