import { DI } from '@aurelia/kernel';

export interface RouteAnimationOptions {
  enabled: boolean;
  classPrefix: string;
  fallbackMs: number;
}

export type RouteAnimationInput = boolean | Partial<RouteAnimationOptions> | undefined;

export const IRouteAnimationOptions = DI.createInterface<RouteAnimationOptions>('IRouteAnimationOptions');

export function normalizeRouteAnimationOptions(input: RouteAnimationInput): RouteAnimationOptions {
  if (input === true) {
    return {
      enabled: true,
      classPrefix: 'au-route',
      fallbackMs: 400,
    };
  }

  if (input === false || input == null) {
    return {
      enabled: false,
      classPrefix: 'au-route',
      fallbackMs: 400,
    };
  }

  return {
    enabled: input.enabled ?? true,
    classPrefix: input.classPrefix ?? 'au-route',
    fallbackMs: input.fallbackMs ?? 400,
  };
}
