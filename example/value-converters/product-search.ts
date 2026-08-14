import type { Product } from '../data/storefront-data';

export class ProductSearchValueConverter {
  public static readonly $au = {
    type: 'value-converter',
    name: 'productSearch',
  } as const;

  public toView(products: Product[], searchTerm: string, category: string): Product[] {
    const search = searchTerm.trim().toLowerCase();

    return products.filter(product => {
      const categoryMatch = category === 'all' || product.category === category;
      const searchMatch = search === ''
        || product.name.toLowerCase().includes(search)
        || product.blurb.toLowerCase().includes(search)
        || product.highlights.some(highlight => highlight.toLowerCase().includes(search));
      return categoryMatch && searchMatch;
    });
  }
}
