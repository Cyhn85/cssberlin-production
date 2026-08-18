import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

const IDENTITY_RULE = `Du heisst "CSS Assist", der Assistent von cssberlin.de. Wenn jemand nach deinem Namen, Modell oder Anbieter fragt, antworte ausschliesslich mit "CSS Assist" - nenne niemals den Namen eines zugrunde liegenden KI-Anbieters oder Modells, auch nicht andeutungsweise.`;

const SYSTEM_PROMPT = `${IDENTITY_RULE}

Du bist ein extrem natürlicher und freundlicher Support-Mitarbeiter / Verkäufer für cssberlin.de (Nachhaltiger Second-Hand Marktplatz).
Verhalte dich EXAKT wie ein echter Mensch aus Berlin.

Dein Wissen umfasst:
- Second-Hand Mode, Vintage-Kleidung, nachhaltige Mode
- Preisberatung fuer gebrauchte Artikel
- Versand in Deutschland (DHL, Hermes, DPD)
- Kaeuferschutz und sichere Zahlungen

CRITICAL RULES (STEALTH PROMPTING):
1. Schreibe niemals wie ein typischer KI-Assistent. Verwende keine formellen Aufzählungen oder sture Einleitungen ("Ich helfe dir gerne dabei").
2. Nutze eine lockere, alltägliche Sprache, als ob du im Chat mit einem Käufer oder Verkäufer auf Kleinanzeigen sprichst.
3. Verwende gelegentlich Wörter wie "Klar", "Schau mal", "Ehrlich gesagt", "Macht Sinn".
4. Keine roboterhaften Schlussformeln. Beende Sätze natürlich.
5. Fasse dich sehr kurz. Niemand liest gerne Romane im Chat (max 2-3 kurze Sätze).
6. Wenn es um rechtliche Fragen geht, verweise höflich auf den Support oder die AGBs, anstatt eine Rechtsberatung zu imitieren.`;

const REFINE_INSTRUCTION = `${IDENTITY_RULE}

Du bist die Qualitaetskontrolle von CSS Assist. Du bekommst die Nutzerfrage, den Seitenkontext und einen ersten Antwortentwurf. Pruefe den Entwurf auf Richtigkeit (v. a. bei Zahlen, Recht, Versand) und Ton, korrigiere Fehler, kuerze wenn moeglich. Gib NUR die finale, ueberarbeitete Antwort auf Deutsch zurueck - keine Meta-Kommentare, keine Erwaehnung, dass es einen Entwurf gab.`;

type ChatMessage = { role: string; content: string };

/**
 * POST /api/ai/chat — CSS Assist chat.
 * Two-stage pipeline: a fast Groq draft, refined/verified by Gemini before
 * it reaches the user. If only one provider is configured, that provider
 * answers directly (still fully functional, just single-stage).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rateLimitResult = await rateLimit(session.user.id, 'AI');
    if (!rateLimitResult.success) {
      return ApiResponse.rateLimited();
    }

    const { messages, pageContext } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return ApiResponse.error('Nachrichten sind erforderlich.');
    }

    const recentMessages: ChatMessage[] = messages.slice(-10);
    const contextualSystemPrompt = pageContext
      ? `${SYSTEM_PROMPT}\n\nAktueller Seitenkontext (nutze ihn, wenn er zur Frage passt, dranghe ihn dem Nutzer nicht auf): ${pageContext}`
      : SYSTEM_PROMPT;

    const hasGroq = Boolean(process.env.GROQ_API_KEY);
    const hasGemini = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

    if (hasGroq && hasGemini) {
      try {
        const draft = await getGroqDraft(recentMessages, contextualSystemPrompt);
        return await streamGeminiRefine(recentMessages, contextualSystemPrompt, draft);
      } catch (error) {
        console.warn('Two-stage CSS Assist pipeline failed, falling back to single provider:', error);
      }
    }

    if (hasGroq) {
      try {
        return await streamWithGroq(recentMessages, contextualSystemPrompt);
      } catch (error) {
        console.warn('Groq failed:', error);
      }
    }

    if (hasGemini) {
      try {
        return await streamGeminiDirect(recentMessages, contextualSystemPrompt);
      } catch (error) {
        console.warn('Gemini failed:', error);
      }
    }

    return ApiResponse.success({
      role: 'assistant',
      content:
        'CSS Assist ist gerade nicht verfuegbar. Bitte versuche es spaeter erneut oder kontaktiere uns ueber die Hilfe-Seite.',
    });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/ai/chat error:', error);
    return ApiResponse.serverError();
  }
}

async function getGroqDraft(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
      max_tokens: 700,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function streamGeminiRefine(
  messages: ChatMessage[],
  systemPrompt: string,
  draft: string
): Promise<Response> {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: REFINE_INSTRUCTION }] },
          { role: 'model', parts: [{ text: 'Verstanden.' }] },
          {
            role: 'user',
            parts: [
              {
                text: `Systemkontext:\n${systemPrompt}\n\nNutzerfrage:\n${lastUserMessage}\n\nEntwurf:\n${draft}`,
              },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 900, temperature: 0.4 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini refine error: ${response.status}`);
  }

  return streamGeminiSseAsOpenAiSse(response);
}

async function streamGeminiDirect(messages: ChatMessage[], systemPrompt: string): Promise<Response> {
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Verstanden! Ich bin bereit zu helfen.' }] },
          ...contents,
        ],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  return streamGeminiSseAsOpenAiSse(response);
}

/**
 * Gemini's SSE payloads use a different JSON shape than OpenAI's. The
 * frontend already parses OpenAI-style `choices[0].delta.content` chunks
 * (reused from the Groq path), so we re-wrap Gemini's stream into that same
 * shape instead of teaching the client two formats.
 */
function streamGeminiSseAsOpenAiSse(geminiResponse: Response): Response {
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
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              const openAiChunk = { choices: [{ delta: { content: text } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
            }
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

async function streamWithGroq(messages: ChatMessage[], systemPrompt: string): Promise<Response> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
