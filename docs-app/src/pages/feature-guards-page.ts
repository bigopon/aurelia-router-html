import template from './feature-guards-page.html?raw';

export class FeatureGuardsPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-guards-page',
    template,
  } as const;
}
