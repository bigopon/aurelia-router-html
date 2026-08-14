import { resolve } from 'aurelia';
import { IRouteCoordinator } from '../../router/coordinator';
import { StorefrontState } from '../storefront-state';
import template from './checkout-flow.html?raw';

export class CheckoutFlow {
  public static readonly $au = {
    type: 'custom-element',
    name: 'checkout-flow',
    template,
  } as const;

  private readonly router = resolve(IRouteCoordinator);
  public readonly state = resolve(StorefrontState);

  public go(path: string): void {
    this.router.load(path);
  }

  public continueToPayment(): void {
    if (this.state.canOpenPayment) {
      this.go('/checkout/payment');
    }
  }

  public continueToReview(): void {
    if (this.state.canOpenReview) {
      this.go('/checkout/review');
    }
  }
}
