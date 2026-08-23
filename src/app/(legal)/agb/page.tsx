import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen (AGB)',
  description: 'AGB (Nutzungsbedingungen) der cssberlin.de Marktplatz-Plattform.',
};

export default function AGBPage() {
  return (
    <div className="space-y-12 pb-12">
      <header>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Allgemeine Geschäftsbedingungen
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Nutzungsbedingungen für den Marktplatz <strong>cssberlin.de</strong>
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 1 Geltungsbereich</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform <strong>cssberlin.de</strong>
          durch registrierte Nutzer. Der Betreiber stellt die technische Infrastruktur für Angebotserstellung,
          Preisverhandlungen, Messaging, Zahlungsanbahnung und Order-Kommunikation bereit und ist grundsätzlich nicht
          selbst Partei der zwischen Nutzern geschlossenen Kaufverträge.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 2 Zulassung und Registrierung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Die Registrierung ist natürlichen Personen ab 18 Jahren gestattet. Pro Nutzer ist nur ein Benutzerkonto
          zulässig. Mit der Registrierung akzeptiert der Nutzer diese AGB sowie die Datenschutzerklärung.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 3 Leistungen des Betreibers</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Der Betreiber bietet Nutzern die Möglichkeit, gebrauchte Waren zu inserieren, Angebote auszuhandeln,
          Nachrichten auszutauschen und Bestellungen inklusive Statushistorie nachzuverfolgen. Es besteht kein Anspruch
          auf eine jederzeit unterbrechungsfreie Verfügbarkeit der Plattform.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 4 Pflichten der Verkäufer</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Verkäufer müssen Artikel wahrheitsgemäß beschreiben, Mängel angeben und dürfen keine gefälschte
          Markenware, verbotenen Gegenstände oder rechtswidrige Inhalte anbieten. Verkäufer sind für Lagerbestand,
          Versand und Aktualität des Produktstatus verantwortlich.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 5 Transaktionsabwicklung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Ein Kaufvertrag kommt zustande, wenn ein Käufer ein Angebot annimmt oder ein Gegenangebot im Rahmen des
          Verhandlungssystems akzeptiert wird. Der Marktplatz dokumentiert Angebotsverlauf, Verfügbarkeit,
          Bestellstatus, Versandmeldungen und Konfliktfälle, damit beide Parteien den Vorgang nachvollziehen können.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 6 Gebühren und Kosten</h2>
        <p className="text-lg font-semibold italic leading-relaxed text-muted-foreground">
          Das Einstellen von Artikeln ist für private Verkäufer derzeit kostenlos. Etwaige Zahlungs- oder
          Servicegebuehren werden vor Abschluss der Bestellung transparent angezeigt.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 7 Haftung</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Der Betreiber haftet nicht für Sachmängel der angebotenen Waren oder für Pflichtverletzungen eines Nutzers.
          Unberührt bleibt die Haftung bei Vorsatz, grober Fahrlässigkeit oder zwingenden gesetzlichen Vorgaben.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 8 DAC7 / PStTG</h2>
        <p className="text-lg italic leading-relaxed text-muted-foreground">
          Verkäufer werden darauf hingewiesen, dass der Betreiber bei Erreichen der jeweils gültigen gesetzlichen
          Meldepflichten Daten an das Bundeszentralamt für Steuern übermitteln muss. Die jeweils aktuelle Einordnung
          und die betroffenen Datenfelder werden in der DAC7-Information und in der Datenschutzerklärung beschrieben.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Paragraph 9 Schlussbestimmungen</h2>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich zulässig, Berlin.
        </p>
      </section>
    </div>
  );
}
