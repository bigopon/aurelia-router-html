import { DI } from '@aurelia/kernel';
import type { IRouteContext } from './route-context';

export interface RouteAnimationOptions {
  enabled: boolean;
  classPrefix: string;
  fallbackMs: number;
}

export interface RouteAnimationContext {
  readonly direction: 'enter' | 'leave';
  readonly route: IRouteContext;
  readonly elements: readonly HTMLElement[];
  readonly signal: AbortSignal;
  readonly fallbackMs: number;
}

export type RouteAnimationCallback = (context: RouteAnimationContext) => void | Promise<void>;

export interface RouteTransitionEndContext {
  readonly direction: 'enter' | 'leave';
  readonly route: IRouteContext;
  readonly navigationId: number;
  readonly animated: boolean;
}

export type RouteTransitionEndCallback = (context: RouteTransitionEndContext) => void;

export interface RouteAnimationConfig {
  kind?: 'css' | 'js';
  name?: string;
  run?: RouteAnimationCallback;
  fallbackMs?: number;
}

export type RouteAnimationValue =
  | boolean
  | string
  | RouteAnimationCallback
  | RouteAnimationConfig
  | null
  | undefined;

export type RouteAnimationInput = boolean | Partial<RouteAnimationOptions> | undefined;

export interface RouteAnimationDescriptor {
  readonly kind: 'none' | 'css' | 'js';
  readonly name: string;
  readonly run: RouteAnimationCallback | null;
  readonly fallbackMs: number;
}

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

export function normalizeRouteAnimationValue(
  value: RouteAnimationValue,
  options: RouteAnimationOptions,
): RouteAnimationDescriptor {
  if (value == null || value === false) {
    return createCssDescriptor('default', options, false);
  }
  if (value === true) {
    return createCssDescriptor('default', options, true);
  }
  if (typeof value === 'string') {
    const name = value.trim();
    return createCssDescriptor(name === '' ? 'default' : name, options, true);
  }
  if (typeof value === 'function') {
    return {
      kind: 'js',
      name: 'default',
      run: value,
      fallbackMs: options.fallbackMs,
    };
  }

  const fallbackMs = value.fallbackMs ?? options.fallbackMs;
  if (value.kind === 'js' || value.run != null) {
    if (value.run == null) {
      throw new Error('A route animation config with kind "js" must provide a run callback.');
    }
    return {
      kind: 'js',
      name: value.name?.trim() || 'default',
      run: value.run,
      fallbackMs,
    };
  }

  return {
    kind: 'css',
    name: value.name?.trim() || 'default',
    run: null,
    fallbackMs,
  };
}

function createCssDescriptor(
  name: string,
  options: RouteAnimationOptions,
  active: boolean,
): RouteAnimationDescriptor {
  return {
    kind: active ? 'css' : 'none',
    name,
    run: null,
    fallbackMs: options.fallbackMs,
  };
}
