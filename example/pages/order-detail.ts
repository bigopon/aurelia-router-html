import { resolve } from 'aurelia';
import { type Order } from '../data/storefront-data';
import { StorefrontState } from '../storefront-state';
import template from './order-detail.html?raw';

export class OrderDetail {
  public static readonly $au = {
    type: 'custom-element',
    name: 'order-detail',
    template,
  } as const;

  public orderId: string = '';
  private readonly state = resolve(StorefrontState);

  public activate(model?: { orderId?: string }): void {
    this.orderId = model?.orderId ?? '';
  }

  public get order(): Order | null {
    return this.state.getOrder(this.orderId);
  }

  public get totalLabel(): string {
    return this.order == null ? this.state.formatCurrency(0) : this.state.formatCurrency(this.order.total);
  }
}
