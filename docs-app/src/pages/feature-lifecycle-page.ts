import template from './feature-lifecycle-page.html?raw';

export class FeatureLifecyclePage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-lifecycle-page',
    template,
  } as const;
}
