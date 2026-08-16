import template from './feature-adapters-page.html?raw';

export class FeatureAdaptersPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-adapters-page',
    template,
  } as const;
}
