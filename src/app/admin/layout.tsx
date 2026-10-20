'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LayoutDashboard, ShieldAlert, Users, Package, FolderTree, ArrowLeft, UserCog, LogOut, Settings, Bell } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Übersicht', icon: LayoutDashboard },
  { href: '/admin/disputes', label: 'Käuferschutz-Fälle', icon: ShieldAlert },
  { href: '/admin/users', label: 'Nutzer', icon: Users },
  { href: '/admin/products', label: 'Artikel', icon: Package },
  { href: '/admin/categories', label: 'Kategorien', icon: FolderTree },
  { href: '/admin/personas', label: 'Verkäufer-Profile', icon: UserCog },
  { href: '/admin/kontakt', label: 'Kontakt & Meldungen', icon: Bell },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500">Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center bg-[#F9FAFB]">
        <div className="rounded-full bg-red-100 p-4">
          <ShieldAlert size={48} className="text-red-600" />
        </div>
        <div>
          <p className="text-2xl font-extrabold text-gray-900">Zugriff verweigert</p>
          <p className="mt-2 max-w-sm text-sm text-gray-500">Dieser Bereich ist ausschließlich für Administratoren des cssberlin Netzwerks zugänglich.</p>
        </div>
        <Link href="/" className="mt-4 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105" style={{ background: 'var(--color-orange)' }}>
          Zurück zum Marktplatz
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-gray-900 font-sans">
      {/* Top Navbar (Admin Chrome) */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white shadow-sm transition-transform group-hover:rotate-12">
              <span className="font-bold font-display text-lg">C</span>
            </div>
            <span className="hidden sm:block text-lg font-bold tracking-tight">cssberlin <span className="font-light text-gray-500">Workspace</span></span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
          <div className="h-6 w-px bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <img src={session.user.image || `https://ui-avatars.com/api/?name=${session.user.name}&background=1A4D2E&color=fff`} alt="Admin" className="h-8 w-8 rounded-full border border-gray-200" />
            <span className="hidden sm:block text-sm font-semibold">{session.user.name}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-screen-2xl flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full shrink-0 border-b border-gray-200 bg-white lg:min-h-[calc(100vh-64px)] lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col p-4">
            <Link href="/" className="mb-6 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <ArrowLeft size={14} /> Marktplatz ansehen
            </Link>
            
            <nav className="flex flex-1 gap-1 overflow-x-auto lg:flex-col lg:overflow-visible no-scrollbar pb-2">
              <p className="mb-2 hidden lg:block px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Verwaltung</p>
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-dark)]'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={18} className={active ? 'text-[var(--color-primary)]' : 'text-gray-400 group-hover:text-gray-600'} /> 
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto hidden lg:block border-t border-gray-100 pt-4">
              <Link href="/admin/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                <Settings size={18} className="text-gray-400" /> Einstellungen
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
