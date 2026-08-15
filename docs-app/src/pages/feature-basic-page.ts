import template from './feature-basic-page.html?raw';

export class FeatureBasicPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-basic-page',
    template,
  } as const;
}
