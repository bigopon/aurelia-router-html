import template from './feature-error-recovery-page.html?raw';

export class FeatureErrorRecoveryPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-error-recovery-page',
    template,
  } as const;
}
