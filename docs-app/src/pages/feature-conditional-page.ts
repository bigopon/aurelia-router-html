import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
import template from './feature-conditional-page.html?raw';

export class FeatureConditionalPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-conditional-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
}
