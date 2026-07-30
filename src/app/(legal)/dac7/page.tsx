import { Metadata } from 'next';
import { HelpCircle, Info, Mail, ShieldCheck } from 'lucide-react';

import { businessProfile } from '@/config/business-profile';

export const metadata: Metadata = {
  title: 'DAC7 & PStTG - Information fuer Verkaeufer',
  description: 'Wichtige Informationen zu Meldepflichten fuer Verkaeufer auf cssberlin.de.',
};

const reportedDataFields = [
  'Vor- und Nachname',
  'Anschrift',
  'Geburtsdatum',
  'Steuerliche Identifikationsdaten, soweit gesetzlich erforderlich',
  'Bankverbindung, soweit gesetzlich erforderlich',
  'Verkaufsumsatz, Gebuehren und relevante Orderdaten',
] as const;

export default function DAC7Page() {
  return (
    <div className="space-y-12 pb-16">
      <header className="space-y-4">
        <h1
          className="bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          DAC7 & PStTG Guide
        </h1>
        <p className="text-xl leading-relaxed text-muted-foreground">
          Was private und gewerbliche Verkaeufer ueber moegliche Meldepflichten wissen sollten.
        </p>
      </header>

      <div className="rounded-3xl border border-blue-100 bg-blue-50/50 p-8 dark:border-blue-800 dark:bg-blue-900/10">
        <div className="flex gap-5">
          <Info size={32} className="shrink-0 text-blue-500" />
          <div className="space-y-3">
            <h3 className="text-lg font-bold italic text-blue-900 dark:text-blue-100">
              Second-Hand wird durch DAC7 nicht automatisch steuerpflichtig.
            </h3>
            <p className="text-sm leading-relaxed text-blue-800/80 dark:text-blue-200/80">
              Das Plattform-Steuertransparenzgesetz schafft Transparenz gegenueber dem Bundeszentralamt fuer Steuern.
              Ob ein Verkauf steuerlich relevant ist, haengt weiterhin von der persoenlichen Situation, der Art der
              Taetigkeit und den jeweils geltenden gesetzlichen Regeln ab.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="border-b pb-2 text-2xl font-bold">Wann kann eine Meldung relevant werden?</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          cssberlin.de muss Daten nur dann an das Bundeszentralamt fuer Steuern uebermitteln, wenn die jeweils
          geltenden gesetzlichen Voraussetzungen nach PStTG / DAC7 erreicht werden. Da sich Formulierungen,
          Ausnahmen und Schwellenwerte aendern koennen, arbeiten wir auf der Plattform bewusst mit dem Begriff
          <strong> gesetzliche Meldepflichten</strong> statt mit hart codierten Zahlen aus aelteren Texten.
        </p>
      </section>

      <section className="space-y-6">
        <h2 className="border-b pb-2 text-2xl font-bold">Welche Daten koennen betroffen sein?</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Wenn fuer einen Nutzer eine gesetzliche Meldung erforderlich wird, koennen je nach Sachverhalt insbesondere
          folgende Daten verarbeitet oder uebermittelt werden:
        </p>
        <ul className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
          {reportedDataFields.map((field) => (
            <li key={field} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
              <ShieldCheck size={16} className="text-primary" /> {field}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="border-b pb-2 text-2xl font-bold">Wie wir damit umgehen</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Wir versuchen betroffene Verkaeufer fruehzeitig darauf hinzuweisen, wenn aus Plattformsicht eine Meldung oder
          eine zusaetzliche Datenergaenzung relevant werden kann. Fuer verbindliche steuerliche Einordnungen solltest du
          jedoch immer einen Steuerberater oder direkt das Finanzamt hinzuziehen.
        </p>
      </section>

      <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary/5 p-8">
        <div className="mb-2 flex items-center gap-3 text-primary">
          <HelpCircle size={24} />
          <h3 className="text-xl font-bold italic">Fragen zu Meldungen oder Trust-Daten?</h3>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Melde dich bei Unsicherheiten zum Plattformkonto, zu angefragten Verkaeuferdaten oder zu rechtlichen
          Kontaktpunkten direkt bei uns. Fuer individuelle Steuerberatung duerfen und koennen wir keine verbindliche
          Beratung leisten.
        </p>
        <div className="pt-4">
          <a href={businessProfile.publicEmailHref} className="inline-flex items-center gap-2 font-bold transition-colors hover:text-primary">
            <Mail size={16} /> {businessProfile.publicEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
