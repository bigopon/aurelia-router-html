import type { Product } from '../data/storefront-data';

export class ProductSortValueConverter {
  public static readonly $au = {
    type: 'value-converter',
    name: 'productSort',
  } as const;

  public toView(products: Product[], sortMode: string): Product[] {
    const sorted = [...products];
    switch (sortMode) {
      case 'price-asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return sorted;
    }
  }
}
