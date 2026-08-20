import template from './feature-active-branch-page.html?raw';

export class FeatureActiveBranchPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-active-branch-page',
    template,
  } as const;
}
