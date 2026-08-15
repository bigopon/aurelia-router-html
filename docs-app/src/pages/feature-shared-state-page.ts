import template from './feature-shared-state-page.html?raw';

export class FeatureSharedStatePage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-shared-state-page',
    template,
  } as const;
}
