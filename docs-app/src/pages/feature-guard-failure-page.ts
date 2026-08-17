import template from './feature-guard-failure-page.html?raw';

export class FeatureGuardFailurePage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-guard-failure-page',
    template,
  } as const;
}
