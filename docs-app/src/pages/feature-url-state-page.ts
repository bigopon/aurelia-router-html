import template from './feature-url-state-page.html?raw';

export class FeatureUrlStatePage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-url-state-page',
    template,
  } as const;
}
