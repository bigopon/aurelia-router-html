import template from './url-adapter-app.html?raw';

const usesPathRouting = window.location.search === '' && window.location.hash === '';
const pathPrefix = usesPathRouting ? '/__adapter-test__' : '';

export class UrlAdapterApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'url-adapter-app',
    template,
  } as const;

  public readonly productsPath = `${pathPrefix}/products`;
  public readonly reviewsPath = `${pathPrefix}/reviews`;
}
