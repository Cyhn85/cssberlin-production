'use client';

import Link from 'next/link';
import { Leaf, Mail, MapPin, Phone } from 'lucide-react';

import { businessProfile } from '@/config/business-profile';
import { openConsentSettings } from '@/lib/consent';

const footerSections = [
  {
    title: 'Entdecken',
    links: [
      { name: 'Neu im Katalog', href: '/catalog?sort=newest' },
      { name: 'Damen', href: '/catalog?category=Damen' },
      { name: 'Herren', href: '/catalog?category=Herren' },
      { name: 'Jetzt verkaufen', href: '/upload' },
    ],
  },
  {
    title: 'Konto',
    links: [
      { name: 'Einloggen', href: '/login' },
      { name: 'Registrieren', href: '/register' },
      { name: 'Mein Profil', href: '/profile' },
      { name: 'Inbox', href: '/inbox' },
    ],
  },
  {
    title: 'Rechtliches',
    links: [
      { name: 'Impressum', href: '/impressum' },
      { name: 'Datenschutz', href: '/datenschutz' },
      { name: 'AGB', href: '/agb' },
      { name: 'Widerrufsrecht', href: '/widerruf' },
      { name: 'DAC7 / PStTG', href: '/dac7' },
    ],
  },
  {
    title: 'Mehr',
    links: [
      { name: 'Favoriten', href: '/favorites' },
      { name: 'Benachrichtigungen', href: '/notifications' },
      { name: 'Kaeufe', href: '/purchases' },
      { name: 'Einstellungen', href: '/settings' },
    ],
  },
];

export default function Footer() {
  return (
    <footer
      className="mt-auto border-t"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-bg-secondary)',
      }}
    >
      <div className="container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 mb-4 md:col-span-4 lg:col-span-1 lg:mb-0">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Leaf size={24} style={{ color: 'var(--color-primary)' }} strokeWidth={2.5} />
              <span
                className="text-lg font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}
              >
                css<span style={{ color: 'var(--color-primary)' }}>berlin</span>
              </span>
            </Link>
            <p
              className="mb-4 max-w-xs text-sm leading-relaxed"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Dein nachhaltiger Marktplatz in Berlin. Kaufe und verkaufe Second-Hand fuer dich und die Umwelt.
            </p>

            <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <a
                href={businessProfile.publicEmailHref}
                className="flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]"
              >
                <Mail size={16} /> {businessProfile.publicEmail}
              </a>
              <a
                href={businessProfile.phoneHref}
                className="flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]"
              >
                <Phone size={16} /> {businessProfile.phoneDisplay}
              </a>
              <p className="flex items-center gap-2">
                <MapPin size={16} /> {businessProfile.streetAddress}, {businessProfile.postalCode} {businessProfile.city}
              </p>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3
                className="mb-3 text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-text)', fontSize: 'var(--text-xs)' }}
              >
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="nav-mars-earth text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
                {section.title === 'Rechtliches' ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => openConsentSettings()}
                      className="nav-mars-earth text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Cookie-Einstellungen
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t py-4" style={{ borderColor: 'var(--color-border)' }}>
        <div
          className="container flex flex-col items-center justify-between gap-2 text-xs sm:flex-row"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <p>&copy; {new Date().getFullYear()} cssberlin.de - Alle Rechte vorbehalten.</p>
          <p className="flex items-center gap-1">
            Mit <Leaf size={12} style={{ color: 'var(--color-primary)' }} /> fuer die Umwelt gemacht in Berlin
          </p>
        </div>
      </div>
    </footer>
  );
}
