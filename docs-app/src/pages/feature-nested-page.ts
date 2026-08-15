import template from './feature-nested-page.html?raw';

export class FeatureNestedPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-nested-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
}
import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
