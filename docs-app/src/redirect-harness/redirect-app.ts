import { resolve } from 'aurelia';
import { IRouteContext } from '../../../router/route-context';
import template from './redirect-app.html?raw';

export class RedirectApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'redirect-app',
    template,
  } as const;

  public dynamicTarget: string = '/__redirect-test__/products/:productId';
  public redirectError: string = '';
  private readonly route = resolve(IRouteContext);

  public useArchiveTarget(): void {
    this.dynamicTarget = '/__redirect-test__/archive/:productId';
  }

  public triggerLoop(): void {
    try {
      this.route.load('/__redirect-test__/loop-a');
    } catch (error) {
      this.redirectError = error instanceof Error ? error.message : String(error);
    }
  }
}
