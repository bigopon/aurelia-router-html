import template from './feature-swap-page.html?raw';

export class FeatureSwapPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-swap-page',
    template,
  } as const;
}
