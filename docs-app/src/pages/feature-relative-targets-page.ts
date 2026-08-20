import template from './feature-relative-targets-page.html?raw';

export class FeatureRelativeTargetsPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-relative-targets-page',
    template,
  } as const;
}
