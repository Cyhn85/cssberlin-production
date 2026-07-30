'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Leaf, MessageCircle, ShieldCheck, Truck } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';

type CategoryNode = {
  id: string;
  name: string;
  emoji?: string | null;
  _count?: { products: number };
  children?: Array<{ _count?: { products: number } }>;
};

type ProductCardData = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  brand: string | null;
  size: string | null;
  condition: string;
  likes: number;
  ecoCO2Saved: number;
  images: Array<{ url: string }>;
  seller: { name: string | null };
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export default function HomePage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDegraded, setIsDegraded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [categoriesResponse, productsResponse] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/products?sort=popular&limit=8'),
        ]);

        const categoriesResult = await categoriesResponse.json();
        const productsResult = await productsResponse.json();

        if (cancelled) return;

        if (categoriesResult.success) {
          setCategories(categoriesResult.data.tree || []);
        }

        if (productsResult.success) {
          setFeaturedProducts(productsResult.data.items || []);
        }

        setIsDegraded(Boolean(categoriesResult.data?.degraded || productsResult.data?.degraded));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCategories = useMemo(() => categories.slice(0, 6), [categories]);
  const totalVisibleItems = useMemo(
    () =>
      visibleCategories.reduce((sum, category) => {
        const direct = category._count?.products || 0;
        const children = (category.children || []).reduce((childSum, child) => childSum + (child._count?.products || 0), 0);
        return sum + direct + children;
      }, 0),
    [visibleCategories]
  );

  return (
    <div className="pt-0">
      <section className="py-12">
        <div className="container">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                Kategorien entdecken
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {loading
                  ? 'Live-Daten werden geladen...'
                  : isDegraded
                    ? 'Neue Artikel werden gerade geladen. Schau in Kürze wieder vorbei.'
                    : `${totalVisibleItems} aktive Artikel in den beliebtesten Bereichen.`}
              </p>
            </div>
            <Link href="/catalog" className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>

          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6"
          >
            {visibleCategories.map((category) => {
              const count = (category._count?.products || 0) + (category.children || []).reduce((sum, child) => sum + (child._count?.products || 0), 0);
              return (
                <motion.div key={category.id} variants={item}>
                  <Link href={`/catalog?category=${encodeURIComponent(category.name)}`}>
                    <div
                      className="flex h-full flex-col items-center gap-2 rounded-2xl p-4 transition-transform hover:-translate-y-1"
                      style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <span className="text-3xl">{category.emoji || '🛍️'}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {category.name}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {count} Artikel
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="py-12" style={{ background: 'var(--color-bg-secondary)' }}>
        <div className="container">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                Neu im Feed
              </h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Live aus deinem Marktplatz statt statischer Platzhalter.
              </p>
            </div>
            <Link href="/catalog" className="flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
              Alle anzeigen <ArrowRight size={14} />
            </Link>
          </div>

          {featuredProducts.length > 0 ? (
            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
            >
              {featuredProducts.map((product) => (
                <motion.div key={product.id} variants={item}>
                  <ProductCard product={product} showSeller />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <Leaf size={28} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {isDegraded
                  ? 'Der Live-Katalog synchronisiert gerade. Bitte lade die Seite in ein paar Sekunden erneut.'
                  : 'Noch keine aktiven Produkte vorhanden.'}
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="warum-cssberlin" className="scroll-mt-24 py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-2xl font-bold md:text-3xl" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Warum cssberlin?
            </h2>
            <p className="mx-auto max-w-lg text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Sicherheit, Nachhaltigkeit und Fairness bleiben die Basis, waehrend die Daten jetzt live aus dem Marktplatz kommen.
            </p>
          </motion.div>

          <motion.div variants={container} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid gap-6 md:grid-cols-3">
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
        </div>
      </section>

      <section className="hero-banner-gradient py-16">
        <div className="container text-center">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl" style={{ fontFamily: 'var(--font-display)' }}>
            Bereit fuer deinen ersten Verkauf?
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-lg text-white/80">
            Lade Fotos hoch, beschreibe deinen Artikel und dein Inserat ist in wenigen Minuten live.
          </p>
          <Link href="/upload" className="rounded-full bg-white px-8 py-4 text-lg font-bold" style={{ color: '#E8651A' }}>
            Jetzt verkaufen
          </Link>
        </div>
      </section>
    </div>
  );
}
