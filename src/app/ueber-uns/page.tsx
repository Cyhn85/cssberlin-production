'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, Truck, MessageCircle, Leaf } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-20 pt-10" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}>
            <Leaf size={26} />
          </div>
          <h1 className="mb-3 text-3xl font-bold md:text-4xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
            Warum cssberlin?
          </h1>
          <p className="mx-auto max-w-lg text-base" style={{ color: 'var(--color-text-secondary)' }}>
            cssberlin ist Berlins nachhaltiger Second-Hand-Marktplatz. Wir vermitteln zwischen Menschen, die verkaufen,
            und Menschen, die kaufen wollen &mdash; sicher, fair und mit echten Daten statt Platzhaltern.
          </p>
        </motion.div>

        <motion.div variants={container} initial="hidden" animate="show" className="mb-16 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: <ShieldCheck size={32} />,
              title: 'Kaeuferschutz',
              desc: 'Zahlungen bleiben geschuetzt, bis Bestellungen bestaetigt und sicher angekommen sind.',
            },
            {
              icon: <Truck size={32} />,
              title: 'Einfacher Versand',
              desc: 'Deine erste Bestellung ist versandkostenfrei. Danach zeigen wir Versandkosten und Tracking transparent im Checkout.',
            },
            {
              icon: <MessageCircle size={32} />,
              title: 'Direkter Kontakt',
              desc: 'Nachrichten, Angebote und Profilseiten greifen auf dieselben Live-Daten zu.',
            },
          ].map((feature) => (
            <motion.div key={feature.title} variants={item} className="glass-card p-8 text-center hover-lift">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}>
                {feature.icon}
              </div>
              <h3 className="mb-2 text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border p-8 text-center md:p-12"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
        >
          <h2 className="mb-3 text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
            Second-Hand statt Neuware
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Jeder verkaufte Artikel spart Ressourcen, CO2 und Wasser. Unsere Community-Zahlen sind live und
            echt &mdash; kein Marketing-Platzhalter.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/eco-impact" className="nav-mars-earth rounded-full border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--color-border)' }}>
              Unseren Impact ansehen
            </Link>
            <Link href="/catalog" className="btn-mars-earth rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: 'var(--color-orange)' }}>
              <span>Jetzt stoebern</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
