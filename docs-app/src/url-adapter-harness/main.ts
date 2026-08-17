import Aurelia from 'aurelia';
import { Routing } from '../../../router/configuration';
import type { RouteScrollOptions, RouteScrollRestoration } from '../../../router/scroll';
import { UrlAdapterApp } from './url-adapter-app';

const browserUrl = new URL(window.location.href);
const routeQueryKey = browserUrl.searchParams.has('route') ? 'route' : 'app';
const routingMode = browserUrl.searchParams.has(routeQueryKey)
  ? 'query'
  : browserUrl.searchParams.get('mode') === 'path' || browserUrl.hash === ''
    ? 'path'
    : 'hash';
const restorationValue = browserUrl.searchParams.get('restoration');
const restoration: RouteScrollRestoration | undefined = restorationValue === 'restore'
  || restorationValue === 'top'
  || restorationValue === 'preserve'
  || restorationValue === 'manual'
  ? restorationValue
  : undefined;
const hash = browserUrl.searchParams.get('hash') === 'false' ? false : undefined;
const scrolling: RouteScrollOptions | undefined = restoration == null && hash == null
  ? undefined
  : { restoration, hash };
const focusValue = browserUrl.searchParams.get('focus');
const focus = focusValue === 'true'
  ? true
  : focusValue === 'heading'
    ? { fallback: 'heading' as const }
    : undefined;

Aurelia
  .register(Routing.customize({
    interceptLinks: true,
    animations: false,
    routingMode,
    routeQueryKey,
    scrolling,
    focus,
  }))
  .app({
    host: document.querySelector('url-adapter-app')!,
    component: UrlAdapterApp,
  })
  .start();
