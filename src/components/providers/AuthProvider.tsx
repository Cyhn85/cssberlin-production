'use client';

import { SessionProvider } from 'next-auth/react';
import CartSync from '@/components/cart/CartSync';

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // refetchInterval closes the last gap in the suspension path. The `jwt`
    // callback re-reads role/isSuspended from the database, but it only runs
    // when the session is actually read - proxy.ts merely decodes the existing
    // cookie. Without a poll, a tab left open keeps its old cookie and a banned
    // user carries on until they reload or refocus the window. Five minutes is
    // one extra /api/auth/session call per open tab per five minutes.
    return (
        <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus>
            <CartSync />
            {children}
        </SessionProvider>
    );
}
