import {
  buyerProtection,
  cancellationPolicy,
  completionPolicy,
  offerPolicy,
  pickupPolicy,
  policyFacts,
  shippingDeadlines,
} from '@/config/marketplace-policy';
import { FREE_SHIPPING_THRESHOLD_EUR, FIRST_ORDER_FREE_SHIPPING_MIN_EUR, DEFAULT_SHIPPING_FEE_EUR } from '@/config/shipping-policy';
import { businessProfile } from '@/config/business-profile';

/**
 * Hilfe-Center — EINE Quelle für /hilfe, /hilfe/[slug], die FAQ, die Footer-Links
 * und das Wissen des KI-Assistenten. Alle Zahlen kommen aus src/config/*, damit
 * Hilfetext, Code und Assistent nie Verschiedenes behaupten.
 *
 * Inhalt: eigene Formulierungen, inspiriert von den Abläufen bei Vinted, eBay
 * und Kleinanzeigen - an unsere tatsächlichen Regeln angepasst.
 */

export type HelpCategory = 'start' | 'kaufen' | 'verkaufen' | 'zahlung' | 'probleme' | 'sicherheit' | 'konto';

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategory;
  sections: Array<{ heading: string; paragraphs: string[]; list?: string[] }>;
  related?: string[];
};

export type FaqItem = { q: string; a: string; slug?: string; category: HelpCategory };

export const HELP_CATEGORIES: Array<{ id: HelpCategory; label: string; description: string }> = [
  { id: 'start', label: 'Erste Schritte', description: 'So funktioniert cssberlin.de' },
  { id: 'kaufen', label: 'Kaufen', description: 'Suchen, verhandeln, kaufen, abholen' },
  { id: 'verkaufen', label: 'Verkaufen', description: 'Inserieren, Preise, Versand' },
  { id: 'zahlung', label: 'Zahlung & Versand', description: 'Zahlungsarten, Gebühren, Versand' },
  { id: 'probleme', label: 'Stornierung & Probleme', description: 'Stornieren, Rückgabe, Käuferschutz' },
  { id: 'sicherheit', label: 'Sicherheit', description: 'Betrug erkennen, Regeln, Melden' },
  { id: 'konto', label: 'Konto & Daten', description: 'Profil, Benachrichtigungen, Datenschutz' },
];

