import { resolve } from 'aurelia';
import { type Product } from '../data/storefront-data';
import { StorefrontState } from '../storefront-state';
import template from './product-specs.html?raw';

export class ProductSpecs {
  public static readonly $au = {
    type: 'custom-element',
    name: 'product-specs',
    template,
  } as const;

  public productId: string = '';
  private readonly state = resolve(StorefrontState);

  public activate(model?: { productId?: string }): void {
    this.productId = model?.productId ?? '';
  }

  public get product(): Product | null {
    return this.state.getProduct(this.productId);
  }
}
