'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, Loader2, UploadCloud } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';

type ImageSearchResult = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  brand: string | null;
  size: string | null;
  condition: string;
  likes: number;
  ecoCO2Saved: number;
  images: Array<{ url: string }>;
  seller: { name: string | null };
  similarity: number;
};

export default function ImageSearchPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setResults(null);
    setLoading(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/search/image', {
        method: 'POST',
        body: formData,
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Bildsuche fehlgeschlagen.');
      }

      setResults(json.data.items);
    } catch (searchError: any) {
      setError(searchError.message || 'Bildsuche fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <Link href="/catalog" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
          <ArrowLeft size={16} /> Zurueck zum Katalog
        </Link>

        <h1 className="mb-2 text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
          Bildsuche
        </h1>
        <p className="mb-8 max-w-xl text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Lade ein Foto hoch und wir finden aehnliche Artikel im Marktplatz &ndash; basierend auf echtem visuellem
          Abgleich, nicht nur auf Stichworten.
        </p>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <div className="mb-8 flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
          {previewUrl ? (
            <img src={previewUrl} alt="Hochgeladenes Foto" className="h-40 w-40 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'var(--color-primary-50)' }}>
              <Camera size={32} style={{ color: 'var(--color-primary)' }} />
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="btn-mars-earth flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>{loading ? 'Suche laeuft...' : previewUrl ? 'Anderes Foto waehlen' : 'Foto hochladen'}</span>
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {results ? (
          results.length === 0 ? (
            <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Keine aehnlichen Artikel gefunden. Versuche ein anderes Foto oder durchsuche den{' '}
                <Link href="/catalog" className="font-semibold" style={{ color: 'var(--color-primary)' }}>Katalog</Link>.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {results.length} aehnliche Artikel gefunden
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} subtitle={`${Math.round(product.similarity * 100)}% aehnlich`} />
                ))}
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
