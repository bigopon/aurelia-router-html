import Aurelia from 'aurelia';
import { Registration } from '@aurelia/kernel';
import { MyApp } from './my-app';
import { Routing } from '../router/configuration';
import { StorefrontState } from './storefront-state';
import { ProductSearchValueConverter } from './value-converters/product-search';
import { ProductSortValueConverter } from './value-converters/product-sort';
import type { BrowserRoutingMode } from '../router/browser-path-adapter';
import './main.css';

const documentOptions = document.documentElement.dataset;
const routingMode = (documentOptions.routingMode ?? 'path') as BrowserRoutingMode;
const basePath = documentOptions.basePath;

Aurelia
  .register(
    Routing.customize({
      interceptLinks: true,
      animations: true,
      titles: true,
      routingMode,
      ...(basePath == null ? {} : { basePath }),
    }),
    Registration.singleton(StorefrontState, StorefrontState),
    ProductSearchValueConverter,
    ProductSortValueConverter,
  )
  .app({
    host: document.querySelector('app')!,
    component: MyApp,
  })
  .start();
