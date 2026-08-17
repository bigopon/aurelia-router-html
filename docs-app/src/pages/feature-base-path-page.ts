import template from './feature-base-path-page.html?raw';

export class FeatureBasePathPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-base-path-page',
    template,
  } as const;
}
