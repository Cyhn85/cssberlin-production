/**
 * Benachrichtigungs-Kategorien und Standardwerte.
 *
 * `locked` = rechtlich/vertraglich nötige Nachrichten (Kauf, Zahlung, Versand,
 * Streitfall, Sicherheit). Die lassen sich nicht abschalten - wie bei Vinted/eBay
 * gehören sie zum Vertrag, nicht zum Marketing.
 */
export type NotificationCategory =
  | 'orders'
  | 'offers'
  | 'listingActivity'
  | 'messages'
  | 'favorites'
  | 'followers'
  | 'savedSearches';

export type NotificationChannel = 'inApp' | 'email';

export type NotificationPrefs = Partial<Record<NotificationCategory, Partial<Record<NotificationChannel, boolean>>>>;

export const NOTIFICATION_CATEGORIES: Array<{
  id: NotificationCategory;
  label: string;
  description: string;
  locked: boolean;
  defaults: Record<NotificationChannel, boolean>;
}> = [
  {
    id: 'orders',
    label: 'Käufe & Verkäufe',
    description: 'Zahlung, Abholung, Versand, Zustellung, Streitfälle, Erinnerungen an Fristen',
    locked: true,
    defaults: { inApp: true, email: true },
  },
  {
    id: 'offers',
    label: 'Preisvorschläge',
    description: 'Neue Angebote, Gegenangebote, Annahme, Ablehnung, Ablauf',
    locked: false,
    defaults: { inApp: true, email: true },
  },
  {
    id: 'listingActivity',
    label: 'Aktivität bei deinen Artikeln',
    description: 'Jemand hat deinen Artikel gemerkt, neue Bewertungen über dich',
    locked: false,
    defaults: { inApp: true, email: true },
  },
  {
    id: 'messages',
    label: 'Nachrichten',
    description: 'Neue Chat-Nachrichten (E-Mail nur für die erste ungelesene Nachricht)',
    locked: false,
    defaults: { inApp: true, email: true },
  },
  {
    id: 'favorites',
    label: 'Favoriten',
    description: 'Preissenkung oder Verkauf eines gemerkten Artikels',
    locked: false,
    defaults: { inApp: true, email: true },
  },
  {
    id: 'followers',
    label: 'Follower',
    description: 'Jemand folgt dir',
    locked: false,
    defaults: { inApp: true, email: false },
  },
  {
    id: 'savedSearches',
    label: 'Gespeicherte Suchen',
    description: 'Neue Artikel zu deinen gespeicherten Suchen (höchstens einmal täglich)',
    locked: false,
    defaults: { inApp: true, email: true },
  },
];

export function wantsNotification(
  prefs: unknown,
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  const def = NOTIFICATION_CATEGORIES.find((c) => c.id === category);
  if (!def) return true;
  if (def.locked) return true;
  const p = (prefs && typeof prefs === 'object' ? (prefs as NotificationPrefs) : {})[category];
  const v = p?.[channel];
  return typeof v === 'boolean' ? v : def.defaults[channel];
}

/** Cleans user input into a prefs object (unknown keys dropped, locked categories ignored). */
export function sanitizePrefs(input: unknown): NotificationPrefs {
  const out: NotificationPrefs = {};
  if (!input || typeof input !== 'object') return out;
  for (const def of NOTIFICATION_CATEGORIES) {
    if (def.locked) continue;
    const raw = (input as Record<string, any>)[def.id];
    if (!raw || typeof raw !== 'object') continue;
    const entry: Partial<Record<NotificationChannel, boolean>> = {};
    if (typeof raw.inApp === 'boolean') entry.inApp = raw.inApp;
    if (typeof raw.email === 'boolean') entry.email = raw.email;
    out[def.id] = entry;
  }
  return out;
}
