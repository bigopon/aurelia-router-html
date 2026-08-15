import template from './feature-animation-page.html?raw';

export class FeatureAnimationPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-animation-page',
    template,
  } as const;
}
