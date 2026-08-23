import { Metadata } from 'next';

import { businessAddressLines, businessProfile } from '@/config/business-profile';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung (DSGVO) für cssberlin.de Nutzer.',
};

const processors = [
  'Hetzner für Hosting und Serverbetrieb',
  'Cloudflare für DNS, CDN, SSL, Caching und Basisschutz',
  'Stripe für Zahlungsabwicklung',
  'UploadThing für Bild-Uploads',
  'Pusher für Realtime-Nachrichten und Order-Updates, sofern aktiviert',
  'Resend für transaktionale E-Mails, sofern aktiviert',
] as const;

export default function DatenschutzPage() {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Datenschutzerklärung
        </h1>
        <p className="mt-4 text-lg italic leading-relaxed text-muted-foreground">
          Zuletzt aktualisiert: 29. Juli 2026
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">1. Einleitung</h2>
        <p className="text-lg leading-relaxed">
          Diese Datenschutzerklärung beschreibt, wie {businessProfile.brandName} personenbezogene Daten bei der
          Nutzung des Marktplatzes verarbeitet. Sie gilt für Besucher, registrierte Nutzer, Verkäufer, Käufer und
          Personen, die mit uns über rechtliche oder operative Anliegen Kontakt aufnehmen.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">2. Verantwortlicher</h2>
        <p className="text-lg leading-relaxed">
          Verantwortlich für die Datenverarbeitung ist:
          <br />
          <strong>{businessProfile.businessName}</strong>
          <br />
          Inhaber: {businessProfile.ownerName}
          <br />
          {businessAddressLines[0]}
          <br />
          {businessAddressLines[1]}
          <br />
          Telefon:{' '}
          <a href={businessProfile.phoneHref} className="text-primary hover:underline">
            {businessProfile.phoneDisplay}
          </a>
          <br />
          E-Mail:{' '}
          <a href={businessProfile.publicEmailHref} className="text-primary hover:underline">
            {businessProfile.publicEmail}
          </a>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">3. Welche Daten wir verarbeiten</h2>
        <div className="space-y-4 text-muted-foreground">
          <p className="text-lg leading-relaxed">
            Kontodaten: E-Mail-Adresse, Benutzername, verschlüsseltes Passwort, Profilangaben und freiwillige
            Einstellungen.
          </p>
          <p className="text-lg leading-relaxed">
            Marktplatzdaten: Produktangaben, Bilder, Preisverhandlungen, Nachrichten, Wunschlisten,
            Benachrichtigungen und Angebotsverläufe.
          </p>
          <p className="text-lg leading-relaxed">
            Bestell- und Zahlungsdaten: Lieferadresse, Versandstatus, Checkout- und Zahlungsreferenzen,
            Order-Timelines, Streitfälle und Rückabwicklungsinformationen.
          </p>
          <p className="text-lg leading-relaxed">
            Technische Daten: Server-Logs, Session-Informationen, Sicherheitsereignisse, IP-Adressen und
            Browser-Metadaten, soweit dies für Betrieb und Schutz der Plattform erforderlich ist.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">4. Zwecke und Rechtsgrundlagen</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Art. 6 Abs. 1 lit. b DSGVO für Registrierung, Angebotserstellung, Verhandlungen, Bestellungen und Support.</li>
          <li>Art. 6 Abs. 1 lit. c DSGVO für gesetzliche Aufbewahrungs- und Meldepflichten.</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO für Missbrauchsprävention, Systemsicherheit, interne Analysen und Betriebsstabilität.</li>
          <li>Art. 6 Abs. 1 lit. a DSGVO, soweit wir Einwilligungen für optionale Kommunikation oder Komfortfunktionen nutzen.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">5. Eingesetzte Dienstleister</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          {processors.map((processor) => (
            <li key={processor}>{processor}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">6. Speicherdauer</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Wir speichern Daten nur so lange, wie sie für den Marktplatzbetrieb, die Vertragsabwicklung, die
          Betrugsprävention, die Durchsetzung oder Abwehr von Ansprüchen sowie für gesetzliche Pflichten benötigt
          werden. Gesetzliche Aufbewahrungsfristen, insbesondere im Steuer- und Handelsrecht, bleiben unberührt.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">7. Ihre Rechte</h2>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Auskunft über die zu Ihrer Person gespeicherten Daten gemäß Art. 15 DSGVO</li>
          <li>Berichtigung unrichtiger oder unvollständiger Daten gemäß Art. 16 DSGVO</li>
          <li>Löschung oder Einschränkung der Verarbeitung gemäß Art. 17 und 18 DSGVO</li>
          <li>Datenübertragbarkeit gemäß Art. 20 DSGVO</li>
          <li>Widerspruch gegen bestimmte Verarbeitungen gemäß Art. 21 DSGVO</li>
          <li>Beschwerde bei einer Datenschutzaufsichtsbehörde</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">8. Cookies und Einwilligung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Beim ersten Besuch fragen wir aktiv ab, welche Cookie-Kategorien du zulässt. Deine Wahl wird lokal in
          deinem Browser gespeichert und kann jederzeit über &bdquo;Cookie-Einstellungen&ldquo; im Footer geändert
          werden.
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li><strong>Notwendig</strong> &ndash; immer aktiv, erforderlich für Login, Sicherheit und den Grundbetrieb der Seite.</li>
          <li><strong>Funktional</strong> &ndash; ermöglicht Echtzeit-Funktionen wie Inbox-Nachrichten und Angebots-Benachrichtigungen.</li>
          <li><strong>Analyse</strong> &ndash; hilft uns zu verstehen, wie cssberlin.de genutzt wird, um die Seite zu verbessern.</li>
          <li><strong>Marketing</strong> &ndash; wird nur mit deiner Einwilligung für personalisierte Angebote verwendet.</li>
        </ul>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Analyse- und Marketing-Cookies werden erst geladen, nachdem du der jeweiligen Kategorie zugestimmt hast.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">9. Sicherheitsmassnahmen</h2>
        <p className="text-lg font-medium leading-relaxed text-muted-foreground">
          Wir nutzen HTTPS, rollen Zugriffsrechte kontrolliert aus und speichern Passwörter nur gehasht. Realtime,
          Checkout, Messaging und Order-Status werden über abgesicherte Serverprozesse gesteuert. Sensible Steuerdaten
          oder interne Verwaltungsdaten werden nicht auf öffentlichen Seiten angezeigt.
        </p>
      </section>
    </div>
  );
}
