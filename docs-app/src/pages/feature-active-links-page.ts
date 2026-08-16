import template from './feature-active-links-page.html?raw';

export class FeatureActiveLinksPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-active-links-page',
    template,
  } as const;
}
