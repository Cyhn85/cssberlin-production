import { Metadata } from 'next';

import { businessAddressLines, businessProfile } from '@/config/business-profile';

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Rechtliche Informationen ueber cssberlin.de.',
};

export default function ImpressumPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Impressum
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">Angaben gemaess Paragraph 5 DDG</p>
      </div>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Diensteanbieter</h2>
        <p className="text-lg leading-loose">
          <strong>{businessProfile.businessName}</strong>
          <br />
          Inhaber: {businessProfile.ownerName}
          <br />
          {businessAddressLines[0]}
          <br />
          {businessAddressLines[1]}
          <br />
          {businessAddressLines[2]}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Kontakt</h2>
        <p className="text-lg leading-loose">
          Telefon:{' '}
          <a href={businessProfile.phoneHref} className="text-primary hover:underline">
            {businessProfile.phoneDisplay}
          </a>
          <br />
          E-Mail:{' '}
          <a href={businessProfile.publicEmailHref} className="text-primary hover:underline">
            {businessProfile.publicEmail}
          </a>
          <br />
          Web:{' '}
          <a href={businessProfile.websiteUrl} className="text-primary hover:underline">
            {businessProfile.websiteHost}
          </a>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Unternehmensprofil</h2>
        <p className="text-lg leading-loose">
          Taetigkeit: {businessProfile.tradeActivity}
          <br />
          Gewerbeanmeldung / Betriebsort: {businessProfile.tradeRegistrationAuthority}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Umsatzsteuer-ID</h2>
        <p className="text-lg leading-loose">
          Umsatzsteuer-Identifikationsnummer gemaess Paragraph 27a UStG: {businessProfile.vatId}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Verantwortlich fuer Inhalte</h2>
        <p className="text-lg leading-loose">
          {businessProfile.ownerName}
          <br />
          {businessAddressLines[0]}
          <br />
          {businessAddressLines[1]}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="border-b pb-2 text-2xl font-bold">Verbraucherstreitbeilegung</h2>
        <p className="leading-relaxed text-muted-foreground">
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </div>
  );
}
