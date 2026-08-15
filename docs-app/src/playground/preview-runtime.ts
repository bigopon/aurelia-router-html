import { runtimePackages } from './runtime-packages';

globalThis.__PLAYGROUND_PACKAGES__ = runtimePackages;

declare global {
  var __PLAYGROUND_PACKAGES__: Record<string, Record<string, unknown>>;
}
