import { docNav } from '../data/docs-nav';
import { FeatureActiveLinksPage } from './feature-active-links-page';
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
import { FeatureUrlStatePage } from './feature-url-state-page';
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
      FeatureUrlStatePage,
      FeatureActiveLinksPage,
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
}
