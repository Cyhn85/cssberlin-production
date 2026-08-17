import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/db';
import ProductCard from '@/components/product/ProductCard';

export const revalidate = 600; // 10 Minuten

// Ab hier lohnt sich das Wort "Sale". Alles darunter zeigen wir nicht als
// Rabatt an - ein Nachlass von ein paar Prozent ist keine Aktion.
const MIN_DISCOUNT = 0.2;

export const metadata: Metadata = {
  title: 'Sale',
  description: 'Reduzierte Second-Hand Artikel bei cssberlin.de - mindestens 20 Prozent unter dem urspruenglichen Preis.',
  alternates: { canonical: 'https://cssberlin.de/sale' },
};

// Der Rabatt wird gegen originalPrice gerechnet - ein echter frueherer Preis,
// kein Fantasie-Streichpreis. Artikel ohne originalPrice tauchen hier gar nicht
// erst auf.
async function loadSaleProducts() {
  try {
    const candidates = await prisma.product.findMany({
      where: { status: 'ACTIVE', originalPrice: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true, title: true, price: true, originalPrice: true,
        brand: true, size: true, condition: true, ecoCO2Saved: true,
        images: { select: { url: true }, orderBy: { orderIndex: 'asc' }, take: 1 },
      },
    });
    return candidates.filter(
      (p) => p.originalPrice !== null && p.price <= p.originalPrice * (1 - MIN_DISCOUNT),
    );
  } catch (error) {
    console.error('SalePage query failed:', error);
    return [];
  }
}

export default async function SalePage() {
  const products = await loadSaleProducts();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-[#1B4332] dark:text-[#D8F3DC]">Sale</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-300">
          Artikel, die mindestens 20 Prozent unter ihrem urspruenglichen Preis liegen.
          Der Vergleichspreis ist der Preis, zu dem der Artikel bei uns vorher stand.
        </p>
      </header>

      {products.length === 0 ? (
        <div className="rounded-xl border border-stone-200 p-10 text-center dark:border-stone-700">
          <p className="text-stone-600 dark:text-stone-300">
            Aktuell ist nichts reduziert.
          </p>
          <Link href="/catalog" className="mt-4 inline-block font-medium text-[#2D6A4F] hover:underline">
            Zum gesamten Katalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product as never} />
          ))}
        </div>
      )}
    </main>
  );
}
