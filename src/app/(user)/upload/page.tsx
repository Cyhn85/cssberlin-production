'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { UploadCloud, X, Info, Leaf, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { useUploadThing } from '@/lib/uploadthing';
import { labelToCondition } from '@/lib/utils/condition-map';
import type { Category } from '@/types/api';
import { Checkbox } from '@/components/ui/checkbox';

const CONDITIONS = [
  'Neu mit Etikett', 'Neu', 'Sehr gut', 'Gut', 'Akzeptabel'
];

const SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Einheitsgröße',
  '36', '37', '38', '39', '40', '41', '42', '43', '44'
];

// 1 Titelbild + zwei Reihen à 4 Vorschaubilder = kein leerer Platz im Galerie-Block.
const MAX_PHOTOS = 9;

export default function ProductUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [newProductId, setNewProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Categories from DB
  const [categoriesFromDB, setCategoriesFromDB] = useState<Category[]>([]);
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.flat) {
          setCategoriesFromDB(res.data.flat);
        } else if (res.success && Array.isArray(res.data)) {
          setCategoriesFromDB(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    category: '', // Now stores category ID
    brand: '',
    size: '',
    condition: '',
    shippingCost: '4.50',
    allowOffers: true,
  });

  // ══════════ Uploadthing Image Upload ══════════
  const { startUpload, isUploading } = useUploadThing('productImage', {
    onClientUploadComplete: (res) => {
      const newUrls = res.map(file => file.url);
      setImages(prev => [...prev, ...newUrls].slice(0, MAX_PHOTOS));
    },
    onUploadError: (err) => {
      setError(`Fehler beim Hochladen: ${err.message}`);
    },
  });

  const handleImageUpload = () => {
    if (images.length >= MAX_PHOTOS) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files).slice(0, MAX_PHOTOS - images.length);
    startUpload(files);
    e.target.value = ''; // Reset so same file can be selected again
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // ══════════ AI Description Generator ══════════
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const generateAiDescription = async () => {
    if (!formData.title) return alert('Bitte gib zuerst einen Titel ein.');
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          brand: formData.brand || undefined,
          category: categoriesFromDB.find(c => c.id === formData.category)?.name || undefined,
          condition: labelToCondition[formData.condition] || undefined,
          size: formData.size || undefined,
        }),
      });
      const result = await res.json();
      if (result.success && result.data?.description) {
        setFormData(prev => ({ ...prev, description: result.data.description }));
      }
    } catch {
      // Fallback: generate locally
      const brands = formData.brand ? `${formData.brand} ` : '';
      const desc = `Verkaufe hier mein(e) ${brands}${formData.title}. Der Artikel ist in einem ${formData.condition.toLowerCase()} Zustand.\n\nBei Fragen gerne melden! #nachhaltig #secondhand #berlin`;
      setFormData(prev => ({ ...prev, description: desc }));
    } finally {
      setIsAiGenerating(false);
    }
  };

  // ══════════ AI Price Suggestion ══════════
  const [suggestedPrice, setSuggestedPrice] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  useEffect(() => {
    if (!formData.title || !formData.condition) {
      setSuggestedPrice(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setPriceLoading(true);
      try {
        const res = await fetch('/api/ai/price-suggestion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title,
            brand: formData.brand || undefined,
            categoryId: formData.category || undefined,
            condition: labelToCondition[formData.condition] || undefined,
            originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
          }),
        });
        const result = await res.json();
        if (result.success && result.data?.suggestedPrice) {
          setSuggestedPrice(result.data.suggestedPrice.toFixed(2));
        }
      } catch {
        // Fallback: simple client-side calc
        if (formData.originalPrice) {
          const base = parseFloat(formData.originalPrice);
          let multiplier = 0.5;
          if (formData.condition.includes('Etikett')) multiplier = 0.75;
          else if (formData.condition === 'Neu') multiplier = 0.65;
          else if (formData.condition === 'Sehr gut') multiplier = 0.55;
          else if (formData.condition === 'Akzeptabel') multiplier = 0.3;
          setSuggestedPrice((base * multiplier).toFixed(2));
        }
      } finally {
        setPriceLoading(false);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [formData.title, formData.brand, formData.condition, formData.originalPrice, formData.category]);

  // ══════════ Publish Product ══════════
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const body = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : undefined,
        categoryId: formData.category,
        condition: labelToCondition[formData.condition] || formData.condition,
        size: formData.size || undefined,
        brand: formData.brand || undefined,
        shippingCost: parseFloat(formData.shippingCost),
        imageUrls: images,
        allowOffers: formData.allowOffers,
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.success && result.data?.id) {
        setNewProductId(result.data.id);
        setStep(3);
      } else {
        setError(result.error || 'Fehler beim Veröffentlichen. Bitte versuche es erneut.');
      }
    } catch {
      setError('Netzwerkfehler. Bitte überprüfe deine Verbindung.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
            Artikel verkaufen
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            Lade Fotos hoch, beschreibe deinen Artikel und verdiene Geld, während du die Umwelt schützt.
          </p>
        </div>

        {/* Hidden file input for Uploadthing */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFileChange}
        />

        {/* ── SUCCESS STEP ── */}
        {step === 3 && (
          <div className="p-12 text-center rounded-3xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={48} />
              </div>
            </motion.div>
            <h2 className="text-2xl font-bold mb-2">Dein Artikel ist online!</h2>
            <p className="text-sm mb-8 text-gray-500">
              Käufer können deinen Artikel jetzt finden. Du wirst benachrichtigt, sobald es Neuigkeiten gibt.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              {newProductId && (
                <button
                  onClick={() => router.push(`/product/${newProductId}`)}
                  className="px-6 py-3 rounded-xl font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  Zum Artikel
                </button>
              )}
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 rounded-xl border font-bold hover:bg-gray-50 transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
              >
                Zur Startseite
              </button>
              <button
                onClick={() => {
                  setStep(1);
                  setImages([]);
                  setNewProductId(null);
                  setFormData({ title: '', description: '', price: '', originalPrice: '', category: '', brand: '', size: '', condition: '', shippingCost: '4.50', allowOffers: true });
                }}
                className="px-6 py-3 rounded-xl font-bold text-white btn-mars-earth"
                style={{ background: 'var(--color-orange)' }}
              >
                <span>Weiteren Artikel hochladen</span>
              </button>
            </div>
          </div>
        )}

        {/* ── FORM ── */}
        {step < 3 && (
          <form onSubmit={handlePublish} className="space-y-8">

            {/* Error Banner */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Fehler</span>
                  {error}
                </div>
                <button type="button" onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
              </div>
            )}

            {/* 1. Photos Section */}
            <div className="p-6 md:p-8 rounded-3xl" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Fotos hinzufügen</h2>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{images.length} / {MAX_PHOTOS} Fotos</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="aspect-square relative rounded-xl overflow-hidden group border" style={{ borderColor: 'var(--color-border)' }}>
                    <img src={img} alt={`Foto ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
                    {i === 0 && <span className="absolute bottom-2 left-2 text-[10px] bg-white px-2 py-0.5 rounded shadow-sm font-semibold">Titelbild</span>}
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:bg-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {images.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={handleImageUpload}
                    disabled={isUploading}
                    className="aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)] disabled:opacity-50"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {isUploading ? (
                      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    ) : (
                      <>
                        <UploadCloud size={24} style={{ color: 'var(--color-primary)' }} className="mb-2" />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-primary-dark)' }}>Hochladen</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="mt-4 p-3 rounded-lg flex gap-3 bg-orange-50/50 border border-orange-100">
                <Info size={16} className="text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-800">
                  <span className="font-bold block mb-1">Tipp: 360°-Ansicht</span>
                  Lade mindestens 6 Fotos hoch – aufgenommen von vorne, hinten, oben, unten sowie von links und rechts – und dein Artikel kann in einer 360°-Rundumansicht dargestellt werden.
                </p>
              </div>
            </div>

            {/* 2. Details Section */}
            <div className="p-6 md:p-8 rounded-3xl space-y-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>Details</h2>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Titel</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 bg-transparent"
                  style={{ borderColor: 'var(--color-border)' }}
                  placeholder="z.B. Weißes Zara Hemd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex justify-between" style={{ color: 'var(--color-text)' }}>
                  <span>Beschreibung</span>
                  <button
                    type="button"
                    onClick={generateAiDescription}
                    disabled={isAiGenerating}
                    className={`text-[var(--color-primary)] text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${isAiGenerating ? 'opacity-50 animate-pulse' : 'hover:scale-105'}`}
                  >
                    <Sparkles size={12} className={isAiGenerating ? 'animate-spin' : ''} />
                    {isAiGenerating ? 'Generiere...' : 'Mit KI generieren'}
                  </button>
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-4 rounded-xl border outline-none focus:ring-2 min-h-[140px] resize-y bg-transparent"
                  style={{ borderColor: 'var(--color-border)' }}
                  placeholder="Beschreibe Farbe, Material, Zustand und eventuelle Mängel..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    Kategorie
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 bg-transparent appearance-none"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <option value="" disabled>Bitte wählen...</option>
                    {categoriesFromDB.length > 0
                      ? categoriesFromDB.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                        </option>
                      ))
                      : ['Damen', 'Herren', 'Kinder', 'Wohnen', 'Elektronik', 'Sport', 'Vintage'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Marke</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 bg-transparent"
                    style={{ borderColor: 'var(--color-border)' }}
                    placeholder="z.B. Nike"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Größe</label>
                  <select
                    required
                    value={formData.size}
                    onChange={e => setFormData({ ...formData, size: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 bg-transparent appearance-none"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <option value="" disabled>Bitte wählen...</option>
                    {SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Zustand</label>
                  <select
                    required
                    value={formData.condition}
                    onChange={e => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border outline-none focus:ring-2 bg-transparent appearance-none"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <option value="" disabled>Bitte wählen...</option>
                    {CONDITIONS.map(cd => <option key={cd} value={cd}>{cd}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Pricing Section */}
            <div className="p-6 md:p-8 rounded-3xl space-y-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Preis</h2>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-dark)] text-xs font-bold">
                  <Leaf size={14} /> 0% Verkaufsgebühr
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                  <label className="block text-sm font-medium mb-2 flex justify-between" style={{ color: 'var(--color-text)' }}>
                    <span>Dein Preis (€)</span>
                    {priceLoading && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> Berechne...
                      </span>
                    )}
                    {!priceLoading && suggestedPrice && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, price: suggestedPrice })}
                        className="text-[var(--color-primary)] text-[10px] font-bold flex items-center gap-1 hover:scale-105 transition-transform"
                      >
                        <Sparkles size={10} /> Empfehlung: {suggestedPrice}€
                      </button>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      step={0.5}
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      className="w-full h-14 pl-4 pr-12 rounded-xl border outline-none focus:ring-2 bg-transparent text-xl font-bold"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
                      placeholder="0.00"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold" style={{ color: 'var(--color-text-muted)' }}>€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>Neupreis (€) <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      value={formData.originalPrice}
                      onChange={e => setFormData({ ...formData, originalPrice: e.target.value })}
                      className="w-full h-14 pl-4 pr-12 rounded-xl border outline-none focus:ring-2 bg-transparent opacity-70"
                      style={{ borderColor: 'var(--color-border)' }}
                      placeholder="0.00"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold opacity-70" style={{ color: 'var(--color-text-muted)' }}>€</span>
                  </div>
                  <p className="text-[10px] mt-2 text-gray-400 italic">Hilft uns, dir den besten Preis vorzuschlagen.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-gray-50/50 flex items-start gap-3" style={{ borderColor: 'var(--color-border)' }}>
                <Checkbox
                  id="negotiable"
                  className="mt-1"
                  checked={formData.allowOffers}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowOffers: checked === true })}
                />
                <label htmlFor="negotiable" className="text-sm">
                  <span className="font-bold block text-[var(--color-text)] mb-0.5">Preisvorschläge erlauben</span>
                  <span className="text-[var(--color-text-secondary)]">Käufer können dir Angebote machen. Du kannst sie annehmen, ablehnen oder ein Gegenangebot senden.</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
              <button
                type="button"
                className="px-6 py-4 rounded-xl font-bold transition-colors hover:bg-gray-100 disabled:opacity-50"
                style={{ color: 'var(--color-text)' }}
                disabled={loading}
              >
                Als Entwurf speichern
              </button>
              <button
                type="submit"
                className="px-10 py-4 rounded-xl font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 min-w-[200px] btn-mars-earth flex justify-center items-center gap-2"
                style={{ background: 'var(--color-orange)' }}
                disabled={loading || isUploading || images.length === 0}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> <span>Wird veröffentlicht...</span></>
                ) : (
                  <span>Veröffentlichen</span>
                )}
              </button>
            </div>

            {images.length === 0 && !isUploading && (
              <p className="text-right text-xs text-red-500 font-medium">Bitte lade mindestens ein Foto hoch.</p>
            )}

          </form>
        )}
      </div>
    </div>
  );
}
