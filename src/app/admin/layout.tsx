'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, ShieldAlert, Users, Package, FolderTree, ArrowLeft, UserCog } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Uebersicht', icon: LayoutDashboard },
  { href: '/admin/disputes', label: 'Kaeuferschutz-Faelle', icon: ShieldAlert },
  { href: '/admin/users', label: 'Nutzer', icon: Users },
  { href: '/admin/products', label: 'Artikel', icon: Package },
  { href: '/admin/categories', label: 'Kategorien', icon: FolderTree },
  { href: '/admin/personas', label: 'Verkaeufer-Profile', icon: UserCog },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Wird geladen...</p>
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: 'var(--color-bg)' }}>
        <ShieldAlert size={40} style={{ color: 'var(--color-error, #dc2626)' }} />
        <p className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>Kein Zugriff</p>
        <p className="max-w-sm text-sm" style={{ color: 'var(--color-text-secondary)' }}>Dieser Bereich ist nur fuer Administratoren.</p>
        <Link href="/" className="btn-mars-earth rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: 'var(--color-orange)' }}>
          <span>Zur Startseite</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16" style={{ background: 'var(--color-bg)' }}>
      <div className="container flex flex-col gap-6 py-8 lg:flex-row">
        <aside className="shrink-0 lg:w-56">
          <Link href="/" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            <ArrowLeft size={14} /> Zurueck zur Seite
          </Link>
          <nav className="flex gap-1 overflow-x-auto rounded-2xl border p-2 lg:flex-col lg:overflow-visible" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
                  style={{
                    background: active ? 'var(--color-primary-50)' : 'transparent',
                    color: active ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)',
                  }}
                >
                  <Icon size={16} /> {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
