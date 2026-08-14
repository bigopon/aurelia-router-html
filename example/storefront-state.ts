import { orders, products, type Order, type Product, type ProductReview } from './data/storefront-data';

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CheckoutForm {
  email: string;
  shippingName: string;
  address: string;
  shippingSpeed: string;
  cardholder: string;
  paymentMethod: string;
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export class StorefrontState {
  public readonly products = products;
  public readonly orders = orders;
  public searchTerm: string = '';
  public activeCategory: string = 'all';
  public sortMode: string = 'featured';
  public cart: CartLine[] = [{ productId: 'aster-pack', quantity: 1 }];
  public accountSignedIn: boolean = false;
  public checkout = this.createCheckoutForm();

  public get categories(): string[] {
    return ['all', ...new Set(this.products.map(product => product.category))];
  }

  public get cartItems(): Array<{ product: Product; quantity: number; lineTotal: number }> {
    return this.cart
      .map(line => {
        const product = this.getProduct(line.productId);
        if (product == null) {
          return null;
        }

        return {
          product,
          quantity: line.quantity,
          lineTotal: product.price * line.quantity,
        };
      })
      .filter((line): line is { product: Product; quantity: number; lineTotal: number } => line !== null);
  }

  public get cartCount(): number {
    return this.cart.reduce((sum, line) => sum + line.quantity, 0);
  }

  public get cartSubtotal(): number {
    return this.cartItems.reduce((sum, line) => sum + line.lineTotal, 0);
  }

  public get cartTotalLabel(): string {
    return currency.format(this.cartSubtotal);
  }

  public get canOpenPayment(): boolean {
    const { email, shippingName, address, shippingSpeed } = this.checkout;
    return email.trim() !== '' && shippingName.trim() !== '' && address.trim() !== '' && shippingSpeed.trim() !== '';
  }

  public get canOpenReview(): boolean {
    const { cardholder, paymentMethod } = this.checkout;
    return this.canOpenPayment && cardholder.trim() !== '' && paymentMethod.trim() !== '';
  }

  public getProduct(productId: string | null | undefined): Product | null {
    if (productId == null || productId === '') {
      return null;
    }
    return this.products.find(product => product.id === productId) ?? null;
  }

  public getOrder(orderId: string | null | undefined): Order | null {
    if (orderId == null || orderId === '') {
      return null;
    }
    return this.orders.find(order => order.id === orderId) ?? null;
  }

  public getRelatedProducts(product: Product | null): Product[] {
    if (product == null) {
      return [];
    }
    return product.relatedIds
      .map(id => this.getProduct(id))
      .filter((item): item is Product => item !== null);
  }

  public async loadProduct(productId: string | null): Promise<Product | null> {
    await delay(220);
    return this.getProduct(productId);
  }

  public addToCart(productId: string, quantity: number = 1): void {
    const normalizedQuantity = Math.max(1, Math.floor(quantity));
    const index = this.cart.findIndex(line => line.productId === productId);
    if (index === -1) {
      this.cart = [...this.cart, { productId, quantity: normalizedQuantity }];
      return;
    }

    this.cart = this.cart.map((line, lineIndex) => lineIndex === index
      ? { ...line, quantity: line.quantity + normalizedQuantity }
      : line);
  }

  public setQuantity(productId: string, quantity: number): void {
    const normalizedQuantity = Math.max(1, Math.floor(quantity) || 1);
    this.cart = this.cart.map(line => line.productId === productId
      ? { ...line, quantity: normalizedQuantity }
      : line);
  }

  public removeFromCart(productId: string): void {
    this.cart = this.cart.filter(line => line.productId !== productId);
  }

  public submitReview(productId: string, review: ProductReview): void {
    const product = this.getProduct(productId);
    if (product == null) {
      return;
    }

    product.reviews = [review, ...product.reviews];
  }

  public resetCheckout(): void {
    this.checkout = this.createCheckoutForm();
  }

  public formatCurrency(value: number): string {
    return currency.format(value);
  }

  private createCheckoutForm(): CheckoutForm {
    return {
      email: '',
      shippingName: '',
      address: '',
      shippingSpeed: '',
      cardholder: '',
      paymentMethod: '',
    };
  }
}
