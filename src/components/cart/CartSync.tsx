'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { syncCartWithServer, stopCartServerSync } from '@/store/useCart';
import { replaceFavorites } from '@/store/useFavorites';

const FAV_KEY = 'cssberlin_favorites';

/**
 * After login: merge the guest cart and guest favourites into the account
 * (Vinted/Kleinanzeigen keep what you collected before signing in).
 * Favourites: POST /api/favorites toggles, so only ids not yet saved are sent,
 * and the local store is then replaced by the account's list.
 */
export default function CartSync() {
  const { status } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      done.current = false;
      stopCartServerSync();
      return;
    }
    if (status !== 'authenticated' || done.current) return;
    done.current = true;

    void syncCartWithServer();

    (async () => {
      let local: string[] = [];
      try {
        const raw = localStorage.getItem(FAV_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        local = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
      } catch { /* private mode */ }
      const res = await fetch('/api/favorites').then((r) => r.json()).catch(() => null);
      if (!res?.success || !Array.isArray(res.data)) return;
      const server: string[] = res.data.map((p: { id: string }) => p.id);
      const have = new Set(server);
      const missing = local.filter((id) => !have.has(id)).slice(0, 50);
      for (const id of missing) {
        // POST toggles - only ids the account does not have yet are sent
        await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: id }) }).catch(() => undefined);
      }
      // local store now mirrors the account, so the next heart click toggles the right way
      replaceFavorites([...server, ...missing]);
    })();
  }, [status]);

  return null;
}
