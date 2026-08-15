import { docNav } from '../data/docs-nav';
import template from './overview-page.html?raw';

export class OverviewPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'overview-page',
    template,
  } as const;

  public readonly nav = docNav.filter(item => item.id !== 'overview');
}
