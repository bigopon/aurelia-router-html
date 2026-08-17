import template from './why-router-html-page.html?raw';

export class WhyRouterHtmlPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'why-router-html-page',
    template,
  } as const;
}
