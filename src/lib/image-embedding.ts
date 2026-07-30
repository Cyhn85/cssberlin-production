/**
 * Real image embeddings via Gemini's multimodal embedding model
 * (models/gemini-embedding-2, confirmed to accept inline image data).
 * Used for genuine visual similarity search — not a keyword/tag heuristic.
 */

const EMBED_MODEL = 'gemini-embedding-2';

export async function embedImageFromBase64(base64Data: string, mimeType: string): Promise<number[] | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: {
            parts: [{ inline_data: { mime_type: mimeType, data: base64Data } }],
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn('Gemini embedding request failed:', response.status);
      return null;
    }

    const json = await response.json();
    const values = json?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch (error) {
    console.warn('Gemini embedding request error:', error);
    return null;
  }
}

export async function embedImageFromUrl(url: string): Promise<number[] | null> {
  try {
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) return null;
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return embedImageFromBase64(buffer.toString('base64'), mimeType);
  } catch (error) {
    console.warn('Failed to fetch/embed image from URL:', url, error);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
