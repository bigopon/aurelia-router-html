import template from './feature-swap-page.html?raw';

export class FeatureSwapPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-swap-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
}
import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
