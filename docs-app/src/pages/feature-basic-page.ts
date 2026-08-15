import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
import template from './feature-basic-page.html?raw';

export class FeatureBasicPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-basic-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
}
