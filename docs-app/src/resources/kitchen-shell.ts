import template from './kitchen-shell.html?raw';

export class KitchenShell {
  public static readonly $au = {
    type: 'custom-element',
    name: 'kitchen-shell',
    template,
    bindables: ['title'],
  } as const;

  public title: string = '';
}
