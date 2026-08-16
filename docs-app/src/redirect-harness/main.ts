import Aurelia from 'aurelia';
import { Routing } from '../../../router/configuration';
import { RedirectApp } from './redirect-app';

void Aurelia
  .register(Routing)
  .app({
    host: document.querySelector('redirect-app')!,
    component: RedirectApp,
  })
  .start();
