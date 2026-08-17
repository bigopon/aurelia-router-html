import template from './api-cheat-sheet-page.html?raw';

export class ApiCheatSheetPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'api-cheat-sheet-page',
    template,
  } as const;
}
