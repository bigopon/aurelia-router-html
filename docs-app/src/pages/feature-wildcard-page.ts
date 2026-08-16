import template from './feature-wildcard-page.html?raw';

export class FeatureWildcardPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-wildcard-page',
    template,
  } as const;
}
