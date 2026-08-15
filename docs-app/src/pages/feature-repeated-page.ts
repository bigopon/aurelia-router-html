import { resolve } from 'aurelia';
import { IRouteCoordinator } from '../../../router/coordinator';
import { DocsState } from '../state/docs-state';
import template from './feature-repeated-page.html?raw';

export class FeatureRepeatedPage {
  public static readonly $au = {
    type: 'custom-element',
    name: 'feature-repeated-page',
    template,
  } as const;

  public readonly state = resolve(DocsState);
  private readonly router = resolve(IRouteCoordinator);
  private disposePath: (() => void) | null = null;
  public selectedGeneratedRouteId: string | null = null;

  public binding(): void {
    this.disposePath = this.router.subscribe(path => {
      const prefix = '/features/repeated/demo/';
      this.selectedGeneratedRouteId = path.startsWith(prefix)
        ? path.slice(prefix.length).split('/')[0] || null
        : null;
    });
  }

  public unbinding(): void {
    this.disposePath?.();
    this.disposePath = null;
  }

  public addRoute(): void {
    const id = this.state.addRepeatedRoute();
    this.router.load(`/features/repeated/demo/${id}`);
  }

  public removeRoute(): void {
    this.state.clearRepeatedRoutes();
    this.router.load('/features/repeated/demo/list');
  }
}