const pct = Math.round(buyerProtection.rate * 100);
const fee = buyerProtection.fixedEur.toFixed(2).replace('.', ',');
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'so-funktionierts',
    title: 'So funktioniert cssberlin.de',
    summary: 'Second-Hand kaufen und verkaufen in drei Schritten - sicher, lokal und nachhaltig.',
    category: 'start',
    sections: [
      {
        heading: 'Kaufen',
        paragraphs: ['Finde einen Artikel im Katalog, stell Fragen im Chat oder mach einen Preisvorschlag. Dann kaufst du mit Versand oder holst den Artikel persönlich ab.'],
        list: [
          'Suchen & filtern: nach Marke, Größe, Zustand, Preis und Umkreis.',
          'Verhandeln: Preisvorschlag ab ' + policyFacts.offerMin + ', Antwort innerhalb von ' + policyFacts.offerAnswer + '.',
          'Kaufen: Abholung & Barzahlung oder - sobald freigeschaltet - Online-Zahlung mit Käuferschutz.',
        ],
      },
      {
        heading: 'Verkaufen',
        paragraphs: ['Fotografiere deinen Artikel, beschreibe ihn ehrlich und leg einen Preis fest. Interessenten schreiben dir oder kaufen direkt.'],
        list: [
          'Inserieren ist für private Verkäufer kostenlos.',
          'Du entscheidest über Preisvorschläge - nichts wird automatisch in deinem Namen beantwortet.',
          `Verkauft: versende innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen oder übergib den Artikel bei Abholung.`,
        ],
      },
      {
        heading: 'Warum cssberlin.de?',
        paragraphs: ['Jeder Second-Hand-Kauf spart Ressourcen. Wir zeigen dir, wie viel CO₂ du mit deinen Käufen eingespart hast, und halten die Regeln einfach und transparent - mit klaren Fristen statt Kleingedrucktem.'],
      },
    ],
    related: ['kaufen', 'verkaufen', 'bezahlen'],
  },
  {
    slug: 'kaufen',
    title: 'Einen Artikel kaufen',
    summary: 'Vom Fund bis zur Übergabe: so läuft ein Kauf ab.',
    category: 'kaufen',
    sections: [
      {
        heading: 'Vor dem Kauf',
        paragraphs: ['Schau dir alle Fotos an, lies die Beschreibung und prüfe Größe und Zustand. Unklar? Frag den Verkäufer über „Nachricht“ - so bleibt alles dokumentiert.'],
      },
      {
        heading: 'Warenkorb',
        paragraphs: ['Du kannst Artikel auch ohne Konto in den Warenkorb legen. Nach dem Einloggen wird er mit deinem Konto zusammengeführt und ist auf allen Geräten verfügbar. Jeder Artikel wird einzeln gekauft, weil er von unterschiedlichen Verkäufern kommen kann.'],
      },
      {
        heading: 'Kauf abschließen',
        paragraphs: [
          `Im Checkout wählst du Versand oder Abholung. Beim Online-Kauf ist der Artikel ${policyFacts.reservation} für dich reserviert, während du bezahlst - niemand sonst kann ihn in dieser Zeit kaufen.`,
          'Nach dem Kauf findest du alles unter „Meine Einkäufe“: Status, Sendungsnummer, Chat und die Bestätigung des Empfangs.',
        ],
      },
      {
        heading: 'Nach dem Erhalt',
        paragraphs: [`Passt alles, bestätige den Empfang. Meldest du kein Problem, wird die Bestellung ${policyFacts.autoComplete} automatisch abgeschlossen. Danach könnt ihr euch gegenseitig bewerten.`],
      },
    ],
    related: ['preisvorschlaege', 'abholung', 'kaeuferschutz', 'stornierung'],
  },
  {
    slug: 'preisvorschlaege',
    title: 'Preisvorschläge & Verhandeln',
    summary: 'Wie Angebote, Gegenangebote und Fristen funktionieren.',
    category: 'kaufen',
    sections: [
      {
        heading: 'Die Regeln',
        paragraphs: ['Verhandeln ist fair, wenn beide Seiten wissen, woran sie sind:'],
        list: [
          `Mindestangebot: ${policyFacts.offerMin}. Verkäufer können für sich eine höhere Untergrenze festlegen - dann siehst du sie direkt im Angebotsfenster.`,
          `Antwortfrist: ${policyFacts.offerAnswer}. Ohne Antwort läuft das Angebot ab.`,
          `Höchstens ${policyFacts.offerRounds} pro Verhandlung, danach heißt es annehmen oder ablehnen.`,
          'Pro Artikel kannst du ein offenes Angebot haben, insgesamt bis zu 25 Angebote pro Tag.',
        ],
      },
      {
        heading: 'Wenn das Angebot angenommen wird',
        paragraphs: [`Der Artikel wird ${policyFacts.offerPayment} lang für dich zum vereinbarten Preis reserviert. Schließt du den Kauf in dieser Zeit nicht ab, wird er wieder für alle freigegeben.`],
      },
      {
        heading: 'Tipps für Käufer',
        paragraphs: ['Im Angebotsfenster siehst du eine grobe Einschätzung, wie wahrscheinlich eine Annahme ist. Moderat (10–15 % unter Preis) funktioniert meist am besten, besonders bei frisch eingestellten Artikeln mit vielen Merkern.'],
      },
      {
        heading: 'Tipps für Verkäufer',
        paragraphs: ['Zu jedem Angebot zeigen wir dir eine Empfehlung (annehmen, Gegenangebot oder ablehnen) mit Begründung - z. B. wie lange der Artikel schon online ist und wofür ähnliche Artikel verkauft wurden. Die Entscheidung triffst immer du.'],
      },
    ],
    related: ['kaufen', 'verkaufen'],
  },
  {
    slug: 'verkaufen',
    title: 'Verkaufen: Inserieren, Preis, Versand',
    summary: 'Gute Fotos, ehrliche Beschreibung, fairer Preis - so verkaufst du schneller.',
    category: 'verkaufen',
    sections: [
      {
        heading: 'Gute Fotos',
        list: [
          'Tageslicht, ruhiger Hintergrund, der ganze Artikel im Bild.',
          'Details zeigen: Etikett, Größe, Material, Gebrauchsspuren.',
          'Nur eigene Fotos verwenden - fremde Bilder sind verboten und werden entfernt.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Beschreibung & Zustand',
        paragraphs: ['Beschreibe Mängel ehrlich. Ein korrekt angegebener Zustand verhindert Streitfälle und bringt bessere Bewertungen.'],
      },
      {
        heading: 'Den richtigen Preis finden',
        paragraphs: ['Schau, wofür ähnliche Artikel angeboten werden. Unsere Preisvorschlag-Hilfe beim Inserieren gibt dir einen Startwert. Ein etwas höherer Preis lässt Raum für Verhandlungen.'],
      },
      {
        heading: 'Nach dem Verkauf',
        list: [
          `Versand: Verpacke den Artikel sicher und trage die Sendungsnummer ein - spätestens innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen, sonst wird die Bestellung storniert. Wir erinnern dich nach ${shippingDeadlines.remindAfterHours.join(' und ')} Stunden.`,
          `Abholung: Vereinbart Ort und Zeit im Chat. Nach der Übergabe bestätigst du „Übergeben & bezahlt“. Ohne Bestätigung endet die Reservierung nach ${policyFacts.pickupHold}.`,
          'Paketrabatt: Unter Einstellungen kannst du Rabatte für Käufer festlegen, die mehrere Artikel von dir nehmen.',
        ],
        paragraphs: [],
      },
    ],
    related: ['versand', 'abholung', 'preisvorschlaege'],
  },
  {
    slug: 'bezahlen',
    title: 'Zahlungsarten & Gebühren',
    summary: 'Welche Zahlungsarten es gibt, was der Käuferschutz kostet und was gerade verfügbar ist.',
    category: 'zahlung',
    sections: [
      {
        heading: 'Zahlungsarten',
        list: [
          'Abholung & Barzahlung - verfügbar. Du zahlst bei der Übergabe direkt an den Verkäufer.',
          'Kredit-/Debitkarte, Klarna und SEPA-Lastschrift - werden gerade eingerichtet. Im Checkout siehst du immer, was aktuell freigeschaltet ist.',
          'PayPal - geplant.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Gebühren',
        paragraphs: [
          `Für Online-Käufe fällt der Käuferschutz an: ${pct} % des Artikelpreises + ${fee} €. Er wird im Checkout getrennt ausgewiesen.`,
          'Bei Abholung mit Barzahlung fallen keine Plattformgebühren an.',
          'Für Verkäufer ist das Inserieren kostenlos.',
        ],
      },
      {
        heading: 'Sicherheit der Zahlung',
        paragraphs: ['Online-Zahlungen laufen über einen zertifizierten Zahlungsdienstleister. Wir sehen und speichern keine Kartendaten. Zahle nie per Überweisung „an Freunde“ oder außerhalb der Plattform, wenn du Käuferschutz möchtest.'],
      },
    ],
    related: ['kaeuferschutz', 'abholung', 'versand'],
  },
  {
    slug: 'abholung',
    title: 'Abholung & Barzahlung',
    summary: 'Lokal kaufen ohne Versand: so läuft die Übergabe.',
    category: 'kaufen',
    sections: [
      {
        heading: 'So geht’s',
        list: [
          `Im Checkout „Selbstabholung“ wählen - der Artikel ist dann ${policyFacts.pickupHold} für dich reserviert.`,
          'Im Chat Ort und Zeit vereinbaren. Der Verkäufer teilt die genaue Adresse dort mit; öffentlich zeigen wir nur PLZ und Ort.',
          'Artikel vor Ort prüfen, bar bezahlen.',
          'Der Verkäufer bestätigt „Übergeben & bezahlt“ - damit ist der Kauf abgeschlossen.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Gut zu wissen',
        list: [
          'Bei Abholung gilt kein Käuferschutz - prüfe den Artikel deshalb vor dem Bezahlen.',
          'Beide Seiten können vor der Übergabe stornieren (z. B. wenn ihr keinen Termin findet).',
          'Treffpunkt am besten öffentlich und tagsüber.',
        ],
        paragraphs: [],
      },
    ],
    related: ['sicherheit', 'stornierung'],
  },
  {
    slug: 'versand',
    title: 'Versand & Versandkosten',
    summary: 'Versandarten, Kosten, Fristen und Sendungsverfolgung.',
    category: 'zahlung',
    sections: [
      {
        heading: 'Versandarten',
        paragraphs: ['Verkäufer versenden mit DHL, Hermes, DPD oder GLS und tragen die Sendungsnummer ein. Du verfolgst die Sendung direkt aus deiner Bestellung.'],
      },
      {
        heading: 'Versandkosten',
        list: [
          `Ab ${FREE_SHIPPING_THRESHOLD_EUR} € Warenwert ist der Versand kostenlos.`,
          `Erste Bestellung: kostenloser Versand ab ${FIRST_ORDER_FREE_SHIPPING_MIN_EUR} € Warenwert.`,
          `Sonst gilt der vom Verkäufer hinterlegte Versandpreis, ohne Angabe ${eur(DEFAULT_SHIPPING_FEE_EUR)}.`,
          'Die Versandkosten stehen vor dem Bezahlen im Checkout.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Fristen',
        paragraphs: [`Der Verkäufer hat ${shippingDeadlines.autoCancelAfterDays} Tage Zeit zu versenden. Danach wird die Bestellung automatisch storniert und der Betrag erstattet.`],
      },
    ],
    related: ['bezahlen', 'stornierung', 'kaeuferschutz'],
  },
  {
    slug: 'kaeuferschutz',
    title: 'Käuferschutz',
    summary: 'Was der Käuferschutz abdeckt und wie du ein Problem meldest.',
    category: 'probleme',
    sections: [
      {
        heading: 'Was abgedeckt ist',
        paragraphs: ['Der Käuferschutz gilt für Online-Käufe mit Versand. Dein Geld wird erst nach Abschluss der Bestellung an den Verkäufer ausgezahlt. Abgedeckt sind:'],
        list: ['Artikel kommt nicht an.', 'Artikel ist erheblich anders als beschrieben (z. B. falsche Größe, verschwiegene Mängel).', 'Artikel ist beschädigt angekommen.'],
      },
      {
        heading: 'Problem melden',
        paragraphs: [
          `Öffne die Bestellung unter „Meine Einkäufe“ und tippe auf „Problem melden“ - möglich, bis die Bestellung abgeschlossen ist (automatisch ${policyFacts.autoComplete}). Beschreibe das Problem und füge Fotos im Chat hinzu.`,
          'Bis zur Entscheidung wird nichts ausgezahlt. Unser Team prüft den Fall und entscheidet über Erstattung oder Abschluss; beide Seiten werden benachrichtigt.',
        ],
      },
      {
        heading: 'Nicht abgedeckt',
        list: ['Abholung mit Barzahlung.', 'Zahlungen außerhalb der Plattform.', 'Geschmack oder Passform, wenn der Artikel wie beschrieben ist.'],
        paragraphs: [],
      },
      {
        heading: 'Kosten',
        paragraphs: [`${pct} % des Artikelpreises + ${fee} € pro Online-Kauf, im Checkout ausgewiesen.`],
      },
    ],
    related: ['rueckgabe-und-probleme', 'stornierung'],
  },
  {
    slug: 'stornierung',
    title: 'Einen Kauf stornieren',
    summary: 'Wann du sofort stornieren kannst, wann du anfragen musst und was nach dem Versand gilt.',
    category: 'probleme',
    sections: [
      {
        heading: 'Als Käufer',
        list: [
          `In den ersten ${policyFacts.buyerFreeCancel} nach dem Kauf: sofort und kostenlos stornieren, solange noch nicht versendet wurde. Der Betrag wird vollständig erstattet.`,
          `Danach (noch nicht versendet): „Stornierung anfragen“ mit Grund. Der Verkäufer hat ${policyFacts.cancelRequestAnswer} Zeit, anzunehmen oder abzulehnen. Versendet er, gilt die Anfrage als abgelehnt.`,
          'Nach dem Versand ist keine Stornierung mehr möglich. Kommt der Artikel nicht oder anders als beschrieben an, nutze „Problem melden“ (Käuferschutz).',
          'Abholung: Du kannst jederzeit vor der Übergabe stornieren.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Als Verkäufer',
        list: [
          'Du kannst vor dem Versand bzw. vor der Übergabe mit Angabe eines Grundes stornieren. Der Käufer erhält den vollen Betrag zurück.',
          'Stornierungen aus Gründen auf deiner Seite (z. B. „bereits anderweitig verkauft“) fließen in deine Stornoquote ein, die Käufer in deinem Profil sehen. Storniert der Käufer selbst oder bittet darum, zählt das nicht gegen dich.',
          `Versendest du nicht innerhalb von ${policyFacts.shipWithin}, storniert das System automatisch.`,
        ],
        paragraphs: [],
      },
      {
        heading: 'Automatische Stornierung',
        list: [
          `Nicht versendet innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen nach Zahlung → storniert + erstattet.`,
          `Abholung nicht innerhalb von ${pickupPolicy.holdHours} Stunden bestätigt → Reservierung endet, der Artikel ist wieder im Verkauf.`,
        ],
        paragraphs: ['In allen Fällen informieren wir beide Seiten per Benachrichtigung und E-Mail.'],
      },
    ],
    related: ['kaeuferschutz', 'rueckgabe-und-probleme'],
  },
  {
    slug: 'rueckgabe-und-probleme',
    title: 'Rückgabe & Probleme mit einer Bestellung',
    summary: 'Was du tun kannst, wenn etwas nicht stimmt.',
    category: 'probleme',
    sections: [
      {
        heading: 'Zuerst: mit dem Verkäufer sprechen',
        paragraphs: ['Viele Probleme lassen sich im Chat lösen - etwa eine vergessene Sendungsnummer. Bleib freundlich und sachlich, schicke Fotos.'],
      },
      {
        heading: 'Käuferschutz-Fall',
        paragraphs: [`Klappt keine Einigung, melde das Problem in der Bestellung, bevor sie abgeschlossen wird (automatisch ${policyFacts.autoComplete}). Wir prüfen und entscheiden. Wird erstattet, sendest du den Artikel zurück und der Betrag geht an dich zurück.`],
      },
      {
        heading: 'Privatverkauf',
        paragraphs: ['Bei Käufen von Privatpersonen gilt kein gesetzliches Widerrufsrecht. Der Käuferschutz von cssberlin.de hilft trotzdem, wenn ein Artikel nicht ankommt oder nicht der Beschreibung entspricht. Details stehen in den AGB und der Widerrufsbelehrung.'],
      },
    ],
    related: ['kaeuferschutz', 'stornierung'],
  },
  {
    slug: 'bewertungen',
    title: 'Bewertungen',
    summary: 'Wie Käufer und Verkäufer sich gegenseitig bewerten.',
    category: 'konto',
    sections: [
      {
        heading: 'Gegenseitig bewerten',
        paragraphs: ['Nach einer abgeschlossenen Bestellung können Käufer und Verkäufer einander bewerten (1–5 Sterne und Kommentar). Wir erinnern beide Seiten daran. Jede Seite kann pro Bestellung einmal bewerten.'],
      },
      {
        heading: 'Fair bleiben',
        paragraphs: ['Bewerte die Transaktion, nicht die Person. Beleidigungen oder erpresserische Bewertungen („gute Bewertung nur gegen Rabatt“) sind verboten und können gemeldet werden.'],
      },
    ],
    related: ['sicherheit'],
  },
  {
    slug: 'sicherheit',
    title: 'Sicher handeln & Betrug erkennen',
    summary: 'Typische Maschen und wie du dich schützt.',
    category: 'sicherheit',
    sections: [
      {
        heading: 'Warnsignale',
        list: [
          'Jemand will außerhalb der Plattform bezahlen oder schreiben (WhatsApp, E-Mail, Überweisung „an Freunde“).',
          'Links zu angeblichen Zahlungs- oder Versandseiten - wir schicken dir nie Links, über die du Kartendaten eingeben sollst.',
          'Druck („nur heute“, „sonst kauft ein anderer“) oder Preise, die zu gut sind, um wahr zu sein.',
          'Bitte um Codes, Passwörter oder Ausweisfotos.',
        ],
        paragraphs: [],
      },
      {
        heading: 'So schützt du dich',
        list: [
          'Bleib im Chat von cssberlin.de - dort ist alles dokumentiert.',
          'Kaufe online nur über den Checkout, dann gilt der Käuferschutz.',
          'Bei Abholung: öffentlicher Treffpunkt, Ware vor dem Bezahlen prüfen.',
          'Verdächtige Nutzer oder Artikel über „Melden“ an uns weitergeben.',
        ],
        paragraphs: [],
      },
    ],
    related: ['verbotene-artikel', 'melden'],
  },
  {
    slug: 'verbotene-artikel',
    title: 'Verbotene Artikel & Inseratsregeln',
    summary: 'Was auf cssberlin.de nicht verkauft werden darf.',
    category: 'sicherheit',
    sections: [
      {
        heading: 'Nicht erlaubt',
        list: [
          'Fälschungen und Replikate von Markenartikeln.',
          'Waffen, Munition, Drogen, Medikamente, Tabak und E-Zigaretten.',
          'Gebrauchte Unterwäsche und Hygieneartikel, Kosmetik nach Anbruch.',
          'Tiere und Tierprodukte geschützter Arten (z. B. echtes Elfenbein, Pelz geschützter Arten).',
          'Gestohlene Ware, Ausweise, Gutscheine und digitale Zugänge.',
          'Fremde Fotos oder Fotos, auf denen andere Personen erkennbar sind, ohne deren Einverständnis.',
        ],
        paragraphs: [],
      },
      {
        heading: 'Regeln für Inserate',
        list: ['Ein Inserat = ein Artikel.', 'Ehrliche Zustandsangabe.', 'Keine Kontaktdaten oder Links im Inserat.', 'Keine irreführenden Marken- oder Größenangaben.'],
        paragraphs: ['Verstöße entfernen wir; bei wiederholten Verstößen wird das Konto gesperrt.'],
      },
    ],
    related: ['melden', 'sicherheit'],
  },
  {
    slug: 'konto-und-daten',
    title: 'Konto, Benachrichtigungen & Datenschutz',
    summary: 'Profil, Standort, Benachrichtigungen und deine Daten.',
    category: 'konto',
    sections: [
      {
        heading: 'Profil & Standort',
        paragraphs: ['Unter Einstellungen pflegst du Name, Profilbild, Beschreibung und deinen Standort. Öffentlich zeigen wir nur Postleitzahl und Ort - auf der Karte als ungefähren Bereich, nie deine Adresse.'],
      },
      {
        heading: 'Benachrichtigungen',
        paragraphs: ['Du entscheidest, worüber wir dich in der App und per E-Mail informieren (Angebote, Nachrichten, Favoriten, Follower, gespeicherte Suchen). Nachrichten zu Käufen, Verkäufen und Fristen sind Teil des Vertrags und lassen sich nicht abschalten.'],
      },
      {
        heading: 'Gespeicherte Suchen',
        paragraphs: ['Speichere eine Suche im Katalog - wir melden uns höchstens einmal täglich, wenn neue passende Artikel eingestellt wurden.'],
      },
      {
        heading: 'Deine Daten',
        paragraphs: [`Wie wir Daten verarbeiten, steht in der Datenschutzerklärung. Für Auskunft oder Löschung schreib an ${businessProfile.publicEmail}.`],
      },
    ],
    related: ['sicherheit'],
  },
  {
    slug: 'melden',
    title: 'Inhalte & Nutzer melden',
    summary: 'Rechtswidrige Inhalte, Betrug oder Regelverstöße melden (Digital Services Act).',
    category: 'sicherheit',
    sections: [
      {
        heading: 'Was du melden kannst',
        list: ['Fälschungen oder verbotene Artikel.', 'Betrugsversuche und Belästigung.', 'Rechtsverletzungen (z. B. Urheberrecht an Fotos, Markenrecht).'],
        paragraphs: [],
      },
      {
        heading: 'So läuft es ab',
        paragraphs: ['Über das Meldeformular schickst du uns den Link und eine kurze Begründung. Wir bestätigen den Eingang, prüfen die Meldung zeitnah und informieren dich über das Ergebnis. Betroffene Nutzer erfahren, warum ein Inhalt entfernt wurde, und können widersprechen.'],
      },
    ],
    related: ['sicherheit', 'verbotene-artikel'],
  },
];

export const FAQ: FaqItem[] = [
  { category: 'start', q: 'Ist cssberlin.de kostenlos?', a: 'Inserieren ist für private Verkäufer kostenlos. Käufer zahlen bei Online-Käufen den Käuferschutz (' + policyFacts.buyerProtection + '); bei Abholung mit Barzahlung fallen keine Gebühren an.', slug: 'bezahlen' },
  { category: 'kaufen', q: 'Kann ich ohne Konto einkaufen?', a: 'Stöbern, Favoriten merken und den Warenkorb füllen geht ohne Konto. Für Nachrichten, Preisvorschläge und den Kauf brauchst du ein kostenloses Konto - der Warenkorb wird beim Einloggen übernommen.', slug: 'kaufen' },
  { category: 'kaufen', q: 'Wie funktioniert ein Preisvorschlag?', a: `Auf der Artikelseite „Preis vorschlagen“ wählen. Mindestens ${policyFacts.offerMin}, der Verkäufer hat ${policyFacts.offerAnswer} Zeit zu antworten. Wird angenommen, ist der Artikel ${policyFacts.offerPayment} für dich reserviert.`, slug: 'preisvorschlaege' },
  { category: 'kaufen', q: 'Wie viele Gegenangebote sind möglich?', a: `Höchstens ${policyFacts.offerRounds} pro Verhandlung - danach heißt es annehmen oder ablehnen.`, slug: 'preisvorschlaege' },
  { category: 'kaufen', q: 'Wie funktioniert die Abholung?', a: `„Selbstabholung“ im Checkout wählen, Termin im Chat vereinbaren, bei Übergabe bar zahlen. Der Artikel ist ${policyFacts.pickupHold} für dich reserviert.`, slug: 'abholung' },
  { category: 'zahlung', q: 'Welche Zahlungsarten gibt es?', a: 'Aktuell Abholung & Barzahlung. Karte, Klarna und SEPA-Lastschrift werden gerade eingerichtet, PayPal ist geplant. Im Checkout siehst du immer, was freigeschaltet ist.', slug: 'bezahlen' },
  { category: 'zahlung', q: 'Was kostet der Versand?', a: `Ab ${FREE_SHIPPING_THRESHOLD_EUR} € Warenwert nichts. Bei der ersten Bestellung ab ${FIRST_ORDER_FREE_SHIPPING_MIN_EUR} € ebenfalls nichts. Sonst der Versandpreis des Verkäufers (Standard ${eur(DEFAULT_SHIPPING_FEE_EUR)}).`, slug: 'versand' },
  { category: 'zahlung', q: 'Wann versendet der Verkäufer?', a: `Spätestens innerhalb von ${shippingDeadlines.autoCancelAfterDays} Tagen nach der Zahlung, sonst wird automatisch storniert und erstattet.`, slug: 'versand' },
  { category: 'probleme', q: 'Kann ich einen Kauf stornieren?', a: `Ja: in den ersten ${policyFacts.buyerFreeCancel} sofort, danach per Anfrage beim Verkäufer (Antwort innerhalb von ${policyFacts.cancelRequestAnswer}) - jeweils nur, solange noch nicht versendet wurde. Bei Abholung jederzeit vor der Übergabe.`, slug: 'stornierung' },
  { category: 'probleme', q: 'Was passiert, wenn der Verkäufer storniert?', a: 'Du erhältst den vollen Betrag zurück und wirst per Benachrichtigung und E-Mail informiert. Der Grund wird angezeigt.', slug: 'stornierung' },
  { category: 'probleme', q: 'Kann ich nach dem Versand noch stornieren?', a: 'Nein. Kommt der Artikel nicht oder anders als beschrieben an, melde ein Problem in der Bestellung - dann greift der Käuferschutz.', slug: 'kaeuferschutz' },
  { category: 'probleme', q: 'Mein Artikel ist nicht angekommen - was tun?', a: 'Prüfe die Sendungsverfolgung und schreib dem Verkäufer. Hilft das nicht, „Problem melden“ in der Bestellung, bevor sie automatisch abgeschlossen wird.', slug: 'kaeuferschutz' },
  { category: 'probleme', q: 'Der Artikel entspricht nicht der Beschreibung.', a: 'Fotografiere den Unterschied, schreib dem Verkäufer und melde das Problem in der Bestellung. Unser Team entscheidet über eine Erstattung.', slug: 'rueckgabe-und-probleme' },
  { category: 'probleme', q: 'Wann wird eine Bestellung abgeschlossen?', a: `Wenn du den Empfang bestätigst - oder automatisch ${policyFacts.autoComplete}, wenn kein Problem gemeldet wurde.`, slug: 'kaufen' },
  { category: 'probleme', q: 'Gilt ein Widerrufsrecht?', a: 'Bei Käufen von Privatpersonen gibt es kein gesetzliches Widerrufsrecht. Der Käuferschutz hilft bei Nichterhalt oder erheblicher Abweichung. Details: AGB und Widerrufsbelehrung.', slug: 'rueckgabe-und-probleme' },
  { category: 'verkaufen', q: 'Wie verkaufe ich schneller?', a: 'Helle, eigene Fotos von allen Seiten, ehrliche Zustandsangabe, Marke und Größe angeben und einen Preis mit etwas Verhandlungsspielraum wählen.', slug: 'verkaufen' },
  { category: 'verkaufen', q: 'Kann ich zu niedrige Angebote vermeiden?', a: 'Ja. Unter Einstellungen → Zahlung & Auszahlung legst du eine eigene Untergrenze in Prozent fest. Angebote darunter werden gar nicht erst gesendet.', slug: 'preisvorschlaege' },
  { category: 'verkaufen', q: 'Was ist die Stornoquote?', a: 'Der Anteil deiner Verkäufe, die du aus Gründen auf deiner Seite storniert hast. Käufer sehen sie in deinem Profil - halte sie niedrig, indem du nur verfügbare Artikel anbietest.', slug: 'stornierung' },
  { category: 'sicherheit', q: 'Jemand will per WhatsApp oder Überweisung zahlen.', a: 'Nicht darauf eingehen - das ist eine typische Betrugsmasche, und du verlierst den Käuferschutz. Melde den Nutzer.', slug: 'sicherheit' },
  { category: 'sicherheit', q: 'Wie melde ich einen Artikel oder Nutzer?', a: 'Über das Meldeformular (Footer → Melden) mit Link und Begründung. Wir prüfen jede Meldung.', slug: 'melden' },
  { category: 'konto', q: 'Wer sieht meine Adresse?', a: 'Niemand öffentlich. Wir zeigen nur PLZ und Ort, auf der Karte als ungefähren Bereich. Die Lieferadresse sieht nur der Verkäufer deiner Bestellung.', slug: 'konto-und-daten' },
  { category: 'konto', q: 'Wie stelle ich Benachrichtigungen ein?', a: 'Einstellungen → Benachrichtigungen. Kauf- und Verkaufsnachrichten sind Pflicht, alles andere kannst du für App und E-Mail getrennt steuern.', slug: 'konto-und-daten' },
  { category: 'konto', q: 'Wie lösche ich mein Konto?', a: `Schreib uns an ${businessProfile.publicEmail}. Offene Bestellungen müssen vorher abgeschlossen sein; Rechnungsdaten bewahren wir aus gesetzlichen Gründen auf.`, slug: 'konto-und-daten' },
  { category: 'start', q: 'Spricht im Chat-Fenster ein Mensch?', a: 'Nein, „CSS Assist“ ist ein KI-Assistent. Er hilft bei Fragen zu Regeln und Artikeln, kann aber keine Bestellungen ändern. Für persönliche Hilfe nutze das Kontaktformular.', slug: 'so-funktionierts' },
];

export function getHelpArticle(slug: string) {
  return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
}

/** Compact plain-text knowledge base for the assistant (kept short to stay cheap). */
export function helpKnowledgeText(): string {
  const facts = [
    `Käuferschutz: ${policyFacts.buyerProtection} bei Online-Kauf; nicht bei Abholung.`,
    `Reservierung im Checkout: ${policyFacts.reservation}. Abholung: ${policyFacts.pickupHold} reserviert.`,
    `Preisvorschlag: mind. ${policyFacts.offerMin}, Antwort in ${policyFacts.offerAnswer}, max. ${policyFacts.offerRounds}, angenommen = ${policyFacts.offerPayment} reserviert, 25 Angebote/Tag.`,
    `Versand: innerhalb von ${policyFacts.shipWithin}, sonst Auto-Storno + Erstattung. Gratis ab ${FREE_SHIPPING_THRESHOLD_EUR} €, Erstbestellung ab ${FIRST_ORDER_FREE_SHIPPING_MIN_EUR} €.`,
    `Stornieren: Käufer ${policyFacts.buyerFreeCancel} sofort, danach Anfrage (Verkäufer ${policyFacts.cancelRequestAnswer}); nach Versand nur Problem melden.`,
    `Abschluss: Empfang bestätigen oder automatisch ${policyFacts.autoComplete}. Danach gegenseitige Bewertung.`,
    'Zahlung aktuell: Abholung & Barzahlung. Karte/Klarna/SEPA werden eingerichtet, PayPal geplant.',
    `Kontakt: ${businessProfile.publicEmail}, Formular /kontakt. Hilfe: /hilfe.`,
  ];
  const faq = FAQ.map((f) => `F: ${f.q} A: ${f.a}`).join('\n');
  return `${facts.join('\n')}\n\nFAQ:\n${faq}`;
}

/** Footer link groups (labels -> URLs) live next to the content they point at. */
export const FOOTER_HELP_LINKS = [
  { label: 'Hilfe-Center', href: '/hilfe' },
  { label: 'So funktioniert’s', href: '/hilfe/so-funktionierts' },
  { label: 'Käuferschutz', href: '/hilfe/kaeuferschutz' },
  { label: 'Versand', href: '/hilfe/versand' },
  { label: 'Zahlungsarten', href: '/hilfe/bezahlen' },
  { label: 'Stornierung', href: '/hilfe/stornierung' },
  { label: 'Kontakt', href: '/kontakt' },
];

export { cancellationPolicy, completionPolicy, offerPolicy };
