import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/suggest-category — AI suggests top 3 categories for a product
 * Uses keyword matching + optional AI for better results
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const rateLimitResult = await rateLimit(session.user.id, 'AI');
    if (!rateLimitResult.success) {
      return ApiResponse.rateLimited();
    }

    const { title, description } = await request.json();

    if (!title) {
      return ApiResponse.error('Titel ist erforderlich.');
    }

    // Get all categories
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    // Keyword-based scoring
    const text = `${title} ${description || ''}`.toLowerCase();
    const scored = categories.map((cat) => {
      let score = 0;
      const catName = cat.name.toLowerCase();
      const catWords = catName.split(/\s+/);

      // Exact category name match
      if (text.includes(catName)) score += 10;

      // Partial word matches
      for (const word of catWords) {
        if (word.length > 2 && text.includes(word)) score += 3;
      }

      // Bonus for categories with more products (popularity)
      score += Math.min(cat._count.products * 0.1, 2);

      // Prefer leaf categories (no children means more specific)
      if (cat.parentId) score += 1;

      return { ...cat, score };
    });

    // Sort by score, take top 3
    const suggestions = scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        parentName: c.parent?.name || null,
        confidence: c.score > 8 ? 'high' : c.score > 4 ? 'medium' : 'low',
      }));

    // If no keyword matches, try AI
    if (suggestions.length === 0 && (process.env.GROQ_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)) {
      const categoryNames = categories.map((c) => c.name).join(', ');
      const prompt = `Gegeben diese Kategorien: ${categoryNames}

Welche 3 Kategorien passen am besten zu diesem Produkt?
Titel: ${title}
${description ? `Beschreibung: ${description}` : ''}

Antworte NUR mit den exakten Kategorienamen, getrennt durch Komma.`;

      const aiResult = await callAI(prompt);
      if (aiResult) {
        const aiCategories = aiResult.split(',').map((s: string) => s.trim());
        for (const name of aiCategories) {
          const match = categories.find(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          );
          if (match) {
            suggestions.push({
              id: match.id,
              name: match.name,
              emoji: match.emoji,
              parentName: match.parent?.name || null,
              confidence: 'medium' as const,
            });
          }
        }
      }
    }

    return ApiResponse.success({ suggestions: suggestions.slice(0, 3) });
  } catch (error: any) {
    if (error.name === 'AuthError') return ApiResponse.unauthorized();
    console.error('POST /api/ai/suggest-category error:', error);
    return ApiResponse.serverError();
  }
}

async function callAI(prompt: string): Promise<string> {
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100,
          temperature: 0.3,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content || '';
      }
    } catch { /* fallthrough */ }
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 100, temperature: 0.3 },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    } catch { /* fallthrough */ }
  }

  return '';
}
