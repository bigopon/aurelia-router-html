import template from './feature-redirects-page.html?raw';

export class FeatureRedirectsPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-redirects-page',
    template,
  } as const;
}
