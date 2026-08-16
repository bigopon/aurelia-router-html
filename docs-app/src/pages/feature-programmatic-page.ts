import template from './feature-programmatic-page.html?raw';

export class FeatureProgrammaticPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-programmatic-page',
    template,
  } as const;
}
