import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getOptionalSession } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { buildCatalogWhere } from '@/lib/catalog-filter';
import { helpKnowledgeText, HELP_ARTICLES } from '@/content/help';
import { orderStatusToLabel } from '@/lib/utils/condition-map';

/**
 * POST /api/ai/chat - "CSS Assist", the site assistant.
 *
 * What changed (2026-10-20):
 *  - It says it is an AI (EU AI Act Art. 50). The old prompt told it to pass as a
 *    human from Berlin.
 *  - It knows the real rules: fees, deadlines, cancellation, payment status come
 *    from src/content/help.ts, which reads src/config/* - the same numbers the
 *    checkout and the help pages use.
 *  - Read-only "tools", resolved on the server BEFORE the model runs: catalogue
 *    search (real products with links) and, for signed-in users, their own open
 *    orders/offers. The model can never write anything.
 *  - Clients cannot inject system messages any more (only user/assistant roles,
 *    1000 chars each, last 10 turns).
 *  - Guests can use it (8/hour per IP); signed-in users 30/hour.
 *  - Model: Gemini (the configured key on the server); Groq qwen3.8 as fallback
 *    when a GROQ_API_KEY exists. The dead llama-3.1-70b model is gone.
 */

const MAX_CHARS = 1000;
const GROQ_MODEL = process.env.GROQ_CHAT_MODEL || 'qwen/qwen3.8-27b';
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-flash-latest';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function systemPrompt(extra: string) {
  return `Du bist "CSS Assist", der KI-Assistent von cssberlin.de, einem Second-Hand-Marktplatz aus Berlin.
Du bist eine KI, kein Mensch - sag das offen, wenn danach gefragt wird. Nenne keinen Modell- oder Anbieternamen.

Stil: Deutsch, freundlich, locker, kurz (2-5 Sätze oder eine kurze Liste). Duzen. Wenn der Nutzer eine andere Sprache schreibt, antworte in seiner Sprache.

Regeln:
- Antworte NUR mit Fakten aus dem Wissen unten und den gelieferten Daten. Erfinde keine Gebühren, Fristen, Artikel oder Bestellstände.
- Weißt du etwas nicht, sag es und verweise auf /hilfe oder /kontakt.
- Du kannst nichts ändern (keine Bestellung, kein Angebot, kein Konto) - erkläre, wo der Nutzer es selbst tut.
- Keine Rechtsberatung; bei Rechtsfragen auf AGB (/agb) und Widerrufsbelehrung (/widerruf) verweisen.
- Artikel nur aus der Liste "Gefundene Artikel" empfehlen, mit Link im Format [Titel](/product/ID).
- Hilfe-Links im Format [Titel](/hilfe/slug).
- Frag nie nach Passwörtern, Karten- oder Bankdaten.

Wissen:
${helpKnowledgeText()}

Hilfe-Artikel: ${HELP_ARTICLES.map((a) => `${a.title} (/hilfe/${a.slug})`).join('; ')}
${extra}`;
}

const SEARCH_HINT = /\b(such|find|zeig|hast du|gibt es|habt ihr|empfiehl|kaufen|suche|looking for|jacke|hose|schuh|sneaker|kleid|pullover|shirt|tasche|mantel|jeans|größe|groesse|marke|unter \d+|bis \d+)/i;
const ORDER_HINT = /\b(bestell|kauf|verkauf|paket|versand|sendung|storn|angebot|preisvorschlag|abhol|status|wo ist|erstatt|geld zurück)/i;
const STOPWORDS = new Set(['ich', 'suche', 'eine', 'einen', 'ein', 'der', 'die', 'das', 'für', 'mit', 'und', 'oder', 'nach', 'habt', 'ihr', 'gibt', 'es', 'zeig', 'mir', 'bitte', 'hast', 'du', 'in', 'größe', 'groesse', 'unter', 'bis', 'euro', 'eur', 'was', 'wie', 'kann', 'man']);

