import template from './feature-params-page.html?raw';

export class FeatureParamsPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-params-page',
    template,
  } as const;
}
