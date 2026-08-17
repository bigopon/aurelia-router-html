import template from './feature-focus-page.html?raw';

export class FeatureFocusPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-focus-page',
    template,
  } as const;
}
