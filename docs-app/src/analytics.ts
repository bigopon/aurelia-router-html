const measurementId = 'G-ZDNVYEDJGD';
const consentKey = 'router-html-analytics-consent';

export type AnalyticsConsent = 'accepted' | 'rejected' | null;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const consent = window.localStorage.getItem(consentKey);
    return consent === 'accepted' || consent === 'rejected' ? consent : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>): void {
  try {
    window.localStorage.setItem(consentKey, consent);
  } catch {
    // Analytics remains disabled when the browser does not allow storage.
  }
}

export function enableAnalytics(): void {
  if (document.getElementById('google-analytics') != null) return;

  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => window.dataLayer!.push(args);
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.id = 'google-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}
