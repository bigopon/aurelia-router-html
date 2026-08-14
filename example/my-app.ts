import { resolve } from 'aurelia';
import { IRouteCoordinator } from '../router/coordinator';
import template from './my-app.html?raw';

export class MyApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'app',
    template,
  } as const;

  public path: string = '/';
  private readonly router = resolve(IRouteCoordinator);
  private unobservePath: (() => void) | null = null;

  public binding(): void {
    this.unobservePath = this.router.subscribe(path => {
      this.path = path;
    });
  }

  public unbinding(): void {
    this.unobservePath?.();
    this.unobservePath = null;
  }

  public getStoreOrderComponent() {
    return import('./pages/store-order').then(m => m.StoreOrder);
  }
}
