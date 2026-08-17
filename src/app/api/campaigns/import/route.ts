import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';

export const runtime = 'nodejs';

const KINDS = ['sale', 'new_arrival', 'category_spotlight', 'eco'];
const LANGS = ['de', 'en', 'tr'];

type IncomingCampaign = {
  source_id?: string;
  kind?: string;
  lang?: string;
  headline?: string;
  body?: string;
  cta?: string;
  href?: string;
  evidence?: string;
  active?: boolean;
  expires_at?: string | null;
};

/**
 * POST /api/campaigns/import
 *
 * TATANGA schiebt hier ausschliesslich Kampagnentexte hinein, die ein Mensch
 * freigegeben hat. Jede Kampagne muss `evidence` mitliefern - also warum die
 * Aussage stimmt. Ohne Beleg wird sie abgelehnt, damit auf der Seite nie eine
 * Behauptung landet, die niemand nachvollziehen kann.
 */
export async function POST(request: NextRequest) {
  try {
    const expectedKey = process.env.TATANGA_IMPORT_API_KEY;
    if (!expectedKey) {
      console.error('TATANGA_IMPORT_API_KEY is not configured on the server.');
      return ApiResponse.serverError('Import ist serverseitig nicht konfiguriert.');
    }
    if (request.headers.get('x-api-key') !== expectedKey) {
      return ApiResponse.unauthorized('Ungueltiger API-Schluessel.');
    }

    const payload = await request.json();
    const incoming: IncomingCampaign[] = Array.isArray(payload) ? payload : payload?.campaigns;
    if (!Array.isArray(incoming)) {
      return ApiResponse.validationError('Erwartet wird ein Array oder { campaigns: [...] }.');
    }

    const accepted: string[] = [];
    const rejected: { source_id: string; reason: string }[] = [];

    for (const item of incoming) {
      const sourceId = String(item.source_id || '').trim();
      const headline = String(item.headline || '').trim();
      const evidence = String(item.evidence || '').trim();
      const kind = String(item.kind || '');
      const lang = String(item.lang || '');

      if (!sourceId || !headline) {
        rejected.push({ source_id: sourceId || '(ohne id)', reason: 'source_id und headline sind Pflicht' });
        continue;
      }
      if (!KINDS.includes(kind) || !LANGS.includes(lang)) {
        rejected.push({ source_id: sourceId, reason: `unbekannte kind/lang Kombination (${kind}/${lang})` });
        continue;
      }
      // Kein Beleg, keine Veroeffentlichung - das ist der ganze Sinn dieser Route.
      if (!evidence) {
        rejected.push({ source_id: sourceId, reason: 'evidence fehlt - Aussage waere nicht nachvollziehbar' });
        continue;
      }

      const data = {
        kind,
        lang,
        headline,
        body: String(item.body || '').trim(),
        cta: String(item.cta || '').trim(),
        href: String(item.href || '/catalog'),
        evidence,
        active: item.active !== false,
        expiresAt: item.expires_at ? new Date(item.expires_at) : null,
      };

      await prisma.campaign.upsert({
        where: { sourceId },
        update: data,
        create: { sourceId, ...data },
      });
      accepted.push(sourceId);
    }

    // Flache Antwort, weil TATANGA die Felder direkt aus dem Top-Level liest.
    return NextResponse.json({ success: true, accepted: accepted.length, rejected });
  } catch (error) {
    console.error('POST /api/campaigns/import error:', error);
    return ApiResponse.serverError();
  }
}
