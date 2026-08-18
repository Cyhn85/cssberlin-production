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

        <motion.div variants={container} initial="hidden" animate="show" className="mb-16 grid gap-8 md:grid-cols-3">
          {[
            {
              icon: <ShieldCheck size={32} />,
              title: 'Käuferschutz',
              desc: 'Zahlungen bleiben geschützt, bis Bestellungen bestätigt und sicher angekommen sind.',
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
            <motion.div key={feature.title} variants={item} className="flex flex-col items-center p-8 text-center rounded-3xl shadow-sm border transition-all duration-300 hover:shadow-md hover:-translate-y-1 bg-white dark:bg-[#161b22]" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary)' }}>
                {feature.icon}
              </div>
              <h3 className="mb-3 text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
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
          className="rounded-3xl border p-8 text-center md:p-14 shadow-sm"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
        >
          <h2 className="mb-4 text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
            Second-Hand statt Neuware
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Jeder verkaufte Artikel spart Ressourcen, CO2 und Wasser. Unsere Community-Zahlen sind live und
            echt &mdash; kein Marketing-Platzhalter.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/eco-impact" className="rounded-full border px-6 py-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              Unseren Impact ansehen
            </Link>
            <Link href="/catalog" className="btn-mars-earth rounded-full px-8 py-3 text-sm font-bold text-white transition-transform hover:scale-105" style={{ background: 'var(--color-orange)' }}>
              <span>Jetzt stöbern</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
