import template from './feature-nested-page.html?raw';

export class FeatureNestedPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-nested-page',
    template,
  } as const;
}
