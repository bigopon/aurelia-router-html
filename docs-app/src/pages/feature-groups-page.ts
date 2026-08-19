import template from './feature-groups-page.html?raw';

export class FeatureGroupsPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-groups-page',
    template,
  } as const;
}
