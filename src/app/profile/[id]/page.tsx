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
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="relative mb-8 overflow-hidden rounded-3xl p-6 md:p-10" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
          <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, var(--color-primary-light) 0%, transparent 70%)' }} />

          <div className="relative z-10 flex flex-col items-start gap-8 md:flex-row md:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-4xl font-bold text-white shadow-lg md:h-32 md:w-32" style={{ background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-primary))' }}>
              {initials}
            </div>

            <div className="flex-1">
              <div className="mb-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <h1 className="flex items-center gap-2 truncate text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                    {profile.name || 'Ohne Namen'}
                  </h1>
                  <p className="mb-1 truncate font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    @{profile.username || profile.id.slice(0, 8)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button className="flex h-10 w-10 items-center justify-center rounded-full" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    <Share2 size={18} />
                  </button>
                  <button className="flex h-10 w-10 items-center justify-center rounded-full" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                    <MoreHorizontal size={18} />
                  </button>
                  <button
                    onClick={handleFollowToggle}
                    disabled={followBusy}
                    className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold"
                    style={{
                      background: profile.isFollowing ? 'var(--color-orange)' : 'transparent',
                      color: profile.isFollowing ? '#fff' : 'var(--color-orange)',
                      border: '2px solid var(--color-orange)',
                    }}
                  >
                    <UserPlus size={16} /> {profile.isFollowing ? 'Abonniert' : 'Folgen'}
                  </button>
                  <button
                    onClick={() => router.push(`/inbox?with=${profile.id}`)}
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <MessageCircle size={16} /> Nachricht
                  </button>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1.5"><MapPin size={14} /> {profile.location || 'Deutschland'}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> Mitglied seit {new Date(profile.createdAt).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</span>
                <span className="flex items-center gap-1.5">
                  <Star size={14} style={{ fill: 'var(--color-warning)', color: 'var(--color-warning)' }} />
                  <span className="ml-0.5 font-bold" style={{ color: 'var(--color-text)' }}>{profile.averageRating.toFixed(1)}</span> ({profile._count.receivedReviews})
                </span>
                <span className="font-medium"><span style={{ color: 'var(--color-text)' }}>{profile._count.followers}</span> Follower</span>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {profile.bio || 'Noch keine Bio hinterlegt.'}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-6 border-t pt-6 md:gap-12" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--color-text-muted)' }}>Verifizierungen</p>
              <div className="flex gap-3">
                {verifications.length > 0 ? verifications.map((entry) => (
                  <span key={entry} className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle2 size={14} /> {entry}
                  </span>
                )) : <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Noch keine sichtbaren Verifizierungen</span>}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--color-text-muted)' }}>Eco Impact</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                  <Leaf size={14} /> -{profile.ecoCO2Saved.toFixed(1)}kg CO2
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {profile.itemsRecycled} Artikel weitergegeben
                </span>
              </div>
            </div>
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
                  {review.comment || 'Keine zusaetzliche Bewertung hinterlassen.'}
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
