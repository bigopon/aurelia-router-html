export interface ProductReview {
  author: string;
  role: string;
  score: number;
  body: string;
}

export interface ProductSpecGroup {
  slug: string;
  title: string;
  points: string[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  accent: string;
  price: number;
  blurb: string;
  description: string;
  inventory: number;
  isOnSale: boolean;
  releaseTag: string;
  highlights: string[];
  specGroups: ProductSpecGroup[];
  reviews: ProductReview[];
  relatedIds: string[];
}

export interface Order {
  id: string;
  placedOn: string;
  status: string;
  total: number;
  summary: string;
}

export const products: Product[] = [
  {
    id: 'aster-pack',
    name: 'Aster Travel Pack',
    category: 'Carry',
    accent: '#f26f63',
    price: 188,
    blurb: 'A modular weekender with a laptop sleeve, shoe tunnel, and hidden passport pocket.',
    description: 'Built for red-eye flights and two-night resets, the Aster keeps tech, tailoring, and toiletries separated without looking technical.',
    inventory: 7,
    isOnSale: true,
    releaseTag: 'Summer drop',
    highlights: ['Waterproof shell', 'Compression straps', 'Laptop cradle'],
    specGroups: [
      {
        slug: 'materials',
        title: 'Materials',
        points: ['Ballistic recycled nylon shell', 'Hypalon pull tabs', 'Closed-cell base panel'],
      },
      {
        slug: 'carry',
        title: 'Carry system',
        points: ['Convertible shoulder straps', 'Hidden luggage pass-through', 'Top grab bar'],
      },
      {
        slug: 'layout',
        title: 'Layout',
        points: ['Shoe tunnel', 'Quick-pass tech sleeve', 'Passport stash pocket'],
      },
    ],
    reviews: [
      { author: 'Mina', role: 'Creative director', score: 5, body: 'Looks tailored, carries like gear. I stopped traveling with two bags.' },
      { author: 'Sam', role: 'Product manager', score: 4, body: 'The shoe tunnel is the feature I did not know I needed.' },
    ],
    relatedIds: ['quill-tote', 'halo-sling'],
  },
  {
    id: 'quill-tote',
    name: 'Quill Desk Tote',
    category: 'Work',
    accent: '#4472ca',
    price: 146,
    blurb: 'A structured tote that stands on its own with a slim charger dock and pen rail.',
    description: 'The Quill is designed for desk-to-dinner transitions, with enough structure for documents and enough softness for daily carry.',
    inventory: 14,
    isOnSale: false,
    releaseTag: 'Core line',
    highlights: ['Self-standing base', 'Magnetic organizer', 'Soft microsuede lining'],
    specGroups: [
      {
        slug: 'structure',
        title: 'Structure',
        points: ['Rigid floor insert', 'Reinforced corners', 'Tablet divider'],
      },
      {
        slug: 'organization',
        title: 'Organization',
        points: ['Pen rail', 'Charger slip', 'Cord keeper'],
      },
    ],
    reviews: [],
    relatedIds: ['aster-pack'],
  },
  {
    id: 'halo-sling',
    name: 'Halo Field Camera Sling',
    category: 'Travel',
    accent: '#1f9d84',
    price: 132,
    blurb: 'A compact sling with removable dividers for a mirrorless body and two primes.',
    description: 'Built around fast-access movement, the Halo stays close to the body and keeps your camera suspended away from hard edges.',
    inventory: 4,
    isOnSale: true,
    releaseTag: 'Low stock',
    highlights: ['Removable dividers', 'Tripod lash points', 'Weather zip'],
    specGroups: [
      {
        slug: 'protection',
        title: 'Protection',
        points: ['Suspended camera cradle', 'Impact foam sidewalls', 'Weather zip'],
      },
      {
        slug: 'access',
        title: 'Access',
        points: ['Swing-front opening', 'Rear passport sleeve', 'Tripod lash points'],
      },
    ],
    reviews: [
      { author: 'Nico', role: 'Photographer', score: 5, body: 'The fastest camera bag I have used on crowded trains.' },
      { author: 'Pia', role: 'Travel editor', score: 4, body: 'Great for city days, though I still switch to a roller for larger shoots.' },
    ],
    relatedIds: ['aster-pack'],
  },
];

export const orders: Order[] = [
  {
    id: 'ord-4102',
    placedOn: '2026-07-18',
    status: 'In transit',
    total: 188,
    summary: 'Aster Travel Pack with monogram tag.',
  },
  {
    id: 'ord-4027',
    placedOn: '2026-05-02',
    status: 'Delivered',
    total: 278,
    summary: 'Quill Desk Tote plus cable roll.',
  },
];
