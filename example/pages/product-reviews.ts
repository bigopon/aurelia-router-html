import { resolve } from 'aurelia';
import { type Product } from '../data/storefront-data';
import { StorefrontState } from '../storefront-state';
import template from './product-reviews.html?raw';

interface ReviewDraft {
  author: string;
  role: string;
  score: number;
  body: string;
}

export class ProductReviews {
  public static readonly $au = {
    type: 'custom-element',
    name: 'product-reviews',
    template,
  } as const;

  public productId: string = '';
  public showEditor: boolean = false;
  public reviewList: Product['reviews'] = [];
  private readonly state = resolve(StorefrontState);

  public activate(model?: { productId?: string }): void {
    this.productId = model?.productId ?? '';
    this.showEditor = false;
    this.reviewList = [...(this.product?.reviews ?? [])];
  }

  public get product(): Product | null {
    return this.state.getProduct(this.productId);
  }

  public get reviews() {
    return this.reviewList;
  }

  public openEditor(): void {
    this.showEditor = true;
  }

  public closeEditor(): void {
    this.showEditor = false;
  }

  public submitReview(review: ReviewDraft): void {
    if (this.product == null) {
      return;
    }

    this.state.submitReview(this.product.id, review);
    this.reviewList = [...(this.product.reviews ?? [])];
    this.showEditor = false;
  }

  public getReviewEditorComponent() {
    return import('./review-editor').then(m => m.ReviewEditor);
  }
}
