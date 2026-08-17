import Aurelia from 'aurelia';
import { Routing } from '../../../router/configuration';
import { RedirectApp } from './redirect-app';

Aurelia
  .register(Routing)
  .app({
    host: document.querySelector('redirect-app')!,
    component: RedirectApp,
  })
  .start();
