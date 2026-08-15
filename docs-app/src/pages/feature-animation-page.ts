import template from './feature-animation-page.html?raw';

export class FeatureAnimationPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-animation-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
}
import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
