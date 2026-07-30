import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Widerrufsrecht',
    description: 'Informationen zum Widerrufsrecht auf cssberlin.de (Insbesondere für private Verkäufe).',
};

export default function WiderrufPage() {
    return (
        <div className="space-y-12 pb-12">
            <header>
                <h1 className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    Widerrufsrecht
                </h1>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                    Widerrufsbelehrung und Muster-Widerrufsformular
                </p>
            </header>

            <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 mb-10">
                <h2 className="text-xl font-bold text-primary mb-2 italic">⚠️ Wichtiger Hinweis für cssberlin.de Nutzer</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    Der Großteil der Transaktionen auf cssberlin.de erfolgt zwischen <strong>privaten Personen (Verbrauchern)</strong>. Bei Privatkäufen besteht von Gesetzes wegen <strong>kein Widerrufsrecht</strong>, sofern der Verkäufer dieses wirksam ausgeschlossen hat. cssberlin.de selbst tritt ausschließlich als Vermittler zwischen privaten Käufern und Verkäufern auf und verkauft keine eigenen Waren.
                </p>
            </div>

            <section className="space-y-4">
                <h2 className="text-2xl font-bold border-b pb-2">Widerrufsbelehrung</h2>
                <p className="text-lg leading-relaxed text-muted-foreground font-semibold uppercase">
                    Widerrufsrecht
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                    Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                    Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Name, Anschrift des Verkäufers, E-Mail) mittels einer eindeutigen Erklärung über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-bold border-b pb-2">Folgen des Widerrufs</h2>
                <p className="text-lg leading-relaxed text-muted-foreground">
                    Wenn Sie diesen Vertrag widerrufen, hat Ihnen der Verkäufer alle Zahlungen, die er von Ihnen erhalten hat, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf eingegangen ist.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                    Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-bold border-b pb-2">Ausschluss des Widerrufsrechts</h2>
                <p className="text-lg leading-relaxed text-muted-foreground border-l-4 border-error pl-4">
                    Das Widerrufsrecht besteht nicht bei Verträgen zur Lieferung von Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind.
                </p>
            </section>

            <section className="space-y-4 pt-4">
                <h2 className="text-2xl font-bold border-b pb-2">Muster-Widerrufsformular</h2>
                <div className="p-8 border-2 border-dashed rounded-3xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <p className="text-sm leading-relaxed text-muted-foreground mb-8 text-center italic">
                        (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)
                    </p>
                    <ul className="space-y-6 text-sm">
                        <li className="border-b pb-2">An [Name des Verkäufers]:</li>
                        <li className="border-b pb-2">Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*):</li>
                        <li className="border-b pb-2">Bestellt am (*)/erhalten am (*):</li>
                        <li className="border-b pb-2">Name des/der Verbraucher(s):</li>
                        <li className="border-b pb-2">Anschrift des/der Verbraucher(s):</li>
                        <li className="border-b pb-2 pt-8">Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</li>
                        <li className="border-b pb-2">Datum:</li>
                    </ul>
                    <p className="text-[10px] mt-8 text-muted-foreground">(*) Unzutreffendes streichen.</p>
                </div>
            </section>
        </div>
    );
}
