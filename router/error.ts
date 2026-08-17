import type { RouteGuardRedirect } from './guard';
import type { IRouteContext } from './route-context';

export type RouteFailurePhase = 'can-load' | 'loading' | 'activation' | 'loaded';

export interface RouteFailure {
  readonly error: unknown;
  readonly source: IRouteContext;
  readonly boundary: IRouteContext;
  readonly recovery: IRouteContext;
  readonly phase: RouteFailurePhase;
  readonly signal: AbortSignal;
}

export interface RouteLocalRecovery {
  readonly recover: 'local';
}

export type RouteErrorResult = string | RouteGuardRedirect | RouteLocalRecovery | false | null | undefined;
export type RouteErrorHandler = (failure: RouteFailure) => RouteErrorResult | Promise<RouteErrorResult>;

/** @internal */
export class RoutePhaseError extends Error {
  public constructor(
    public readonly phase: RouteFailurePhase,
    public readonly original: unknown,
  ) {
    super(`Route ${phase} failed.`, { cause: original });
  }
}
