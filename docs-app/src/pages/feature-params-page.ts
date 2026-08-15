import { resolve } from 'aurelia';
import { DocsState } from '../state/docs-state';
import template from './feature-params-page.html?raw';

export class FeatureParamsPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-params-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
  public readonly users = [
    { id: 'mira', role: 'Author' },
    { id: 'dev', role: 'Maintainer' },
    { id: 'ops', role: 'Reviewer' },
  ];
}
