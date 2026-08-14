import template from './store-order.html?raw';

export class StoreOrder {
  public static readonly $au = {
    type: 'custom-element',
    name: 'store-order',
    template,
  } as const;

  public storeId: string = '';

  public activate(model?: { storeId?: string }): void {
    this.storeId = model?.storeId ?? '';
  }
}
