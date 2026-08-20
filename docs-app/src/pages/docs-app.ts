import { docNav } from '../data/docs-nav';
import { ApiCheatSheetPage } from './api-cheat-sheet-page';
import { FeatureAdaptersPage } from './feature-adapters-page';
import { FeatureActiveBranchPage } from './feature-active-branch-page';
import { FeatureActiveLinksPage } from './feature-active-links-page';
import { FeatureAnimationPage } from './feature-animation-page';
import { FeatureBasePathPage } from './feature-base-path-page';
import { FeatureBasicPage } from './feature-basic-page';
import { FeatureConditionalPage } from './feature-conditional-page';
import { FeatureErrorRecoveryPage } from './feature-error-recovery-page';
import { FeatureFocusPage } from './feature-focus-page';
import { FeatureKitchenSinkPage } from './feature-kitchen-sink-page';
import { FeatureGuardFailurePage } from './feature-guard-failure-page';
import { FeatureGuardsPage } from './feature-guards-page';
import { FeatureHashScrollingPage } from './feature-hash-scrolling-page';
import { FeatureLifecyclePage } from './feature-lifecycle-page';
import { FeatureMatchingPage } from './feature-matching-page';
import { FeatureGroupsPage } from './feature-groups-page';
import { FeatureNestedPage } from './feature-nested-page';
import { FeatureNestedRouterPage } from './feature-nested-router-page';
import { FeatureParamsPage } from './feature-params-page';
import { FeatureProgrammaticPage } from './feature-programmatic-page';
import { FeatureRelativeTargetsPage } from './feature-relative-targets-page';
import { FeatureRepeatedPage } from './feature-repeated-page';
import { FeatureSegmentConstraintsPage } from './feature-segment-constraints-page';
import { FeatureRedirectsPage } from './feature-redirects-page';
import { FeatureSharedStatePage } from './feature-shared-state-page';
import { FeatureSwapPage } from './feature-swap-page';
import { FeatureTransitionEndPage } from './feature-transition-end-page';
import { FeatureTitlesPage } from './feature-titles-page';
import { FeatureUrlStatePage } from './feature-url-state-page';
import { FeatureWildcardPage } from './feature-wildcard-page';
import { OverviewPage } from './overview-page';
import { WhyRouterHtmlPage } from './why-router-html-page';
import { PrivacyPage } from './privacy-page';
import { enableAnalytics, getAnalyticsConsent, saveAnalyticsConsent, type AnalyticsConsent } from '../analytics';
import template from './docs-app.html?raw';

type Theme = 'light' | 'dark';
const themeKey = 'router-html-theme';

export class DocsApp {
  public static readonly $au = {
    type: 'custom-element',
    name: 'docs-app',
    template,
    dependencies: [
      OverviewPage,
      WhyRouterHtmlPage,
      PrivacyPage,
      ApiCheatSheetPage,
      FeatureAdaptersPage,
      FeatureActiveBranchPage,
      FeatureBasePathPage,
      FeatureBasicPage,
      FeatureNestedPage,
      FeatureNestedRouterPage,
      FeatureGroupsPage,
      FeatureParamsPage,
      FeatureSegmentConstraintsPage,
      FeatureUrlStatePage,
      FeatureHashScrollingPage,
      FeatureFocusPage,
      FeatureActiveLinksPage,
      FeatureRelativeTargetsPage,
      FeatureProgrammaticPage,
      FeatureRedirectsPage,
      FeatureTitlesPage,
      FeatureLifecyclePage,
      FeatureGuardsPage,
      FeatureGuardFailurePage,
      FeatureErrorRecoveryPage,
      FeatureConditionalPage,
      FeatureRepeatedPage,
      FeatureMatchingPage,
      FeatureWildcardPage,
      FeatureSwapPage,
      FeatureTransitionEndPage,
      FeatureAnimationPage,
      FeatureSharedStatePage,
      FeatureKitchenSinkPage,
    ],
  } as const;

  public readonly nav = docNav;
  public mobileMenuOpen: boolean = false;
  public scrolled: boolean = false;
  public theme: Theme = getTheme();
  public analyticsConsent: AnalyticsConsent = getAnalyticsConsent();
  private readonly onPrivacyChoices = () => this.showPrivacyChoices();
  private readonly onScroll = () => {
    this.scrolled = window.scrollY > 8;
  };
  private navObserver: MutationObserver | null = null;

  public constructor() {
    this.applyTheme();
    window.addEventListener('router-html:show-privacy-choices', this.onPrivacyChoices);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    this.onScroll();
    if (this.analyticsConsent === 'accepted') {
      enableAnalytics();
    }
  }

  public unbinding(): void {
    this.navObserver?.disconnect();
    this.navObserver = null;
    window.removeEventListener('router-html:show-privacy-choices', this.onPrivacyChoices);
    window.removeEventListener('scroll', this.onScroll);
  }

  public attached(): void {
    const navigation = document.getElementById('docs-navigation');
    if (navigation == null) return;

    this.navObserver = new MutationObserver(() => this.revealActiveNavItem());
    this.navObserver.observe(navigation, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current'],
    });
    this.revealActiveNavItem();
  }

  public toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  public closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  public toggleTheme(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme();
    try {
      window.localStorage.setItem(themeKey, this.theme);
    } catch {
      // The selected theme remains active for this visit when storage is unavailable.
    }
  }

  public acceptAnalytics(): void {
    this.analyticsConsent = 'accepted';
    saveAnalyticsConsent(this.analyticsConsent);
    enableAnalytics();
  }

  public rejectAnalytics(): void {
    this.analyticsConsent = 'rejected';
    saveAnalyticsConsent(this.analyticsConsent);
  }

  public showPrivacyChoices(): void {
    this.analyticsConsent = null;
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.theme;
  }

  private revealActiveNavItem(): void {
    const activeItem = document.querySelector<HTMLElement>('#docs-navigation .nav-item[aria-current="page"]');
    if (typeof activeItem?.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
}

function getTheme(): Theme {
  try {
    return window.localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
