import template from './privacy-page.html?raw';

export class PrivacyPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'privacy-page',
    template,
  } as const;

  public showPrivacyChoices(): void {
    window.dispatchEvent(new Event('router-html:show-privacy-choices'));
  }
}
