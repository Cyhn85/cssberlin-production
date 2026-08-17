import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const runtime = 'nodejs';
export const revalidate = 300; // 5 Minuten - der Ticker muss nicht sekundenaktuell sein

/**
 * GET /api/ticker?lang=de
 *
 * Liefert die Zeilen fuer den Header-Ticker. Zwei Quellen, beide echt:
 *  - freigegebene Kampagnen aus der Campaign-Tabelle (von TATANGA gepusht)
 *  - die Community-Zahlen, direkt aus der Datenbank gerechnet
 *
 * Es gibt bewusst keinen statischen Fuellinhalt: gibt es nichts Belegbares zu
 * sagen, kommt eine leere Liste zurueck und der Ticker bleibt aus.
 */
export async function GET(request: NextRequest) {
  const lang = (request.nextUrl.searchParams.get('lang') || 'de').toLowerCase();

  try {
    const now = new Date();
    const [campaigns, stats] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          lang,
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, kind: true, headline: true, href: true },
      }),
      prisma.user.aggregate({ _sum: { ecoCO2Saved: true, itemsRecycled: true } }),
    ]);

    const items: { key: string; label: string; href: string; kind: string }[] = campaigns.map((c) => ({
      key: c.id,
      label: c.headline,
      href: c.href,
      kind: c.kind,
    }));

    const itemsRecycled = stats._sum.itemsRecycled || 0;
    const co2Saved = Math.round((stats._sum.ecoCO2Saved || 0) * 10) / 10;
    const fmt = (value: number) => value.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');

    if (itemsRecycled > 0) {
      items.push({
        key: 'reused',
        kind: 'eco',
        href: '/eco-impact',
        label:
          lang === 'de' ? `${fmt(itemsRecycled)} Artikel wiederverwendet`
          : lang === 'tr' ? `${fmt(itemsRecycled)} urun yeniden kullanildi`
          : `${fmt(itemsRecycled)} items reused`,
      });
    }
    if (co2Saved > 0) {
      items.push({
        key: 'co2',
        kind: 'eco',
        href: '/eco-impact',
        label:
          lang === 'de' ? `${fmt(co2Saved)} kg CO2 eingespart`
          : lang === 'tr' ? `${fmt(co2Saved)} kg CO2 tasarrufu`
          : `${fmt(co2Saved)} kg CO2 saved`,
      });
    }

    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error('GET /api/ticker error:', error);
    // Im Fehlerfall lieber nichts anzeigen als etwas Erfundenes.
    return NextResponse.json({ success: true, data: { items: [] } });
  }
}
