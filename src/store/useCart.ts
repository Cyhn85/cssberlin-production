'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cssberlin_cart';

/**
 * One module-level store shared by every useCart() caller.
 *
 * This deliberately is not per-component useState: the header badge and the
 * product cards mount separate instances, and with per-instance state they each
 * held their own copy of the cart. Adding from a card then left the badge stale
 * until a reload, and whichever instance wrote to localStorage next overwrote
 * the other one's items. The `storage` event cannot paper over that - the browser
 * fires it only in *other* tabs, never in the tab that made the change.
 */
let cart: string[] = [];
let hydrated = false;
// Signed in: every change is mirrored to /api/cart, so the cart follows the
// account across devices. Logged out it stays a pure browser cart.
let serverSync = false;

function mirror(action: 'add' | 'remove', productId: string) {
  if (!serverSync) return;
  void fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, productId }),
  }).catch(() => undefined);
}

/**
 * Called once after login (see components/cart/CartSync): merges the browser
 * cart into the account and adopts the server's list as the truth.
 */
export async function syncCartWithServer(): Promise<void> {
  hydrate();
  try {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'merge', productIds: cart.slice(0, 50) }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && Array.isArray(json.data?.productIds)) {
      serverSync = true;
      setCart(json.data.productIds);
    }
  } catch {
    // offline or API down: keep the local cart, try again next login
  }
}

export function stopCartServerSync() {
  serverSync = false;
}
const listeners = new Set<() => void>();

// useSyncExternalStore compares snapshots by reference, so this must stay the
// same array until the cart actually changes or it will loop forever.
function getSnapshot(): string[] {
  return cart;
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
    console.error('Failed to persist cart', error);
  }
}

function setCart(next: string[], { write = true } = {}) {
  cart = next;
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
  if (stored.length > 0) setCart(stored, { write: false });
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
    setCart(Array.isArray(next) ? next : [], { write: false });
  });
}

export function useCart() {
  const cartItems = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isLoaded, setIsLoaded] = useState(hydrated);

  useEffect(() => {
    hydrate();
    setIsLoaded(true);
  }, []);

  const toggleCart = useCallback((productId: string) => {
    const removing = cart.includes(productId);
    setCart(removing ? cart.filter((id) => id !== productId) : [...cart, productId]);
    mirror(removing ? 'remove' : 'add', productId);
  }, []);

  const isInCart = useCallback(
    (productId: string) => cartItems.includes(productId),
    [cartItems],
  );

  return { cartItems, toggleCart, isInCart, count: cartItems.length, isLoaded };
}
