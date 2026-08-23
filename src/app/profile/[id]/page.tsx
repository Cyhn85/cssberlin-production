'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clock,
  Leaf,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Star,
  UserPlus,
} from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { formatRelativeTime } from '@/lib/utils/condition-map';

type PublicProfile = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  location: string | null;
  isVerified: boolean;
  phoneVerified: boolean;
  ecoCO2Saved: number;
  itemsRecycled: number;
  createdAt: string;
  averageRating: number;
  isFollowing: boolean;
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
    seller: { name: string | null };
  }>;
  _count: {
    products: number;
    followers: number;
    following: number;
    receivedReviews: number;
  };
};

type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { name: string | null };
  order?: { product: { title: string } };
};

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'reviews'>('wardrobe');
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    const userId = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!userId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [profileResponse, reviewsResponse] = await Promise.all([
          fetch(`/api/users/${userId}`),
          fetch(`/api/reviews/user/${userId}`),
        ]);
        const profileResult = await profileResponse.json();
        const reviewsResult = await reviewsResponse.json();

        if (!cancelled) {
          if (profileResult.success) setProfile(profileResult.data);
          if (reviewsResult.success) setReviews(reviewsResult.data.reviews || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const handleFollowToggle = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);

    try {
      const response = await fetch(`/api/users/${profile.id}/follow`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Folgen konnte nicht aktualisiert werden.');
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              isFollowing: result.data.following,
              _count: { ...current._count, followers: result.data.followerCount },
            }
          : current
      );
    } catch {
      router.push('/login');
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p style={{ color: 'var(--color-primary)' }}>Profil wird geladen...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-16 text-center">
        <p style={{ color: 'var(--color-text-secondary)' }}>Dieses Profil konnte nicht geladen werden.</p>
      </div>
    );
  }

  const initials = (profile.name || profile.username || 'U').charAt(0).toUpperCase();
  const verifications = [
    profile.isVerified ? 'Email' : null,
    profile.phoneVerified ? 'Telefon' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-20">
      {/* Hero Banner (21st.dev Style) */}
      <div className="relative h-48 md:h-64 lg:h-72 w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-bg-secondary)] overflow-hidden">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
        {/* Soft decorative blur */}
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[var(--color-orange)] blur-[80px] opacity-20"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6">
        <div className="relative -mt-16 sm:-mt-20 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--color-border)]">
          <div className="flex flex-col md:flex-row gap-5 items-start md:items-end">
            {/* Floating Avatar */}
            <div className="relative rounded-full p-1.5 bg-[var(--color-bg)] shadow-sm">
              <div
                className="flex h-24 w-24 sm:h-32 sm:w-32 items-center justify-center rounded-full text-4xl sm:text-5xl font-extrabold text-white shadow-inner overflow-hidden"
                style={{ background: 'var(--color-primary)' }}
              >
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name || ''} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {profile.isVerified && (
                <div className="absolute bottom-2 right-2 h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-[var(--color-bg)] flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="text-green-500 h-5 w-5 sm:h-7 sm:w-7 fill-green-100" />
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex flex-col mt-2 md:mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text)] tracking-tight">
                {profile.name || profile.username}
              </h1>
              <p className="text-sm font-medium text-[var(--color-text-muted)] mt-1">
                @{profile.username || profile.id.slice(0, 8)}
              </p>
              
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--color-text-secondary)] font-medium">
                <span className="flex items-center gap-1.5 bg-[var(--color-bg-secondary)] px-2.5 py-1 rounded-md"><MapPin size={14} className="text-[var(--color-primary)]" /> {profile.location || 'Berlin, Deutschland'}</span>
                <span className="flex items-center gap-1.5 bg-[var(--color-bg-secondary)] px-2.5 py-1 rounded-md">
                  <Star size={14} className="text-[var(--color-warning)] fill-[var(--color-warning)]" />
                  <span className="font-bold text-[var(--color-text)]">{profile.averageRating.toFixed(1)}</span> ({profile._count.receivedReviews} Bewertungen)
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 md:mb-2 w-full md:w-auto">
            <button
              onClick={() => router.push(`/inbox?with=${profile.id}`)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
            >
              <MessageCircle size={16} /> Nachricht
            </button>
            <button
              onClick={handleFollowToggle}
              disabled={followBusy}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all shadow-sm"
              style={{
                background: profile.isFollowing ? 'var(--color-bg-card)' : 'var(--color-orange)',
                color: profile.isFollowing ? 'var(--color-orange)' : '#fff',
                border: `1px solid ${profile.isFollowing ? 'var(--color-orange)' : 'transparent'}`,
              }}
            >
              <UserPlus size={16} /> {profile.isFollowing ? 'Abonniert' : 'Folgen'}
            </button>
            <button className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] transition-colors">
              <Share2 size={16} className="text-[var(--color-text)]" />
            </button>
          </div>
        </div>

        {/* Bio & Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
          <div className="md:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Über {profile.username}</h3>
            <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
              {profile.bio || 'Dieser Nutzer hat noch keine Biografie hinzugefügt. Entdecke stattdessen die coolen Second-Hand Schätze im Kleiderschrank!'}
            </p>
            
            <div className="mt-6 flex flex-wrap gap-4">
               <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-bg-card)] shadow-sm">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <Leaf size={16} className="text-green-700" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Eco Impact</p>
                    <p className="text-sm font-bold text-[var(--color-text)]">-{profile.ecoCO2Saved.toFixed(1)}kg CO₂ gespart</p>
                  </div>
               </div>
               <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-bg-card)] shadow-sm">
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <CheckCircle2 size={16} className="text-orange-700" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Verkäufe</p>
                    <p className="text-sm font-bold text-[var(--color-text)]">{profile.itemsRecycled} Artikel verkauft</p>
                  </div>
               </div>
            </div>
          </div>
          
          <div className="rounded-2xl border border-[var(--color-border)] p-5 bg-[var(--color-bg-card)] shadow-sm">
             <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Profil-Info</h3>
             <ul className="space-y-3 text-sm">
               <li className="flex justify-between">
                 <span className="text-[var(--color-text-secondary)]">Mitglied seit</span>
                 <span className="font-semibold text-[var(--color-text)]">{new Date(profile.createdAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
               </li>
               <li className="flex justify-between">
                 <span className="text-[var(--color-text-secondary)]">Follower</span>
                 <span className="font-semibold text-[var(--color-text)]">{profile._count.followers}</span>
               </li>
               <li className="flex justify-between">
                 <span className="text-[var(--color-text-secondary)]">Folgt</span>
                 <span className="font-semibold text-[var(--color-text)]">{profile._count.following}</span>
               </li>
             </ul>
          </div>
        </div>

        <div className="mb-8 flex items-center gap-8 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('wardrobe')}
            className="relative pb-4 text-base font-bold"
            style={{ color: activeTab === 'wardrobe' ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            Kleiderschrank ({profile.products.length})
            {activeTab === 'wardrobe' ? <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-primary)' }} /> : null}
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className="relative pb-4 text-base font-bold"
            style={{ color: activeTab === 'reviews' ? 'var(--color-text)' : 'var(--color-text-muted)' }}
          >
            Bewertungen ({reviews.length})
            {activeTab === 'reviews' ? <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--color-primary)' }} /> : null}
          </button>
        </div>

        {activeTab === 'wardrobe' ? (
          profile.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {profile.products.map((product) => (
                <ProductCard key={product.id} product={product} showSeller />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <p style={{ color: 'var(--color-text-secondary)' }}>Dieser Kleiderschrank ist gerade leer.</p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {reviews.length > 0 ? reviews.map((review) => (
              <div key={review.id} className="rounded-2xl p-6" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{review.author.name || 'cssberlin member'}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatRelativeTime(review.createdAt)} · {review.order?.product.title || 'Kauf'}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} size={14} style={{ color: index < review.rating ? 'var(--color-warning)' : 'var(--color-border)', fill: index < review.rating ? 'var(--color-warning)' : 'transparent' }} />
                    ))}
                  </div>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {review.comment || 'Keine zusätzliche Bewertung hinterlassen.'}
                </p>
              </div>
            )) : (
              <div className="rounded-3xl border border-dashed p-10 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <p style={{ color: 'var(--color-text-secondary)' }}>Noch keine Bewertungen vorhanden.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
