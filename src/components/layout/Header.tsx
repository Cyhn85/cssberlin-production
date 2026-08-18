'use client';

import { useDeferredValue, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Camera,
  Heart,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Sun,
  Tag,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { formatRelativeTime } from '@/lib/utils/condition-map';
import { getPusherClient } from '@/lib/pusher-client';
import { CHANNELS, EVENTS } from '@/lib/realtime';
import { sortCategoriesByPriority } from '@/lib/category-priority';
import { shortLabel } from '@/config/launch-scope';
import { useFavorites } from '@/store/useFavorites';
import { useCart } from '@/store/useCart';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

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

type NotificationItem = {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string | null; avatar: string | null };
  offer: { id: string; product: { id: string; title: string } } | null;
};

export default function Header() {
  const router = useRouter();
  // `status` OKUNMALI: sadece `data` kullanilinca, oturum yuklenirken session
  // `undefined` olur ve header "giris yapilmamis" dalini cizer. Google'dan
  // donen kullanici bir an cikis yapmis gorunur, tekrar /login'e yonelir —
  // kullanicinin yasadigi "popup dongusu" tam olarak budur.
  const { data: session, status } = useSession();
  const authLoading = status === 'loading';
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { count: favoriteCount, isLoaded: favoritesLoaded } = useFavorites();
  const { count: cartCount, isLoaded: cartLoaded } = useCart();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [suggestions, setSuggestions] = useState<{ products: AutocompleteProduct[]; categories: AutocompleteCategory[] }>({ products: [], categories: [] });
  const [activityCounts, setActivityCounts] = useState<ActivityCounts>({ unreadMessages: 0, unreadNotifications: 0 });
  const [navCategories, setNavCategories] = useState<NavCategory[]>([]);
  // Single source of truth for which header dropdown is open -- guarantees
  // mutual exclusivity by construction, unlike two independently-controlled
  // booleans that tried to close each other as a side effect (Base UI's
  // Menu doesn't reliably reconcile two controlled `open` props changing
  // in the same interaction).
  const [openHeaderMenu, setOpenHeaderMenu] = useState<'notifications' | 'account' | null>(null);
  const isNotificationsOpen = openHeaderMenu === 'notifications';
  const isAccountMenuOpen = openHeaderMenu === 'account';
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const deferredQuery = useDeferredValue(searchQuery);

  const openNotifications = async () => {
    if (notificationItems.length > 0) return;
    setNotificationsLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=8');
      const result = await response.json();
      if (result.success) {
        setNotificationItems(result.data.notifications || []);
      }
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const result = await response.json();
        if (!cancelled && result.success) {
          const tree = (result.data?.tree ?? []) as NavCategory[];
          setNavCategories(sortCategoriesByPriority(tree).slice(0, 8));
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

  // Ticker-Inhalte kommen komplett aus /api/ticker: freigegebene Kampagnen plus
  // die echten Community-Zahlen. Nichts davon steht fest im Code - laesst sich
  // eine Aussage nicht belegen, wird sie schlicht nicht angezeigt.
  const [tickerFeed, setTickerFeed] = useState<Array<{ key: string; label: string; href: string; kind: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/ticker?lang=de')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.data?.items) return;
        setTickerFeed(payload.data.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const tickerIcon = (kind: string): ReactNode =>
    kind === 'sale' ? <Tag size={14} className="text-[#1b4332]" />
    : kind === 'eco' ? <Leaf size={14} className="text-[#1b4332]" />
    : <Sparkles size={14} className="text-[#1b4332]" />;

  const tickerItems: Array<{ key: string; href: string; icon: ReactNode; label: string }> = [
    ...tickerFeed.map((item) => ({
      key: item.key,
      href: item.href,
      icon: tickerIcon(item.kind),
      label: item.label,
    })),
    { key: 'protection', href: '/ueber-uns', icon: <ShieldCheck size={14} className="text-[#1b4332]" />, label: 'Kaeuferschutz bei jedem Kauf inklusive' },
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
      <div
        className="flex h-7 items-center overflow-hidden border-b border-orange-500/20"
        style={{ background: 'linear-gradient(90deg, #E8651A 0%, #c5a33d 50%, #40916C 100%)', color: '#fff' }}
      >
        <div className="flex whitespace-nowrap">
          <motion.div initial={{ x: 0 }} animate={{ x: '-50%' }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }} className="flex items-center gap-12 px-4">
            {[1, 2].map((index) => (
              <div key={index} className="flex items-center gap-12">
                {tickerItems.map((tickerItem) => (
                  <Link
                    key={`${index}-${tickerItem.key}`}
                    href={tickerItem.href}
                    className="inline-flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest transition-opacity hover:opacity-70 md:text-[10px]"
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
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="group flex shrink-0 items-center leading-none">
            <span className="text-gradient-mars-earth" style={{ fontFamily: 'var(--font-display)' }}>
              <span className="text-3xl font-extrabold tracking-tight">css</span>
              <span className="text-lg font-bold tracking-tight">berlin</span>
            </span>
          </Link>

          <div className="relative mx-auto hidden w-full max-w-md flex-1 md:block">
            <motion.div animate={{ scale: isSearchFocused ? 1.01 : 1 }} transition={{ type: 'spring', stiffness: 300 }} className="relative">
              <input
                type="text"
                placeholder="Climate Smart Solutions"
                className="h-10 w-full rounded-full pl-11 pr-11 text-sm transition-all duration-200"
                style={{ background: 'var(--color-bg-secondary)', border: `2px solid ${isSearchFocused ? 'var(--color-primary)' : 'transparent'}`, color: 'var(--color-text)', textAlign: 'center' }}
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
                className="icon-mars-earth p-1.5"
                style={{ position: 'absolute', right: '0.375rem', top: '50%', transform: 'translateY(-50%)' }}
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

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* Dark mode toggle — logodan buraya taşındı, header kompaktlaştı */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="hidden h-8 w-8 items-center justify-center rounded-full transition-colors sm:flex"
              style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
              aria-label="Dark Mode Toggle"
            >
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
            </motion.button>

            <Link href="/upload">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-mars-earth hidden items-center text-white sm:flex"
                style={{ background: 'var(--color-orange)', padding: '0.45rem 0.85rem', fontSize: '0.8rem', gap: '0.35rem' }}
              >
                <Plus size={14} /> <span>Verkaufen</span>
              </motion.button>
            </Link>

            <div className="hidden items-center gap-1 sm:flex md:gap-1.5">
              <Link href="/favorites" className="icon-mars-earth relative p-2.5" aria-label="Favoriten">
                <Heart size={20} />
              </Link>
              <Link href="/offers" className="icon-mars-earth p-2.5" aria-label="Angebote">
                <Tag size={20} />
              </Link>
              <Link href="/cart" className="icon-mars-earth relative p-2.5" aria-label="Warenkorb">
                <ShoppingCart size={20} />
                {cartLoaded && cartCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-[var(--color-primary)] px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : null}
              </Link>
            </div>

            {session ? (
              <DropdownMenu
                open={isNotificationsOpen}
                onOpenChange={(open) => {
                  setOpenHeaderMenu(open ? 'notifications' : null);
                  if (open) void openNotifications();
                }}
              >
                <DropdownMenuTrigger className="icon-mars-earth relative p-2.5" aria-label="Benachrichtigungen">
                  <Bell size={20} />
                  {activityCounts.unreadNotifications + activityCounts.unreadMessages > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-[var(--color-primary)] px-1.5 text-center text-[10px] font-bold leading-5 text-white">
                      {activityCounts.unreadNotifications + activityCounts.unreadMessages > 99 ? '99+' : activityCounts.unreadNotifications + activityCounts.unreadMessages}
                    </span>
                  ) : null}
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={12} className="w-[92vw] max-w-[360px] p-0">
                  <div className="flex items-center justify-between border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Benachrichtigungen</span>
                    <Link href="/inbox" onClick={() => setOpenHeaderMenu(null)} className="text-xs font-semibold" style={{ color: 'var(--color-orange)' }}>
                      Zur Inbox {activityCounts.unreadMessages > 0 ? `(${activityCounts.unreadMessages})` : ''}
                    </Link>
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>Wird geladen...</div>
                    ) : notificationItems.length === 0 ? (
                      <div className="p-4 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>Noch keine Benachrichtigungen.</div>
                    ) : (
                      notificationItems.map((item) => (
                        <Link
                          key={item.id}
                          href={`/inbox?with=${encodeURIComponent(item.senderId)}`}
                          onClick={() => setOpenHeaderMenu(null)}
                          className="flex items-start gap-3 border-b p-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
                          style={{ borderColor: 'var(--color-border)', background: item.isRead ? 'transparent' : 'rgba(45,106,79,0.06)' }}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                            {(item.sender.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs" style={{ color: 'var(--color-text)' }}>{item.content}</p>
                            <p className="mt-1 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{formatRelativeTime(item.createdAt)}</p>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  <Link
                    href="/notifications"
                    onClick={() => setOpenHeaderMenu(null)}
                    className="block p-2.5 text-center text-xs font-semibold"
                    style={{ color: 'var(--color-orange)', borderTop: '1px solid var(--color-border)' }}
                  >
                    Alle Benachrichtigungen ansehen
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {session ? (
              <DropdownMenu
                open={isAccountMenuOpen}
                onOpenChange={(open) => setOpenHeaderMenu(open ? 'account' : null)}
              >
                <DropdownMenuTrigger className="icon-mars-earth p-2.5" aria-label="Konto-Menue">
                  <User size={20} />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={12} className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/profile" />} className="gap-3 px-2.5 py-2">
                      <User size={16} /> Mein Profil
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/favorites" />} className="gap-3 px-2.5 py-2">
                      <Heart size={16} /> Favoriten
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/inbox" />} className="gap-3 px-2.5 py-2">
                      <MessageCircle size={16} /> Nachrichten
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/offers" />} className="gap-3 px-2.5 py-2">
                      <Tag size={16} /> Pazarlıklarım
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/purchases" />} className="gap-3 px-2.5 py-2">
                      <Package size={16} /> Meine Einkaeufe
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/sales" />} className="gap-3 px-2.5 py-2">
                      <ShoppingBag size={16} /> Meine Verkaeufe
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem render={<Link href="/settings" />} className="gap-3 px-2.5 py-2">
                      <Settings size={16} /> Einstellungen
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="gap-3 px-2.5 py-2"
                  >
                    <LogOut size={16} /> Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : authLoading ? (
              // Oturum yuklenirken NE giris NE cikis gosterilir — yanlis durum
              // gostermek, hic gostermemekten kotudur. Yer tutucu, header'in
              // ziplamasini da onler.
              <div
                className="h-9 w-9 shrink-0 animate-pulse rounded-full"
                style={{ background: 'var(--color-bg-secondary)' }}
                aria-label="Anmeldestatus wird geladen"
              />
            ) : (
              // MOBILDE DE GORUNUR: eskiden `hidden sm:flex` idi, yani telefonda
              // giris baglantisi hic cizilmiyordu. Kullanici giris yapip
              // yapmadigini anlayamiyordu. Dar ekranda sadece "Anmelden"
              // gosterilir (kisa), genis ekranda ikisi birden.
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="nav-mars-earth whitespace-nowrap px-2 text-sm font-semibold"
                >
                  Anmelden
                </Link>
                <Link
                  href="/register"
                  className="btn-mars-earth-outline hidden text-xs sm:inline-flex"
                  style={{ padding: '0.45rem 1rem' }}
                >
                  Registrieren
                </Link>
              </div>
            )}

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger className="icon-mars-earth p-2.5 md:hidden" aria-label="Menu">
                <Menu size={22} />
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm gap-0 p-0">
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

                {session ? (
                  <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                    {quickLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-xs font-semibold transition-colors hover:bg-[var(--color-orange)] hover:text-[#1A4D2E]"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 pb-4">
                    <div className="flex flex-col gap-2 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                      <p className="text-sm font-bold text-center" style={{ color: 'var(--color-text)' }}>Willkommen bei cssberlin</p>
                      <Link href="/register" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                        <button className="w-full rounded-xl py-2.5 text-sm font-bold transition-colors" style={{ background: 'var(--color-orange)', color: '#1A4D2E' }}>
                          Registrieren
                        </button>
                      </Link>
                      <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="w-full">
                        <button className="w-full rounded-xl border py-2.5 text-sm font-bold transition-colors" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                          Anmelden
                        </button>
                      </Link>
                    </div>
                  </div>
                )}

                <ul className="space-y-1 overflow-y-auto px-4 pb-4">
                  {navCategories.map((category) => (
                    <li key={category.id}>
                      <Link href={`/catalog?category=${encodeURIComponent(category.name)}`} className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium transition-colors hover:bg-[var(--color-orange)] hover:text-[#1A4D2E]" style={{ color: 'var(--color-text)' }} onClick={() => setIsMobileMenuOpen(false)}>
                        {category.emoji ? <span aria-hidden>{category.emoji}</span> : <ShoppingBag size={16} style={{ color: 'var(--color-primary)' }} />}
                        {category.name}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/ueber-uns" className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium transition-colors hover:bg-[var(--color-orange)] hover:text-[#1A4D2E]" style={{ color: 'var(--color-text)' }} onClick={() => setIsMobileMenuOpen(false)}>
                      <span aria-hidden>✨</span> Warum wir?
                    </Link>
                  </li>
                  {session?.user?.role === 'ADMIN' ? (
                    <li>
                      <Link href="/admin" className="flex items-center gap-3 rounded-xl p-3 text-sm font-medium transition-colors hover:bg-[var(--color-orange)] hover:text-[#1A4D2E]" style={{ color: 'var(--color-text)' }} onClick={() => setIsMobileMenuOpen(false)}>
                        <ShieldCheck size={16} style={{ color: 'var(--color-orange)' }} /> Admin Control Center
                      </Link>
                    </li>
                  ) : null}
                </ul>

                <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-colors hover:bg-[var(--color-orange)] hover:text-[#1A4D2E]"
                    style={{ color: 'var(--color-text)' }}
                    aria-label="Dark Mode umschalten"
                  >
                    <span className="inline-flex items-center gap-3">
                      {isDarkMode ? <Sun size={16} style={{ color: 'var(--color-primary)' }} /> : <Moon size={16} style={{ color: 'var(--color-primary)' }} />}
                      {isDarkMode ? 'Heller Modus' : 'Dunkler Modus'}
                    </span>
                  </button>
                </div>

                <div className="mt-auto px-4 pb-4">
                  <Link href="/upload" onClick={() => setIsMobileMenuOpen(false)}>
                    <button className="w-full rounded-2xl py-3.5 text-sm font-bold transition-colors" style={{ background: 'var(--color-orange)', color: '#1A4D2E' }}>
                      <span className="inline-flex items-center gap-2"><Plus size={16} /> Jetzt verkaufen</span>
                    </button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* KATEGORI SERIDI — header'in hemen altinda, HER ekranda.
          Eskiden `hidden md:block` idi: telefonda kategoriye ulasmanin tek
          yolu hamburger menusuydu. Kategori bir pazaryerinin ana gezinme
          ekseni; menunun arkasina saklanmamali.
          Mobilde ortalamak yerine sola yaslanir — ortalanmis serit yatay
          kaydirmada ilk ogeyi ekran disinda birakir. */}
      {/* KATEGORI SERIDI — her ekranda, header'in hemen altinda.
          EMOJI YOK: emoji satir yuksekligini buyutuyor (font'a gore 2-4px),
          ekranlar arasi farkli render ediliyor ve pazaryeri gezinme cubugunu
          oyuncak gosteriyor. Vinted, eBay, Kleinanzeigen — hicbiri kullanmiyor.
          Serit ince tutulur: gezinme cubugu icerigi bastirmamali. */}
      <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="container flex items-center justify-start gap-1 overflow-x-auto py-2 md:justify-center md:gap-3 md:py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navCategories.map((category) => (
            <Link
              key={category.id}
              href={`/catalog?category=${encodeURIComponent(category.name)}`}
              className="cat-nav-link shrink-0 whitespace-nowrap px-2 py-1 text-[13px] font-medium md:px-2.5 md:text-sm"
            >
              {/* Dar ekranda kisaltilmis etiket ("Taschen & Accessoires" -> "Taschen") */}
              <span className="md:hidden">{shortLabel(category.name)}</span>
              <span className="hidden md:inline">{category.name}</span>
            </Link>
          ))}
          <Link
            href="/ueber-uns"
            className="cat-nav-link shrink-0 whitespace-nowrap px-2 py-1 text-[13px] font-medium md:px-2.5 md:text-sm"
            style={{ borderLeft: '1px solid var(--color-border)', marginLeft: '0.25rem', paddingLeft: '0.75rem' }}
          >
            <span className="md:hidden">Warum?</span><span className="hidden md:inline">Warum wir?</span>
          </Link>
        </div>
      </div>

    </header>
  );
}