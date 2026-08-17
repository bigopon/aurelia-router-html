import { docNav } from '../data/docs-nav';
import { FeatureAdaptersPage } from './feature-adapters-page';
import { FeatureActiveLinksPage } from './feature-active-links-page';
import { FeatureAnimationPage } from './feature-animation-page';
import { FeatureBasicPage } from './feature-basic-page';
import { FeatureConditionalPage } from './feature-conditional-page';
import { FeatureKitchenSinkPage } from './feature-kitchen-sink-page';
import { FeatureGuardsPage } from './feature-guards-page';
import { FeatureLifecyclePage } from './feature-lifecycle-page';
import { FeatureMatchingPage } from './feature-matching-page';
import { FeatureNestedPage } from './feature-nested-page';
import { FeatureParamsPage } from './feature-params-page';
import { FeatureProgrammaticPage } from './feature-programmatic-page';
import { FeatureRepeatedPage } from './feature-repeated-page';
import { FeatureRedirectsPage } from './feature-redirects-page';
import { FeatureSharedStatePage } from './feature-shared-state-page';
import { FeatureSwapPage } from './feature-swap-page';
import { FeatureTitlesPage } from './feature-titles-page';
import { FeatureUrlStatePage } from './feature-url-state-page';
import { FeatureWildcardPage } from './feature-wildcard-page';
import { OverviewPage } from './overview-page';
import template from './docs-app.html?raw';

export class DocsApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'docs-app',
    template,
    dependencies: [
      OverviewPage,
      FeatureAdaptersPage,
      FeatureBasicPage,
      FeatureNestedPage,
      FeatureParamsPage,
      FeatureUrlStatePage,
      FeatureActiveLinksPage,
      FeatureProgrammaticPage,
      FeatureRedirectsPage,
      FeatureTitlesPage,
      FeatureLifecyclePage,
      FeatureGuardsPage,
      FeatureConditionalPage,
      FeatureRepeatedPage,
      FeatureMatchingPage,
      FeatureWildcardPage,
      FeatureSwapPage,
      FeatureAnimationPage,
      FeatureSharedStatePage,
      FeatureKitchenSinkPage,
    ],
  } as const;

  public readonly nav = docNav;
}
