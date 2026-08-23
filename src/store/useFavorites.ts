'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cssberlin_favorites';

/**
 * One module-level store shared by every useFavorites() caller.
 *
 * Same reasoning as useCart: the header badge and each product card mount
 * separate instances. With per-instance useState they each kept their own copy,
 * so favoriting from a card left the header counter stale until a reload, and
 * whichever instance wrote to localStorage last overwrote the others. The
 * `storage` event cannot paper over that - the browser fires it only in *other*
 * tabs, never in the tab that made the change.
 */
let favorites: string[] = [];
let hydrated = false;
const listeners = new Set<() => void>();

// useSyncExternalStore compares snapshots by reference, so this must stay the
// same array until the list actually changes or it will loop forever.
function getSnapshot(): string[] {
  return favorites;
}

const SERVER_SNAPSHOT: string[] = [];
function getServerSnapshot(): string[] {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

function read(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(next: string[]) {
  try {
    if (next.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to persist favorites', error);
  }
}

function setFavorites(next: string[], { write = true } = {}) {
  favorites = next;
  if (write) persist(next);
  emit();
}

/**
 * Reads localStorage once on the client. Kept out of the render path so the
 * hydration render still matches the server's empty snapshot.
 */
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  const stored = read();
  if (stored.length > 0) setFavorites(stored, { write: false });
}

if (typeof window !== 'undefined') {
  // Cross-tab: only ever mirrors what the other tab already wrote.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    let next: string[] = [];
    try {
      next = event.newValue ? JSON.parse(event.newValue) : [];
    } catch {
      next = [];
    }
    setFavorites(Array.isArray(next) ? next : [], { write: false });
  });
}

/**
 * Mirrors the toggle to the server so a favorite survives a device change.
 *
 * Guests have no row to write, so 401 is their expected answer and must NOT
 * roll the local list back - localStorage is the only place a guest's
 * favorites live. Any other failure is logged, not surfaced: a favorite is not
 * worth a blocking error dialog in front of a shopper.
 */
async function syncToServer(productId: string) {
  try {
    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    });
    if (!res.ok && res.status !== 401) {
      console.warn('Favorite sync failed with status', res.status);
    }
  } catch (error) {
    console.warn('Favorite sync failed', error);
  }
}

export function useFavorites() {
  const localFavorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isLoaded, setIsLoaded] = useState(hydrated);

  useEffect(() => {
    hydrate();
    setIsLoaded(true);
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(
      favorites.includes(productId)
        ? favorites.filter((id) => id !== productId)
        : [...favorites, productId],
    );
    void syncToServer(productId);
  }, []);

  const isFavorited = useCallback(
    (productId: string) => localFavorites.includes(productId),
    [localFavorites],
  );

  return {
    localFavorites,
    toggleFavorite,
    isFavorited,
    count: localFavorites.length,
    isLoaded,
  };
}
