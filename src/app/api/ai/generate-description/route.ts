import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/generate-description — Generate product description using AI
 * Input: title, brand, category, condition, size
 * Output: Professional German SEO-friendly description
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rateLimitResult = await rateLimit(session.user.id, 'AI');
    if (!rateLimitResult.success) {
      return ApiResponse.rateLimited();
    }

    const { title, brand, category, condition, size } = await request.json();

    if (!title) {
      return ApiResponse.error('Titel ist erforderlich.');
    }

    const conditionMap: Record<string, string> = {
      NEW_WITH_TAGS: 'Neu mit Etikett',
      NEW_WITHOUT_TAGS: 'Neu ohne Etikett',
      VERY_GOOD: 'Sehr gut',
      GOOD: 'Gut',
      ACCEPTABLE: 'Akzeptabel',
    };

    const prompt = `Erstelle eine professionelle, ansprechende Produktbeschreibung für einen Second-Hand-Artikel auf cssberlin.de (einem nachhaltigen Marktplatz).

Artikeldetails:
- Titel: ${title}
${brand ? `- Marke: ${brand}` : ''}
${category ? `- Kategorie: ${category}` : ''}
${condition ? `- Zustand: ${conditionMap[condition] || condition}` : ''}
${size ? `- Größe: ${size}` : ''}

Regeln:
- Auf Deutsch schreiben
- 2-3 kurze Absätze
- Professionell aber freundlich
- Nachhaltigkeitsaspekt kurz erwähnen
- Keine erfundenen Details hinzufügen
- Max 150 Wörter`;

    const description = await callAI(prompt);
    return ApiResponse.success({ description });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/ai/generate-description error:', error);
    return ApiResponse.serverError();
  }
}

async function callAI(prompt: string): Promise<string> {
  // Try Groq first
  if (process.env.GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || '';
      }
    } catch (e) {
      console.warn('Groq failed for description generation:', e);
    }
  }

  // Try Gemini fallback
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch (e) {
      console.warn('Gemini failed for description generation:', e);
    }
  }

  return '';
}
