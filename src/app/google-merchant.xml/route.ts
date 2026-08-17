import prisma from '@/lib/db';

// Google Merchant Center urun feed'i (RSS 2.0 + g: namespace).
// Ucretsiz Google Shopping / urun listeleri icin. Saatte bir yenilenir (ISR).
export const revalidate = 3600;

const BASE = 'https://cssberlin.de';

function esc(s: string | null | undefined): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function abs(u: string): string {
  return u.startsWith('http') ? u : `${BASE}${u}`;
}

// Bizim durum -> Google condition (new | used | refurbished)
function gCondition(c: string): string {
  return c === 'NEW' ? 'new' : 'used';
}

export async function GET() {
  let items = '';
  try {
    const products = await prisma.product.findMany({
      where: { status: 'ACTIVE', images: { some: {} } }, // Merchant image_link zorunlu
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        brand: true,
        condition: true,
        images: { select: { url: true }, orderBy: { orderIndex: 'asc' }, take: 1 },
        category: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    });

    items = products
      .map((p) => {
        const img = abs(p.images[0].url);
        const desc = (p.description || p.title).slice(0, 5000);
        const parts = [
          `      <g:id>${esc(p.id)}</g:id>`,
          `      <g:title>${esc(p.title)}</g:title>`,
          `      <g:description>${esc(desc)}</g:description>`,
          `      <g:link>${BASE}/product/${esc(p.id)}</g:link>`,
          `      <g:image_link>${esc(img)}</g:image_link>`,
          `      <g:availability>in_stock</g:availability>`,
          `      <g:price>${Number(p.price).toFixed(2)} EUR</g:price>`,
          `      <g:condition>${gCondition(p.condition)}</g:condition>`,
        ];
        if (p.brand) parts.push(`      <g:brand>${esc(p.brand)}</g:brand>`);
        if (p.category?.name) parts.push(`      <g:product_type>${esc(p.category.name)}</g:product_type>`);
        return `    <item>\n${parts.join('\n')}\n    </item>`;
      })
      .join('\n');
  } catch {
    items = ''; // DB erisilemezse bos feed (build/route kirilmasin)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>cssberlin.de</title>
    <link>${BASE}</link>
    <description>Nachhaltiger Second-Hand Marktplatz in Berlin</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
