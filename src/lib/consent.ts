'use client';

/**
 * Real, category-based cookie/consent state — replaces the old binary
 * localStorage['cookie-consent'] flag. Other code should call
 * hasConsent(category) before initializing anything non-essential.
 *
 * Pusher (realtime messaging/offers) is classified as "functional", not
 * "marketing" — blocking it would break the core negotiation/inbox flow.
 */

export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing';

export type ConsentState = Record<ConsentCategory, boolean>;

const STORAGE_KEY = 'css-consent-v1';
export const CONSENT_CHANGED_EVENT = 'css-consent-changed';
export const CONSENT_OPEN_SETTINGS_EVENT = 'css-consent-open-settings';

export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  functional: true,
  analytics: false,
  marketing: false,
};

export function loadConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return { ...DEFAULT_CONSENT, ...parsed, necessary: true };
  } catch {
    return null;
  }
}

export function saveConsent(state: ConsentState): void {
  if (typeof window === 'undefined') return;
  const toSave: ConsentState = { ...state, necessary: true };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: toSave }));
}

export function hasConsent(category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  const state = loadConsent();
  if (!state) return category === 'functional' ? DEFAULT_CONSENT.functional : false;
  return Boolean(state[category]);
}

/** Called from the footer's "Cookie-Einstellungen" link to reopen the banner with the saved choices pre-filled. */
export function openConsentSettings(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_OPEN_SETTINGS_EVENT));
}
