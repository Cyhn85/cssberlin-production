'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Calendar, Leaf, MapPin, Settings, ShoppingBag, Star, User } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';

type ProfileData = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  isVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  rating: number;
  ecoCO2Saved: number;
  itemsRecycled: number;
  products: Array<{
    id: string;
    title: string;
    price: number;
    originalPrice: number | null;
    brand: string | null;
    size: string | null;
    condition: string;
    likes: number;
    ecoCO2Saved: number;
    images: Array<{ url: string }>;
    _count?: { favorites: number; offers: number };
  }>;
  _count: {
    products: number;
    followers: number;
    following: number;
    receivedReviews: number;
    ordersAsSeller: number;
    ordersAsBuyer: number;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/users/me');
        if (response.status === 401) {
          router.replace('/login?callbackUrl=/profile');
          return;
        }

        const result = await response.json();
        if (!cancelled && result.success) {
          setProfile(result.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Profil wird geladen...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-16 text-center">
        <p style={{ color: 'var(--color-text-secondary)' }}>Dein Profil konnte nicht geladen werden.</p>
        <Link href="/login?callbackUrl=/profile" className="mt-4 inline-flex rounded-full px-5 py-3 text-sm font-bold text-white" style={{ background: 'var(--color-primary)' }}>
          Erneut einloggen
        </Link>
      </div>
    );
  }

  const initials = (profile.name || profile.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-20">
      <div className="h-48 bg-gradient-to-r from-orange-400 to-orange-600 md:h-64" />

      <div className="container relative -mt-24 z-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 text-center">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[var(--color-primary-light)] text-3xl font-bold text-white shadow-xl md:h-32 md:w-32">
                {initials}
              </div>

              <h1 className="mb-1 text-xl font-bold" style={{ color: 'var(--color-text)' }}>{profile.name || 'Ohne Namen'}</h1>
              <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>@{profile.username || profile.id.slice(0, 8)}</p>

              <div className="mb-6 flex items-center justify-center gap-1 font-bold text-orange-500">
                <Star size={16} fill="currentColor" />
                <span>{profile.rating.toFixed(1)}</span>
                <span className="ml-1 text-xs font-normal text-gray-400">({profile._count.receivedReviews} Bewertungen)</span>
              </div>

              <div className="space-y-3 border-t pt-6" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <MapPin size={16} className="shrink-0" />
                  <span>{profile.location || 'Deutschland'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                  <Calendar size={16} className="shrink-0" />
                  <span>Mitglied seit {new Date(profile.createdAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-green-600">
                  <Leaf size={16} className="shrink-0" />
                  <span>{profile.itemsRecycled} Artikel wieder im Kreislauf</span>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <Link href="/settings" className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <Settings size={16} /> Profil bearbeiten
                </Link>
                <Link href="/dashboard" className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                  <ShoppingBag size={16} /> Verkaeufer-Dashboard
                </Link>
              </div>
            </motion.div>
          </div>

          <div className="space-y-8 lg:col-span-3">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { label: 'Aktive Listings', value: profile._count.products, icon: <ShoppingBag size={18} /> },
                { label: 'Follower', value: profile._count.followers, icon: <User size={18} /> },
                { label: 'Verkaeufe', value: profile._count.ordersAsSeller, icon: <Star size={18} /> },
                { label: 'CO2 gespart', value: `${profile.ecoCO2Saved.toFixed(1)}kg`, icon: <Leaf size={18} /> },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-4 text-center">
                  <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {stat.icon}
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Ueber dich</h2>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {profile.bio || 'Fuege in den Einstellungen noch eine kurze Bio hinzu.'}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <Link href="/purchases" style={{ color: 'var(--color-primary)' }}>Kaeufe</Link>
                  <Link href="/eco-impact" style={{ color: 'var(--color-primary)' }}>Eco-Impact</Link>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Deine neuesten Artikel</h2>
                <Link href="/upload" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                  Neuen Artikel hochladen
                </Link>
              </div>

              {profile.products.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {profile.products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                  <p style={{ color: 'var(--color-text-secondary)' }}>Du hast noch keine Artikel hochgeladen.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
