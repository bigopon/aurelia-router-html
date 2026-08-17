import Aurelia from 'aurelia';
import { Routing } from '../../../router/configuration';
import { UrlAdapterApp } from './url-adapter-app';

const browserUrl = new URL(window.location.href);
const routeQueryKey = browserUrl.searchParams.has('route') ? 'route' : 'app';
const routingMode = browserUrl.searchParams.has(routeQueryKey)
  ? 'query'
  : browserUrl.searchParams.get('mode') === 'path' || browserUrl.hash === ''
    ? 'path'
    : 'hash';

void Aurelia
  .register(Routing.customize({
    interceptLinks: true,
    animations: false,
    routingMode,
    routeQueryKey,
  }))
  .app({
    host: document.querySelector('url-adapter-app')!,
    component: UrlAdapterApp,
  })
  .start();
