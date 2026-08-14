import { resolve } from 'aurelia';
import { IRouteCoordinator } from '../router/coordinator';
import { type Product } from './data/storefront-data';
import { StorefrontState } from './storefront-state';
import template from './my-app.html?raw';

export class MyApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'app',
    template,
  } as const;

  public path: string = '/';
  public detailProduct: Product | null = null;
  public detailLoading: boolean = false;
  public detailQuantity: number = 1;
  public allowPromoRoute: boolean = true;
  public repeatedFlashRoutes: Array<{ id: number; label: string }> = [];
  private readonly router = resolve(IRouteCoordinator);
  public readonly state = resolve(StorefrontState);
  private unobservePath: (() => void) | null = null;
  private detailLoadVersion: number = 0;
  private lastLoadedProductId: string | null = null;

  public binding(): void {
    this.unobservePath = this.router.subscribe(path => {
      this.path = path;
      void this.syncDetailState(path);
    });
  }

  public unbinding(): void {
    this.unobservePath?.();
    this.unobservePath = null;
  }

  public get products(): Product[] {
    return this.state.products;
  }

  public get featuredProducts(): Product[] {
    return this.products.slice(0, 2);
  }

  public get categories(): string[] {
    return this.state.categories;
  }

  public get cartItems() {
    return this.state.cartItems;
  }

  public get cartCount(): number {
    return this.state.cartCount;
  }

  public get cartTotal(): string {
    return this.state.cartTotalLabel;
  }

  public get relatedProducts(): Product[] {
    return this.state.getRelatedProducts(this.detailProduct);
  }

  public get relatedProduct(): Product | null {
    return this.state.getProduct(this.currentRelatedId);
  }

  public addToCart(productId: string, quantity: number = 1): void {
    this.state.addToCart(productId, quantity);
  }

  public addDetailToCart(): void {
    if (this.detailProduct == null) {
      return;
    }
    this.state.addToCart(this.detailProduct.id, this.detailQuantity);
  }

  public setCategory(category: string): void {
    this.state.activeCategory = category;
  }

  public togglePromoRoute(): void {
    this.allowPromoRoute = !this.allowPromoRoute;
  }

  public addFlashRoute(): void {
    if (this.repeatedFlashRoutes.length > 0) {
      return;
    }
    this.repeatedFlashRoutes = [{
      id: Date.now(),
      label: `Flash route for ${this.detailProduct?.name ?? 'current product'}`,
    }];
  }

  public removeFlashRoute(): void {
    this.repeatedFlashRoutes = [];
  }

  public go(path: string): void {
    this.router.load(path);
  }

  public formatPrice(value: number): string {
    return this.state.formatCurrency(value);
  }

  public getCheckoutComponent() {
    return import('./pages/checkout-flow').then(m => m.CheckoutFlow);
  }

  public getAccountComponent() {
    return import('./pages/account-area').then(m => m.AccountArea);
  }

  public getReviewComponent() {
    return import('./pages/product-reviews').then(m => m.ProductReviews);
  }

  public getSpecsComponent() {
    return import('./pages/product-specs').then(m => m.ProductSpecs);
  }

  private async syncDetailState(path: string): Promise<void> {
    const productId = this.getCurrentProductId(path);
    if (productId == null) {
      this.detailProduct = null;
      this.detailLoading = false;
      this.detailQuantity = 1;
      this.lastLoadedProductId = null;
      return;
    }

    if (productId === this.lastLoadedProductId && this.detailProduct != null) {
      return;
    }

    const loadVersion = ++this.detailLoadVersion;
    this.detailLoading = true;
    this.detailProduct = null;
    this.detailQuantity = 1;
    this.lastLoadedProductId = productId;

    const product = await this.state.loadProduct(productId);
    if (loadVersion !== this.detailLoadVersion) {
      return;
    }

    this.detailProduct = product;
    this.detailLoading = false;
  }

  private get currentRelatedId(): string | null {
    const parts = this.path.split('/');
    return parts[1] === 'products' && parts[3] === 'related' && parts[4] != null && parts[4] !== ''
      ? parts[4]
      : null;
  }

  private getCurrentProductId(path: string): string | null {
    const parts = path.split('/');
    return parts[1] === 'products' && parts[2] != null && parts[2] !== ''
      ? parts[2]
      : null;
  }
}
