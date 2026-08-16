import template from './feature-titles-page.html?raw';

export class FeatureTitlesPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-titles-page',
    template,
  } as const;
}
