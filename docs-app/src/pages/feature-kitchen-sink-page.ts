import template from './feature-kitchen-sink-page.html?raw';

export class FeatureKitchenSinkPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-kitchen-sink-page',
    template,
  } as const;
}