/** Turns "Levi's Jeans Größe 32 unter 40 €" into catalogue filters. */
function searchParamsFromText(text: string) {
  const p = new URLSearchParams();
  const max = text.match(/(?:unter|bis|max(?:imal)?)\s*(\d{1,4})/i);
  if (max) p.set('maxPrice', max[1]);
  const size = text.match(/(?:größe|groesse|gr\.?|size)\s*([a-z0-9]{1,4})/i);
  if (size) p.set('size', size[1].toUpperCase());
  const words = text
    .replace(/(?:unter|bis|max(?:imal)?)\s*\d+\s*(?:€|euro|eur)?/gi, ' ')
    .replace(/(?:größe|groesse|gr\.?|size)\s*[a-z0-9]{1,4}/gi, ' ')
    .toLowerCase()
    .split(/[^a-zäöüß0-9'-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 4);
  if (words.length) p.set('q', words.join(' '));
  return p;
}

async function findProducts(text: string) {
  const params = searchParamsFromText(text);
  if (!params.get('q') && !params.get('maxPrice')) return [];
  const rows = await prisma.product.findMany({
    where: { ...buildCatalogWhere(params), status: 'ACTIVE' },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, price: true, brand: true, size: true, condition: true, seller: { select: { city: true } } },
  });
  return rows;
}

async function userContext(userId: string) {
  const [orders, offers] = await Promise.all([
    prisma.order.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, buyerId: true, shippingCarrier: true, trackingCode: true, product: { select: { title: true } } },
    }),
    prisma.offer.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }], status: { in: ['PENDING', 'ACCEPTED'] } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { status: true, offeredPrice: true, buyerId: true, expiresAt: true, product: { select: { title: true } } },
    }),
  ]);
  const o = orders.map((x) => `- ${x.buyerId === userId ? 'Kauf' : 'Verkauf'}: ${x.product.title} - ${orderStatusToLabel[x.status] || x.status}${x.trackingCode ? `, Sendung ${x.trackingCode}` : ''} (Details: /${x.buyerId === userId ? 'purchases' : 'sales'}/${x.id})`);
  const f = offers.map((x) => `- Angebot ${x.buyerId === userId ? 'gesendet' : 'erhalten'}: ${x.product.title} ${x.offeredPrice.toFixed(2)} € (${x.status === 'ACCEPTED' ? 'angenommen' : 'offen'}${x.expiresAt ? `, Frist ${x.expiresAt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}` : ''})`);
  return `\nOffene Bestellungen des Nutzers:\n${o.join('\n') || '- keine'}\nOffene Angebote des Nutzers:\n${f.join('\n') || '- keine'}`;
}

function sanitize(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_CHARS) }));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getOptionalSession().catch(() => null);
    const userId = session?.user?.id ?? null;

    const rl = userId ? await rateLimit(`ai:${userId}`, 'AI') : await rateLimit(`ai-guest:${getClientIP(request)}`, 'AI_GUEST');
    if (!rl.success) {
      return ApiResponse.error(
        userId ? 'Du hast gerade sehr viele Fragen gestellt. Bitte versuche es in einer Stunde erneut.' : 'Limit für Gäste erreicht. Melde dich an, um weiter zu fragen.',
        429,
      );
    }

    const body = await request.json().catch(() => null);
    const messages = sanitize(body?.messages);
    const last = [...messages].reverse().find((m) => m.role === 'user');
    if (!last) return ApiResponse.error('Nachrichten sind erforderlich.');

    const pageContext = typeof body?.pageContext === 'string' ? body.pageContext.slice(0, 200) : '';

    let extra = pageContext ? `\nSeitenkontext: ${pageContext}` : '';
    if (SEARCH_HINT.test(last.content)) {
      const products = await findProducts(last.content).catch(() => []);
      extra += products.length
        ? `\nGefundene Artikel:\n${products.map((p) => `- [${p.title}](/product/${p.id}) ${p.price.toFixed(2)} €${p.brand ? `, ${p.brand}` : ''}${p.size ? `, Gr. ${p.size}` : ''}${p.seller.city ? `, ${p.seller.city}` : ''}`).join('\n')}`
        : '\nGefundene Artikel: keine passenden aktiven Artikel. Schlage eine gespeicherte Suche im Katalog vor.';
    }
    if (userId && ORDER_HINT.test(last.content)) {
      extra += await userContext(userId).catch(() => '');
    } else if (!userId && ORDER_HINT.test(last.content)) {
      extra += '\nDer Nutzer ist nicht angemeldet - für Bestellstatus muss er sich einloggen.';
    }

    const prompt = systemPrompt(extra);

    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        return await streamGemini(messages, prompt);
      } catch (error) {
        console.warn('CSS Assist: Gemini failed', error);
      }
    }
    if (process.env.GROQ_API_KEY) {
      try {
        return await streamGroq(messages, prompt);
      } catch (error) {
        console.warn('CSS Assist: Groq failed', error);
      }
    }

    return ApiResponse.success({
      role: 'assistant',
      content: 'CSS Assist ist gerade nicht erreichbar. Antworten auf die häufigsten Fragen findest du im [Hilfe-Center](/hilfe), persönlich erreichst du uns über das [Kontaktformular](/kontakt).',
    });
  } catch (error: any) {
    console.error('POST /api/ai/chat error:', error);
    return ApiResponse.serverError();
  }
}

async function streamGemini(messages: ChatMessage[], system: string): Promise<Response> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY as string },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok || !response.body) throw new Error(`Gemini ${response.status}`);
  return geminiSseAsOpenAiSse(response);
}

async function streamGroq(messages: ChatMessage[], system: string): Promise<Response> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: system }, ...messages],
      stream: true,
      max_tokens: 700,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.body) throw new Error(`Groq ${response.status}`);
  return new Response(response.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

/**
 * Gemini's SSE payloads differ from OpenAI's. The client parses OpenAI-style
 * `choices[0].delta.content` chunks, so Gemini's stream is re-wrapped.
 */
function geminiSseAsOpenAiSse(geminiResponse: Response): Response {
  const reader = geminiResponse.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          try {
            const json = JSON.parse(payload);
            const text = (json.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
          } catch {
            // ignore malformed chunk
          }
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
