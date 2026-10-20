'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapPin, Maximize2, X } from 'lucide-react';

/**
 * Seller location, Kleinanzeigen style: "PLZ Ort" plus a small map with a
 * ~1 km circle around the PLZ centroid - never the address.
 *
 * Privacy / consent: nothing is loaded from OpenStreetMap until the visitor
 * clicks "Karte anzeigen" (the tile request would send their IP to OSM).
 * No map library: a handful of OSM tiles positioned with the Web-Mercator
 * formula is all a static area map needs, and costs nothing in bundle size.
 */

const TILE = 256;
const CIRCLE_METERS = 1000;

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

function metersPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function TileMap({ lat, lng, zoom, height }: { lat: number; lng: number; zoom: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const center = project(lat, lng, zoom);
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const tiles: Array<{ x: number; y: number; px: number; py: number }> = [];
  if (width > 0) {
    const max = 2 ** zoom;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
        if (ty < 0 || ty >= max) continue;
        tiles.push({ x: ((tx % max) + max) % max, y: ty, px: tx * TILE - left, py: ty * TILE - top });
      }
    }
  }
  const r = CIRCLE_METERS / metersPerPixel(lat, zoom);

  return (
    <div ref={ref} className="relative overflow-hidden rounded-xl bg-[#e8eef0]" style={{ height }}>
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${t.x}-${t.y}`}
          src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
          alt=""
          width={TILE}
          height={TILE}
          draggable={false}
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute max-w-none select-none"
          style={{ left: t.px, top: t.py }}
        />
      ))}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          width: r * 2,
          height: r * 2,
          left: width / 2 - r,
          top: height / 2 - r,
          background: 'rgba(45,106,79,.18)',
          border: '2px solid rgba(45,106,79,.75)',
        }}
      />
      <span className="absolute bottom-1 right-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)]">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>-Mitwirkende
      </span>
    </div>
  );
}

export default function SellerLocationMap({
  label,
  lat,
  lng,
  compact = false,
}: {
  label: string | null;
  lat: number | null;
  lng: number | null;
  compact?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big]);

  if (!label) return null;
  const hasCoords = typeof lat === 'number' && typeof lng === 'number';
  const osmLink = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=13/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${label}, Deutschland`)}`;

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        <MapPin size={15} style={{ color: 'var(--color-primary)' }} /> {label}
      </p>

      {hasCoords ? (
        show ? (
          <div className="mt-2">
            <button type="button" onClick={() => setBig(true)} className="group relative block w-full text-left" aria-label="Karte vergrößern">
              <TileMap lat={lat!} lng={lng!} zoom={12} height={compact ? 150 : 190} />
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold shadow group-hover:bg-[var(--color-bg-card)]">
                <Maximize2 size={12} /> Vergrößern
              </span>
            </button>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Ungefährer Bereich, keine genaue Adresse.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShow(true)}
            className="mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-xs transition-colors hover:bg-black/5"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <span>
              <span className="block text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Karte anzeigen</span>
              Lädt Kartenkacheln von OpenStreetMap (dabei wird deine IP-Adresse an OSM übermittelt).
            </span>
            <MapPin size={18} />
          </button>
        )
      ) : (
        <a href={osmLink} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
          Auf der Karte ansehen
        </a>
      )}

      {big && hasCoords ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => setBig(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Karte: ${label}`} className="w-full max-w-3xl rounded-2xl bg-[var(--color-bg-card)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 font-bold"><MapPin size={16} /> {label}</p>
              <button type="button" onClick={() => setBig(false)} aria-label="Schließen" className="rounded-full p-2 hover:bg-[var(--color-bg-secondary)]"><X size={18} /></button>
            </div>
            <TileMap lat={lat!} lng={lng!} zoom={13} height={420} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>Der Kreis zeigt den ungefähren Standort (ca. 1 km). Die genaue Adresse teilt der Verkäufer bei einer Abholung im Chat mit.</span>
              <a href={osmLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline">In OpenStreetMap öffnen</a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
