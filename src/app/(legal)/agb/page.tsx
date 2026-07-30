import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Allgemeine Geschaeftsbedingungen (AGB)',
  description: 'AGB (Nutzungsbedingungen) der cssberlin.de Marktplatz-Plattform.',
};

export default function AGBPage() {
  return (
    <div className="space-y-12 pb-12">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Allgemeine Geschaeftsbedingungen
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Nutzungsbedingungen fuer den Marktplatz <strong>cssberlin.de</strong>
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 1 Geltungsbereich</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Diese Allgemeinen Geschaeftsbedingungen gelten fuer die Nutzung der Plattform <strong>cssberlin.de</strong>
          durch registrierte Nutzer. Der Betreiber stellt die technische Infrastruktur fuer Angebotserstellung,
          Preisverhandlungen, Messaging, Zahlungsanbahnung und Order-Kommunikation bereit und ist grundsaetzlich nicht
          selbst Partei der zwischen Nutzern geschlossenen Kaufvertraege.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 2 Zulassung und Registrierung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Die Registrierung ist natuerlichen Personen ab 18 Jahren gestattet. Pro Nutzer ist nur ein Benutzerkonto
          zulaessig. Mit der Registrierung akzeptiert der Nutzer diese AGB sowie die Datenschutzerklaerung.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 3 Leistungen des Betreibers</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Der Betreiber bietet Nutzern die Moeglichkeit, gebrauchte Waren zu inserieren, Angebote auszuhandeln,
          Nachrichten auszutauschen und Bestellungen inklusive Statushistorie nachzuverfolgen. Es besteht kein Anspruch
          auf eine jederzeit unterbrechungsfreie Verfuegbarkeit der Plattform.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 4 Pflichten der Verkaeufer</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Verkaeufer muessen Artikel wahrheitsgemaess beschreiben, Maengel angeben und duerfen keine gefaelschte
          Markenware, verbotenen Gegenstaende oder rechtswidrige Inhalte anbieten. Verkaeufer sind fuer Lagerbestand,
          Versand und Aktualitaet des Produktstatus verantwortlich.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 5 Transaktionsabwicklung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Ein Kaufvertrag kommt zustande, wenn ein Kaeufer ein Angebot annimmt oder ein Gegenangebot im Rahmen des
          Verhandlungssystems akzeptiert wird. Der Marktplatz dokumentiert Angebotsverlauf, Verfuegbarkeit,
          Bestellstatus, Versandmeldungen und Konfliktfaelle, damit beide Parteien den Vorgang nachvollziehen koennen.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 6 Gebuehren und Kosten</h2>
        <p className="text-lg font-semibold italic leading-relaxed text-muted-foreground">
          Das Einstellen von Artikeln ist fuer private Verkaeufer derzeit kostenlos. Etwaige Zahlungs- oder
          Servicegebuehren werden vor Abschluss der Bestellung transparent angezeigt.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 7 Haftung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Der Betreiber haftet nicht fuer Sachmaengel der angebotenen Waren oder fuer Pflichtverletzungen eines Nutzers.
          Unberuehrt bleibt die Haftung bei Vorsatz, grober Fahrlaessigkeit oder zwingenden gesetzlichen Vorgaben.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 8 DAC7 / PStTG</h2>
        <p className="text-lg italic leading-relaxed text-muted-foreground">
          Verkaeufer werden darauf hingewiesen, dass der Betreiber bei Erreichen der jeweils gueltigen gesetzlichen
          Meldepflichten Daten an das Bundeszentralamt fuer Steuern uebermitteln muss. Die jeweils aktuelle Einordnung
          und die betroffenen Datenfelder werden in der DAC7-Information und in der Datenschutzerklaerung beschrieben.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 9 Schlussbestimmungen</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulaessig, Berlin.
        </p>
      </section>
    </div>
  );
}
