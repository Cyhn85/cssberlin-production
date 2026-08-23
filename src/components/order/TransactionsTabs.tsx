'use client';

import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

/**
 * One shell over the two halves of a trade.
 *
 * Buying and selling lived on two unrelated pages reachable only from the
 * account menu, each with its own heading and no way across. On a C2C
 * marketplace the same person does both, usually in the same session, so the
 * two belong under one roof with a switch - the way every marketplace with
 * two-sided users presents it.
 *
 * These stay two routes rather than one page with client state: each side has
 * its own data fetch and its own deep links from e-mails and notifications
 * (/purchases/[id], /sales/[id]), and collapsing them would break those.
 */

const TABS = [
  { href: '/purchases', label: 'Einkäufe', icon: ArrowDownLeft },
  { href: '/sales', label: 'Verkäufe', icon: ArrowUpRight },
] as const;

export default function TransactionsTabs({ active }: { active: '/purchases' | '/sales' }) {
  return (
    <nav
      className="mb-6 flex items-center gap-6 border-b"
      style={{ borderColor: 'var(--color-border)' }}
      aria-label="Transaktionen"
    >
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className="relative inline-flex min-h-[44px] items-center gap-2 text-sm font-bold"
            style={{ color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            <tab.icon size={16} />
            {tab.label}
            {isActive ? (
              <span
                className="absolute -bottom-px left-0 right-0 h-0.5"
                style={{ background: 'var(--color-primary)' }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
