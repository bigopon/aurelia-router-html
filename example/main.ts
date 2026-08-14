import Aurelia from 'aurelia';
import { MyApp } from './my-app';
import { Routing } from '../router/configuration';

Aurelia
  .register(
    Routing.customize({
      interceptLinks: true,
    }),
  )
  .app({
    host: document.querySelector('app')!,
    component: MyApp,
  })
  .start();
