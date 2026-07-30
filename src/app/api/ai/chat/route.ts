import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `Du bist der cssberlin.de Assistent — ein freundlicher Experte für nachhaltigen Second-Hand-Handel in Berlin und Deutschland.

Dein Wissen umfasst:
- Second-Hand Mode, Vintage-Kleidung, nachhaltige Mode
- Preisberatung für gebrauchte Artikel
- Versand in Deutschland (DHL, Hermes, DPD)
- Käuferschutz und sichere Zahlungen
- Tipps zum Verkaufen und Fotografieren von Artikeln
- Nachhaltigkeit, CO2-Einsparung durch Second-Hand
- Deutsches Verbraucherrecht, Widerrufsrecht, Gewährleistung
- EU DAC7 Steuerregelung für Online-Verkäufer

Antworte immer auf Deutsch, freundlich und hilfsbereit. Halte deine Antworten kurz und praktisch (max 3-4 Sätze pro Punkt).
Wenn du dir bei rechtlichen Fragen nicht sicher bist, empfehle professionelle Beratung.`;

/**
 * POST /api/ai/chat — AI-powered chat assistant with streaming
 * Uses Groq (free: 14.4K req/day) with Google Gemini fallback
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Rate limit: 10 req/hour per user
    const rateLimitResult = await rateLimit(session.user.id, 'AI');
    if (!rateLimitResult.success) {
      return ApiResponse.rateLimited();
    }

    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return ApiResponse.error('Nachrichten sind erforderlich.');
    }

    // Limit conversation length
    const recentMessages = messages.slice(-10);

    // Try Groq first (fastest, free)
    if (process.env.GROQ_API_KEY) {
      try {
        return await streamWithGroq(recentMessages);
      } catch (error) {
        console.warn('Groq failed, trying Gemini fallback:', error);
      }
    }

    // Try Google Gemini fallback
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        return await streamWithGemini(recentMessages);
      } catch (error) {
        console.warn('Gemini also failed:', error);
      }
    }

    // No AI configured — return helpful static response
    return ApiResponse.success({
      role: 'assistant',
      content:
        'Der AI-Assistent ist gerade nicht verfügbar. Bitte versuche es später erneut oder kontaktiere uns über die Hilfe-Seite.',
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/ai/chat error:', error);
    return ApiResponse.serverError();
  }
}

async function streamWithGroq(
  messages: Array<{ role: string; content: string }>
): Promise<Response> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  // Forward the stream
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function streamWithGemini(
  messages: Array<{ role: string; content: string }>
): Promise<Response> {
  // Convert OpenAI-style messages to Gemini format
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
          { role: 'model', parts: [{ text: 'Verstanden! Ich bin bereit zu helfen.' }] },
          ...contents,
        ],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  // Gemini returns JSON array, convert to SSE stream
  const data = await response.json();
  const text = data
    .map((chunk: any) => chunk.candidates?.[0]?.content?.parts?.[0]?.text || '')
    .join('');

  return new Response(
    JSON.stringify({ role: 'assistant', content: text }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
