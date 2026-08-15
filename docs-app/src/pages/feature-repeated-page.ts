import template from './feature-repeated-page.html?raw';

export class FeatureRepeatedPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-repeated-page',
    template,
  } as const;
}
