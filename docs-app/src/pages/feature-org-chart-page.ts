import template from './feature-org-chart-page.html?raw';

export class FeatureOrgChartPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-org-chart-page',
    template,
  } as const;
}
