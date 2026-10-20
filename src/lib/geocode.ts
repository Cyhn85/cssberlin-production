/**
 * PLZ -> Ort + Koordinate (Mittelpunkt des PLZ-Gebiets) über OpenStreetMap Nominatim.
 *
 * Serverseitig, nur beim Speichern des Profils, mit Cache: Nominatim erlaubt
 * höchstens 1 Anfrage/Sekunde und verlangt einen eindeutigen User-Agent. Es wird
 * nur die PLZ gesendet, nie Name oder Straße. Schlägt die Abfrage fehl, wird der
 * vom Nutzer eingegebene Ort ohne Koordinate gespeichert (Karte zeigt dann nur
 * den Link, keine Kachel).
 */
type GeoResult = { city: string | null; district: string | null; lat: number; lng: number };

const cache = new Map<string, GeoResult | null>();
let lastCall = 0;

export async function geocodePostalCode(postalCode: string): Promise<GeoResult | null> {
  if (!/^\d{5}$/.test(postalCode)) return null;
  if (cache.has(postalCode)) return cache.get(postalCode)!;

  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${postalCode}&country=de&format=jsonv2&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'cssberlin.de/1.0 (info@cssberlin.de)', 'Accept-Language': 'de' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string; address?: Record<string, string> }>;
    const row = rows[0];
    if (!row) {
      cache.set(postalCode, null);
      return null;
    }
    const a = row.address || {};
    const result: GeoResult = {
      city: a.city || a.town || a.village || a.municipality || null,
      district: a.city_district || a.borough || a.suburb || null,
      lat: Math.round(Number(row.lat) * 1000) / 1000, // ~100 m: centroid only, never more precise
      lng: Math.round(Number(row.lon) * 1000) / 1000,
    };
    cache.set(postalCode, result);
    return result;
  } catch (error) {
    console.warn('geocodePostalCode failed', postalCode, error);
    return null;
  }
}

/** "13593 Berlin-Spandau" / "80331 München" - what a public profile shows. */
export function publicLocationLabel(u: { postalCode?: string | null; city?: string | null; location?: string | null }) {
  if (u.postalCode && u.city) return `${u.postalCode} ${u.city}`;
  if (u.city) return u.city;
  return u.location?.trim() || null;
}
