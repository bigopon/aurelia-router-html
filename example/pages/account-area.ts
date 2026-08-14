import { resolve } from 'aurelia';
import { StorefrontState } from '../storefront-state';
import template from './account-area.html?raw';

export class AccountArea {
  public static readonly $au = {
    type: 'custom-element',
    name: 'account-area',
    template,
  } as const;

  public readonly state = resolve(StorefrontState);

  public toggleAccount(): void {
    this.state.accountSignedIn = !this.state.accountSignedIn;
  }

  public getOrderDetailComponent() {
    return import('./order-detail').then(m => m.OrderDetail);
  }
}
