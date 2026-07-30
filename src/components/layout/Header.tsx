'use client';

import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Camera,
  Heart,
  Leaf,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Tag,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getPusherClient } from '@/lib/pusher-client';
import { CHANNELS, EVENTS } from '@/lib/realtime';

type AutocompleteProduct = {
  id: string;
  title: string;
  price: number;
  images: Array<{ url: string }>;
};

type AutocompleteCategory = {
  id: string;
  name: string;
  emoji?: string | null;
  _count?: { products: number };
};

type NavCategory = {
  id: string;
  name: string;
  emoji?: string | null;
};

type ActivityCounts = {
  unreadMessages: number;
  unreadNotifications: number;
};

type NotificationSummaryPayload = {
  unreadNotifications: number;
  unreadMessages: number;
};

type HeaderRealtimeMessage = {
  receiverId: string;
};

export default function Header() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [suggestions, setSuggestions] = useState<{ products: AutocompleteProduct[]; categories: AutocompleteCategory[] }>({ products: [], categories: [] });
  const [activityCounts, setActivityCounts] = useState<ActivityCounts>({ unreadMessages: 0, unreadNotifications: 0 });
  const [navCategories, setNavCategories] = useState<NavCategory[]>([]);
  const deferredQuery = useDeferredValue(searchQuery);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const result = await response.json();
        if (!cancelled && result.success) {
          const tree = (result.data?.tree ?? []) as NavCategory[];
          setNavCategories(tree.slice(0, 8));
        }
      } catch {
        if (!cancelled) {
          setNavCategories([]);
        }
      }
    };

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (deferredQuery.trim().length < 2) {
      setSuggestions({ products: [], categories: [] });
      return;
    }

    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const response = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(deferredQuery.trim())}`);
        const result = await response.json();
        if (!cancelled && result.success) {
          setSuggestions(result.data);
        }
      } catch {
        if (!cancelled) {
          setSuggestions({ products: [], categories: [] });
        }
      }
    };

    void loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setActivityCounts({ unreadMessages: 0, unreadNotifications: 0 });
      return;
    }

    let cancelled = false;

    const loadActivityCounts = async () => {
      try {
        const response = await fetch('/api/notifications?limit=1');
        if (response.status === 401) {
          if (!cancelled) {
            setActivityCounts({ unreadMessages: 0, unreadNotifications: 0 });
          }
          return;
        }

        const result = await response.json();
        if (!cancelled && response.ok && result.success) {
          const data = result.data as NotificationSummaryPayload;
          setActivityCounts({
            unreadMessages: data.unreadMessages || 0,
            unreadNotifications: data.unreadNotifications || 0,
          });
        }
      } catch {
        if (!cancelled) {
          setActivityCounts({ unreadMessages: 0, unreadNotifications: 0 });
        }
      }
    };

    void loadActivityCounts();
    const interval = window.setInterval(loadActivityCounts, 60000);

    const pusher = getPusherClient();
    const channelName = CHANNELS.user(userId);
    const channel = pusher ? pusher.subscribe(channelName) : null;

    const handleNotification = () => {
      if (cancelled) return;
      setActivityCounts((current) => ({
        ...current,
        unreadNotifications: current.unreadNotifications + 1,
      }));
    };

    const handleNewMessage = (event: HeaderRealtimeMessage) => {
      if (cancelled || event.receiverId !== userId) return;
      setActivityCounts((current) => ({
        ...current,
        unreadMessages: current.unreadMessages + 1,
      }));
    };

    channel?.bind(EVENTS.NOTIFICATION, handleNotification);
    channel?.bind(EVENTS.NEW_MESSAGE, handleNewMessage);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (channel && pusher) {
        channel.unbind(EVENTS.NOTIFICATION, handleNotification);
        channel.unbind(EVENTS.NEW_MESSAGE, handleNewMessage);
        pusher.unsubscribe(channelName);
      }
    };
  }, [session?.user?.id]);

  const tickerItems: Array<{ key: string; href: string; icon: ReactNode; label: string }> = [
    { key: 'reused', href: '/eco-impact', icon: <Leaf size={14} className="text-[#1b4332]" />, label: '45.2K Artikel wiederverwendet' },
    { key: 'co2', href: '/eco-impact', icon: <Leaf size={14} className="text-[#1b4332]" />, label: '12,8t CO2 eingespart' },
    { key: 'shipping', href: '/#warum-cssberlin', icon: <Plus size={14} className="text-[#1b4332]" />, label: 'Versandkostenfrei bei deiner ersten Bestellung' },
    { key: 'protection', href: '/#warum-cssberlin', icon: <ShieldCheck size={14} className="text-[#1b4332]" />, label: 'Kaeuferschutz bei jedem Kauf inklusive' },
    ...(!session ? [{ key: 'register', href: '/register', icon: <Sparkles size={14} className="text-[#1b4332]" />, label: 'Neu hier? Jetzt kostenlos registrieren' }] : []),
  ];

  const quickLinks = [
    { href: '/favorites', label: 'Favoriten', icon: <Heart size={16} /> },
    { href: '/offers', label: 'Angebote', icon: <Tag size={16} /> },
    { href: '/inbox', label: 'Inbox', icon: <MessageCircle size={16} /> },
    { href: '/notifications', label: 'Hinweise', icon: <Bell size={16} /> },
    { href: '/profile', label: 'Profil', icon: <User size={16} /> },
  ];

  const hasSuggestions = suggestions.products.length > 0 || suggestions.categories.length > 0;

  const submitSearch = (query: string) => {
    if (!query.trim()) return;
    setIsSearchFocused(false);
    setIsMobileMenuOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header
      className={`fixed left-0 right-0 top-0 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-xl shadow-md dark:bg-[#0D1117]/80' : 'bg-white dark:bg-[#0D1117]'}`}
      style={{ zIndex: 'var(--z-sticky)' }}
    >
      <div className="flex h-8 items-center overflow-hidden border-b border-orange-500/20" style={{ background: '#FF8A3D', color: '#1b4332' }}>
        <div className="flex whitespace-nowrap">
          <motion.div initial={{ x: 0 }} animate={{ x: '-50%' }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }} className="flex items-center gap-12 px-4">
            {[1, 2].map((index) => (
              <div key={index} className="flex items-center gap-12">
                {tickerItems.map((tickerItem) => (
                  <Link
                    key={`${index}-${tickerItem.key}`}
                    href={tickerItem.href}
                    className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-widest transition-opacity hover:opacity-70 md:text-[11px]"
                  >
                    {tickerItem.icon} {tickerItem.label}
                  </Link>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      <div className="container">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="group flex shrink-0 items-center gap-2">
            <motion.div whileHover={{ rotate: 10, scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <Leaf size={28} style={{ color: 'var(--color-primary)' }} strokeWidth={2.5} />
            </motion.div>
            <span className="hidden text-xl font-bold tracking-tight sm:block" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              css<span style={{ color: 'var(--color-primary)' }}>berlin</span>
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/upload">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-mars-earth hidden h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white sm:flex" style={{ background: 'var(--color-orange)' }}>
                <Plus size={16} /> Verkaufen
              </motion.button>
            </Link>

            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setIsDarkMode(!isDarkMode)} className="icon-mars-earth p-2.5" aria-label="Dark Mode Toggle">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </motion.button>

            <Link href="/favorites" className="icon-mars-earth p-2.5"><Heart size={20} /></Link>
            <Link href="/offers" className="icon-mars-earth p-2.5" aria-label="Angebote / Pazarlıklarım" title="Pazarlıklarım"><Tag size={20} /></Link>
            <Link href="/inbox" className="icon-mars-earth relative p-2.5" aria-label="Inbox">
              <MessageCircle size={20} />
              {activityCounts.unreadMessages > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-[var(--color-error)] px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                  {activityCounts.unreadMessages > 99 ? '99+' : activityCounts.unreadMessages}
                </span>
              ) : null}
            </Link>
            <Link href="/notifications" className="icon-mars-earth relative p-2.5" aria-label="Notifications">
              <Bell size={20} />
              {activityCounts.unreadNotifications > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-[var(--color-primary)] px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                  {activityCounts.unreadNotifications > 99 ? '99+' : activityCounts.unreadNotifications}
                </span>
              ) : null}
            </Link>
            {session ? (
              <Link href="/profile" className="icon-mars-earth p-2.5"><User size={20} /></Link>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/login" className="nav-mars-earth px-2 text-sm font-semibold">Anmelden</Link>
                <Link href="/register" className="btn-mars-earth-outline text-xs">Registrieren</Link>
              </div>
            )}

            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="icon-mars-earth p-2.5 md:hidden" aria-label="Menu">
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </motion.button>
          </div>
        </div>
      </div>

      <div className="hidden border-t md:block" style={{ borderColor: 'var(--color-border)' }}>
        <div className="container flex items-center gap-4 py-2.5">
          <nav className="flex shrink-0 items-center gap-1 overflow-x-auto">
            {navCategories.map((category) => (
              <Link
                key={category.id}
                href={`/catalog?category=${encodeURIComponent(category.name)}`}
                className="nav-mars-earth whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium"
              >
                {category.emoji ? `${category.emoji} ` : ''}{category.name}
              </Link>
            ))}
          </nav>

          <div className="relative flex-1">
            <motion.div animate={{ scale: isSearchFocused ? 1.01 : 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <input
                type="text"
                placeholder="Suche nach Marke, Artikel oder Kategorie..."
                className="h-11 w-full rounded-full pl-12 pr-12 text-sm transition-all duration-200"
                style={{ background: 'var(--color-bg-secondary)', border: `2px solid ${isSearchFocused ? 'var(--color-primary)' : 'transparent'}`, color: 'var(--color-text)' }}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 120)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitSearch(searchQuery);
                }}
                id="main-search"
              />
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <Link
                href="/search/image"
                className="icon-mars-earth absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5"
                aria-label="Mit Foto suchen"
                title="Mit Foto suchen"
              >
                <Camera size={18} />
              </Link>
            </motion.div>

            <AnimatePresence>
              {isSearchFocused && deferredQuery.trim().length >= 2 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-10 overflow-hidden rounded-2xl border shadow-xl"
                  style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                >
                  {hasSuggestions ? (
                    <>
                      {suggestions.products.length > 0 ? (
                        <div className="border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Produkte</p>
                          <div className="space-y-1">
                            {suggestions.products.map((product) => (
                              <button
                                key={product.id}
                                onMouseDown={() => router.push(`/product/${product.id}`)}
                                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
                              >
                                <div className="h-11 w-11 overflow-hidden rounded-lg bg-[var(--color-bg-secondary)]">
                                  {product.images[0]?.url ? <img src={product.images[0].url} alt={product.title} className="h-full w-full object-cover" /> : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{product.title}</p>
                                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{product.price.toFixed(2)} EUR</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {suggestions.categories.length > 0 ? (
                        <div className="p-3">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kategorien</p>
                          <div className="space-y-1">
                            {suggestions.categories.map((category) => (
                              <button
                                key={category.id}
                                onMouseDown={() => router.push(`/catalog?category=${encodeURIComponent(category.name)}`)}
                                className="flex w-full items-center justify-between rounded-xl p-2 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
                              >
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{category.emoji || '🛍️'} {category.name}</span>
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{category._count?.products || 0}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="p-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Keine Vorschlaege gefunden. Druecke Enter fuer die Vollsuche.
                    </div>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t md:hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
            <div className="p-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Suche..."
                  className="h-11 w-full rounded-full pl-12 pr-4 text-sm"
                  style={{ background: 'var(--color-bg-secondary)', border: '2px solid var(--color-border)', color: 'var(--color-text)' }}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') submitSearch(searchQuery);
                  }}
                />
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pb-4">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>

            <ul className="space-y-1 px-4 pb-4">
              {navCategories.map((category, index) => (
                <motion.li key={category.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                  <Link href={`/catalog?category=${encodeURIComponent(category.name)}`} className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium" style={{ color: 'var(--color-text)' }} onClick={() => setIsMobileMenuOpen(false)}>
                    {category.emoji ? <span aria-hidden>{category.emoji}</span> : <ShoppingBag size={16} style={{ color: 'var(--color-primary)' }} />}
                    {category.name}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <div className="px-4 pb-4">
              <Link href="/upload" onClick={() => setIsMobileMenuOpen(false)}>
                <button className="btn-mars-earth w-full py-3 text-sm font-semibold text-white">
                  <Plus size={16} className="mr-2 inline" /> Jetzt verkaufen
                </button>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}