import { resolve } from 'aurelia';
import { IRouteCoordinator } from '../../../router/coordinator';
import { docNav } from '../data/docs-nav';
import { DocsState } from '../state/docs-state';
import { FeatureAnimationPage } from './feature-animation-page';
import { FeatureBasicPage } from './feature-basic-page';
import { FeatureConditionalPage } from './feature-conditional-page';
import { FeatureKitchenSinkPage } from './feature-kitchen-sink-page';
import { FeatureMatchingPage } from './feature-matching-page';
import { FeatureNestedPage } from './feature-nested-page';
import { FeatureParamsPage } from './feature-params-page';
import { FeatureRepeatedPage } from './feature-repeated-page';
import { FeatureSharedStatePage } from './feature-shared-state-page';
import { FeatureSwapPage } from './feature-swap-page';
import { OverviewPage } from './overview-page';
import template from './docs-app.html?raw';

export class DocsApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'docs-app',
    template,
    dependencies: [
      OverviewPage,
      FeatureBasicPage,
      FeatureNestedPage,
      FeatureParamsPage,
      FeatureConditionalPage,
      FeatureRepeatedPage,
      FeatureMatchingPage,
      FeatureSwapPage,
      FeatureAnimationPage,
      FeatureSharedStatePage,
      FeatureKitchenSinkPage,
    ],
  } as const;

  public readonly nav = docNav;
  public readonly state = resolve(DocsState);
  private readonly router = resolve(IRouteCoordinator);
  private disposePath: (() => void) | null = null;

  public binding(): void {
    this.disposePath = this.router.subscribe(path => {
      this.state.setPath(path);
    });
  }

  public unbinding(): void {
    this.disposePath?.();
    this.disposePath = null;
  }

  public isActive(path: string): boolean {
    return this.state.currentPath === path
      || (path !== '/' && this.state.currentPath.startsWith(`${path}/`));
  }
}
