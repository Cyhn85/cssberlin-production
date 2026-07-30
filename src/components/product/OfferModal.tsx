'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

type OfferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  productPrice: number;
  productImage: string;
  onSuccess?: () => void;
};

export default function OfferModal({
  isOpen,
  onClose,
  productId,
  productTitle,
  productPrice,
  productImage,
  onSuccess,
}: OfferModalProps) {
  const [offerType, setOfferType] = useState<'10' | '20' | 'custom'>('custom');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minOffer = productPrice * 0.6;
  const tenPercentOff = productPrice * 0.9;
  const twentyPercentOff = productPrice * 0.8;

  useEffect(() => {
    if (!isOpen) return;
    setOfferType('custom');
    setCustomPrice('');
    setNote('');
    setError('');
    setSuccess('');
    setIsSubmitting(false);
  }, [isOpen]);

  const handleOfferTypeSelect = (type: '10' | '20' | 'custom') => {
    setOfferType(type);
    setError('');
    setSuccess('');

    if (type === '10') setCustomPrice(tenPercentOff.toFixed(2));
    else if (type === '20') setCustomPrice(twentyPercentOff.toFixed(2));
    else setCustomPrice('');
  };

  const handleCustomPriceChange = (value: string) => {
    setCustomPrice(value);
    setOfferType('custom');
    setSuccess('');

    const numValue = Number(value.replace(',', '.'));
    if (!Number.isNaN(numValue) && numValue < minOffer) {
      setError(`Der Minimalwert liegt bei ${minOffer.toFixed(2).replace('.', ',')} EUR.`);
      return;
    }

    setError('');
  };

  const parsedPrice = Number(customPrice.replace(',', '.'));
  const isSubmitDisabled = !customPrice || Number.isNaN(parsedPrice) || parsedPrice < minOffer || isSubmitting;

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          offeredPrice: parsedPrice,
          message: note.trim() || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || 'Angebot konnte nicht gesendet werden.');
        return;
      }

      setSuccess('Angebot erfolgreich gesendet.');
      onSuccess?.();
      window.setTimeout(() => {
        onClose();
      }, 700);
    } catch {
      setError('Netzwerkfehler. Bitte versuche es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h2 className="ml-6 flex-1 text-center text-lg font-bold text-[var(--color-text)]">Preis vorschlagen</h2>
            <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                {productImage ? (
                  <img src={productImage} alt={productTitle} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-[var(--color-primary-light)] opacity-20" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-text)]">{productTitle}</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Listenpreis: {productPrice.toFixed(2).replace('.', ',')} EUR
                </p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-3">
              <button
                onClick={() => handleOfferTypeSelect('10')}
                className={`rounded-xl border-2 p-3 transition-colors ${offerType === '10' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="block font-bold text-[var(--color-text)]">{tenPercentOff.toFixed(2).replace('.', ',')} EUR</span>
                <span className="text-xs text-[var(--color-primary)]">10% weniger</span>
              </button>

              <button
                onClick={() => handleOfferTypeSelect('20')}
                className={`rounded-xl border-2 p-3 transition-colors ${offerType === '20' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="block font-bold text-[var(--color-text)]">{twentyPercentOff.toFixed(2).replace('.', ',')} EUR</span>
                <span className="text-xs text-[var(--color-primary)]">20% weniger</span>
              </button>

              <button
                onClick={() => handleOfferTypeSelect('custom')}
                className={`rounded-xl border-2 p-3 transition-colors ${offerType === 'custom' ? 'border-[var(--color-primary)] bg-[var(--color-primary-50)]' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className="block font-bold text-[var(--color-text)]">Individuell</span>
                <span className="text-xs text-[var(--color-primary)]">Eigener Preis</span>
              </button>
            </div>

            <div className="mb-2 border-b border-gray-200 pb-2">
              <input
                type="text"
                value={customPrice}
                onChange={(event) => handleCustomPriceChange(event.target.value)}
                placeholder="0,00"
                className="w-full bg-transparent text-2xl font-bold outline-none text-[var(--color-text)]"
              />
            </div>

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Kurze Nachricht an den Verkaeufer (optional)"
              className="mt-4 min-h-[96px] w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[var(--color-primary)]"
            />

            {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
            {success ? <p className="mt-3 text-sm text-green-600">{success}</p> : null}

            <p className="mb-6 mt-4 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              Mindestangebot: {minOffer.toFixed(2).replace('.', ',')} EUR. Offene Angebote koennen vom Verkaeufer angenommen, abgelehnt oder mit einem Gegenangebot beantwortet werden.
            </p>

            <button
              disabled={isSubmitDisabled}
              onClick={handleSubmit}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 font-bold text-white transition-all ${isSubmitDisabled ? 'cursor-not-allowed bg-gray-400 opacity-50' : 'btn-mars-earth hover:scale-[1.02]'}`}
              style={{ background: isSubmitDisabled ? '#9ca3af' : 'var(--color-orange)' }}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
              {parsedPrice > 0 && !Number.isNaN(parsedPrice)
                ? `${parsedPrice.toFixed(2).replace('.', ',')} EUR bieten`
                : 'Bitte Preis eingeben'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
