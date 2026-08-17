import template from './url-adapter-app.html?raw';

const browserUrl = new URL(window.location.href);
const usesPathRouting = browserUrl.searchParams.get('mode') === 'path'
  || (!browserUrl.searchParams.has('route') && browserUrl.hash === '');
const pathPrefix = usesPathRouting ? '/__adapter-test__' : '';

export class UrlAdapterApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'url-adapter-app',
    template,
  } as const;

  public readonly productsPath = `${pathPrefix}/products`;
  public readonly reviewsPath = `${pathPrefix}/reviews`;
  public readonly legacyPath = `${pathPrefix}/legacy`;
  public readonly detailsPath = `${pathPrefix}/details`;
  public detailsStatus: string = 'Waiting';

  public async prepareDetails(): Promise<void> {
    this.detailsStatus = 'Preparing anchored content';
    await new Promise(resolve => setTimeout(resolve, 150));
    this.detailsStatus = 'Anchored content ready';
  }
}
