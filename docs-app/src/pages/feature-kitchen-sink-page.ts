import { resolve } from 'aurelia';
import { KitchenShell } from '../resources/kitchen-shell';
import { DocsState } from '../state/docs-state';
import template from './feature-kitchen-sink-page.html?raw';

interface KitchenPage {
  id: string;
  label: string;
  description: string;
}

interface KitchenRoom {
  id: string;
  name: string;
  note: string;
  pages: KitchenPage[];
}

export class FeatureKitchenSinkPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-kitchen-sink-page',
    template,
    dependencies: [KitchenShell],
  } as const;

  public readonly state = resolve(DocsState);
  public readonly productName: string = 'Router HTML';
  public readonly rooms: KitchenRoom[] = [
    {
      id: 'sunny',
      name: 'Sunny Room',
      note: '',
      pages: [
        { id: 'toys', label: 'Toys', description: 'Pick a toy for a day of make-believe.' },
        { id: 'snacks', label: 'Snacks', description: 'Choose a little snack after playtime.' },
      ],
    },
    {
      id: 'moon',
      name: 'Moon Room',
      note: '',
      pages: [
        { id: 'stories', label: 'Stories', description: 'Find a cozy story for quiet time.' },
        { id: 'friends', label: 'Friends', description: 'See the friends visiting this room.' },
      ],
    },
  ];
}
