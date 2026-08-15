import { noop } from '@aurelia/kernel';
import { BrowserPlatform } from '@aurelia/platform-browser';
import { setPlatform } from '@aurelia/testing';
import { JSDOM } from 'jsdom';

const jsdom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const window = Object.assign(jsdom.window as unknown as Window & typeof globalThis);
const platform = new BrowserPlatform(window, {
  fetch: typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : noop as typeof window.fetch,
});

(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
setPlatform(platform);
BrowserPlatform.set(globalThis, platform);
