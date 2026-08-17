import Aurelia from 'aurelia';
import { Registration } from '@aurelia/kernel';
import { MyApp } from './my-app';
import { Routing } from '../router/configuration';
import { StorefrontState } from './storefront-state';
import { ProductSearchValueConverter } from './value-converters/product-search';
import { ProductSortValueConverter } from './value-converters/product-sort';
import './main.css';

Aurelia
  .register(
    Routing.customize({
      interceptLinks: true,
      animations: true,
      titles: true,
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
