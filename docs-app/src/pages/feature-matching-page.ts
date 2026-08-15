import template from './feature-matching-page.html?raw';

export class FeatureMatchingPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-matching-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
}
import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
