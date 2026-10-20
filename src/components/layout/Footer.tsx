'use client';

import Link from 'next/link';
import { Leaf, Mail, MapPin, Phone, ShieldCheck, Handshake, RotateCcw } from 'lucide-react';

import { businessProfile } from '@/config/business-profile';
import { openConsentSettings } from '@/lib/consent';

/**
 * Footer: brand row, five link columns, then the contact block centred on its
 * own full-width row directly under the columns, then the © bar.
 * The contact block used to sit squeezed into the brand column (far left on
 * desktop, left-aligned above the links on mobile). Every link points at a
 * page that exists; account pages live in the avatar menu, not here.
 */
const footerSections: Array<{ title: string; links: Array<{ name: string; href: string }> }> = [
  {
    title: 'Entdecken',
    links: [
      { name: 'Neu im Katalog', href: '/catalog?sort=newest' },
      { name: 'Damen', href: '/catalog?category=Damen' },
      { name: 'Herren', href: '/catalog?category=Herren' },
      { name: 'Sale', href: '/sale' },
      { name: 'Bildersuche', href: '/search/image' },
    ],
  },
  {
    title: 'Verkaufen',
    links: [
      { name: 'Jetzt verkaufen', href: '/upload' },
      { name: 'So verkaufst du', href: '/hilfe/verkaufen' },
      { name: 'Preisvorschläge', href: '/hilfe/preisvorschlaege' },
      { name: 'Versand', href: '/hilfe/versand' },
      { name: 'Abholung', href: '/hilfe/abholung' },
    ],
  },
  {
    title: 'Hilfe & Service',
    links: [
      { name: 'Hilfe-Center & FAQ', href: '/hilfe' },
      { name: 'So funktioniert’s', href: '/hilfe/so-funktionierts' },
      { name: 'Käuferschutz', href: '/hilfe/kaeuferschutz' },
      { name: 'Zahlungsarten', href: '/hilfe/bezahlen' },
      { name: 'Stornierung', href: '/hilfe/stornierung' },
      { name: 'Kontakt', href: '/kontakt' },
    ],
  },
  {
    title: 'Über cssberlin',
    links: [
      { name: 'Warum wir?', href: '/ueber-uns' },
      { name: 'Eco Impact', href: '/eco-impact' },
      { name: 'Sicher handeln', href: '/hilfe/sicherheit' },
      { name: 'Verbotene Artikel', href: '/hilfe/verbotene-artikel' },
      { name: 'Inhalte melden', href: '/kontakt?thema=melden' },
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
];

const trust = [
  { icon: ShieldCheck, text: 'Käuferschutz bei Online-Kauf' },
  { icon: Handshake, text: 'Abholung in deiner Nähe' },
  { icon: RotateCcw, text: 'Klare Fristen & Stornoregeln' },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      <div className="container py-12">
        {/* Marke + Vertrauen */}
        <div className="mb-10 flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-2">
              <Leaf size={24} style={{ color: 'var(--color-primary)' }} strokeWidth={2.5} />
              <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                css<span style={{ color: 'var(--color-primary)' }}>berlin</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Dein nachhaltiger Marktplatz in Berlin. Kaufe und verkaufe Second-Hand - für dich und die Umwelt.
            </p>
          </div>
          <ul className="flex flex-wrap justify-center gap-3">
            {trust.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'var(--color-bg)' }}>
                <Icon size={14} style={{ color: 'var(--color-primary)' }} /> {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Link-Spalten */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="nav-mars-earth text-sm" style={{ color: 'var(--color-text-muted)' }}>{link.name}</Link>
                  </li>
                ))}
                {section.title === 'Rechtliches' ? (
                  <li>
                    <button type="button" onClick={() => openConsentSettings()} className="nav-mars-earth text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Cookie-Einstellungen
                    </button>
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </nav>

        {/* Kontakt - mittig, direkt unter den Spalten */}
        <address
          className="mt-10 flex flex-col items-center justify-center gap-3 border-t pt-8 text-center text-sm not-italic sm:flex-row sm:flex-wrap sm:gap-x-8"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <a href={businessProfile.publicEmailHref} className="inline-flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]">
            <Mail size={16} style={{ color: 'var(--color-primary)' }} /> {businessProfile.publicEmail}
          </a>
          <a href={businessProfile.phoneHref} className="inline-flex items-center gap-2 transition-colors hover:text-[var(--color-primary)]">
            <Phone size={16} style={{ color: 'var(--color-primary)' }} /> {businessProfile.phoneDisplay}
          </a>
          <span className="inline-flex items-center gap-2">
            <MapPin size={16} style={{ color: 'var(--color-primary)' }} /> {businessProfile.streetAddress}, {businessProfile.postalCode} {businessProfile.city}
          </span>
        </address>
      </div>

      <div className="border-t py-4" style={{ borderColor: 'var(--color-border)' }}>
        <div className="container flex flex-col items-center justify-center gap-1 text-center text-xs sm:flex-row sm:gap-4" style={{ color: 'var(--color-text-muted)' }}>
          <p>&copy; {new Date().getFullYear()} cssberlin.de - Alle Rechte vorbehalten.</p>
          <span className="hidden sm:inline" aria-hidden>·</span>
          <p className="flex items-center gap-1">
            Mit <Leaf size={12} style={{ color: 'var(--color-primary)' }} /> für die Umwelt gemacht in Berlin
          </p>
        </div>
      </div>
    </footer>
  );
}
