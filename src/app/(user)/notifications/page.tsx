'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bell, CheckCheck, Loader2, MessageCircle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/condition-map';
import { getPusherClient } from '@/lib/pusher-client';
import { CHANNELS, EVENTS } from '@/lib/realtime';

type NotificationItem = {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string | null;
    avatar: string | null;
  } | null;
  offer?: {
    id: string;
    offeredPrice: number;
    status: string;
    product: {
      id: string;
      title: string;
    };
  } | null;
};

type NotificationPayload = {
  notifications: NotificationItem[];
  unreadNotifications: number;
  unreadMessages: number;
};

type RealtimeNotificationEvent = NotificationItem;

type RealtimeMessageEvent = {
  message: {
    receiverId: string;
  };
};

function getNotificationAction(notification: NotificationItem) {
  if (notification.offer) {
    return {
      href: '/offers',
      label: 'Zu Angeboten',
      secondaryHref: '/inbox',
      secondaryLabel: 'Zur Inbox',
    };
  }

  const normalized = notification.content.toLowerCase();

  if (
    normalized.includes('deine bestellung') ||
    normalized.includes('deine zahlung') ||
    normalized.includes('deinen kaeufen') ||
    normalized.includes('als versendet markiert')
  ) {
    return {
      href: '/purchases',
      label: 'Zu meinen Kaeufen',
      secondaryHref: '/sales',
      secondaryLabel: 'Verkaeufe',
    };
  }

  if (
    normalized.includes('gekauft') ||
    normalized.includes('bitte bereite den versand vor') ||
    normalized.includes('hat den erhalt') ||
    normalized.includes('streitfall')
  ) {
    return {
      href: '/sales',
      label: 'Zu meinen Verkaeufen',
      secondaryHref: '/dashboard',
      secondaryLabel: 'Dashboard',
    };
  }

  return {
    href: '/inbox',
    label: 'Zur Inbox',
    secondaryHref: null,
    secondaryLabel: null,
  };
}

export default function NotificationsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<NotificationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/notifications');
        if (response.status === 401) {
          router.replace('/login?callbackUrl=/notifications');
          return;
        }

        const result = await response.json();
        if (!cancelled && result.success) {
          setData(result.data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = CHANNELS.user(userId);
    const channel = pusher.subscribe(channelName);

    const handleNotification = (event: RealtimeNotificationEvent) => {
      setData((current) => {
        if (!current) {
          return {
            notifications: [event],
            unreadNotifications: 1,
            unreadMessages: 0,
          };
        }

        const nextNotifications = current.notifications.some((notification) => notification.id === event.id)
          ? current.notifications
          : [event, ...current.notifications];

        return {
          ...current,
          notifications: nextNotifications,
          unreadNotifications: current.unreadNotifications + 1,
        };
      });
    };

    const handleNewMessage = (event: RealtimeMessageEvent) => {
      if (event.message.receiverId !== userId) return;
      setData((current) =>
        current
          ? {
              ...current,
              unreadMessages: current.unreadMessages + 1,
            }
          : current
      );
    };

    channel.bind(EVENTS.NOTIFICATION, handleNotification);
    channel.bind(EVENTS.NEW_MESSAGE, handleNewMessage);

    return () => {
      channel.unbind(EVENTS.NOTIFICATION, handleNotification);
      channel.unbind(EVENTS.NEW_MESSAGE, handleNewMessage);
      pusher.unsubscribe(channelName);
    };
  }, [session?.user?.id]);

  const handleMarkAllRead = async () => {
    if (!data || data.unreadNotifications === 0 || markingRead) return;

    setMarkingRead(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Benachrichtigungen konnten nicht aktualisiert werden.');
      }

      setData((current) =>
        current
          ? {
              ...current,
              unreadNotifications: 0,
              notifications: current.notifications.map((notification) => ({
                ...notification,
                isRead: true,
              })),
            }
          : current
      );
    } finally {
      setMarkingRead(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-6" style={{ background: 'var(--color-bg)' }}>
      <div className="container max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
              Benachrichtigungen
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Systemhinweise und neue Aktivitaeten aus `/api/notifications`.
            </p>
          </div>
          <button
            onClick={handleMarkAllRead}
            disabled={!data || data.unreadNotifications === 0 || markingRead}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: 'var(--color-primary)' }}
          >
            {markingRead ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            Alles als gelesen markieren
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  Ungelesene Hinweise
                </p>
                <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {data?.unreadNotifications || 0}
                </p>
              </div>
              <Link href="/inbox" className="rounded-3xl border p-5 transition-colors hover:bg-[var(--color-bg-card)]" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                      Ungelesene Nachrichten
                    </p>
                    <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
                      {data?.unreadMessages || 0}
                    </p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Direkt zur Inbox wechseln
                    </p>
                  </div>
                  <MessageCircle size={22} style={{ color: 'var(--color-primary)' }} />
                </div>
              </Link>
            </div>

            {data && data.notifications.length > 0 ? (
              <div className="space-y-4">
                {data.notifications.map((notification) => {
                  const action = getNotificationAction(notification);

                  return (
                    <div
                      key={notification.id}
                      className="rounded-3xl border p-5"
                      style={{
                        borderColor: notification.isRead ? 'var(--color-border)' : 'var(--color-primary-light)',
                        background: 'var(--color-bg-card)',
                      }}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                            <Bell size={18} />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center gap-2">
                              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                                {notification.sender?.name || 'cssberlin system'}
                              </p>
                              {!notification.isRead ? (
                                <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-white">
                                  Neu
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                              {notification.content}
                            </p>
                            {notification.offer ? (
                              <div className="mt-3 rounded-2xl bg-[var(--color-bg-secondary)] p-3 text-sm" style={{ color: 'var(--color-text)' }}>
                                <p className="font-semibold">{notification.offer.product.title}</p>
                                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                  Angebot {notification.offer.offeredPrice.toFixed(2)} EUR | Status: {notification.offer.status}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          <p>{formatRelativeTime(notification.createdAt)}</p>
                          <div className="mt-3 flex gap-2 md:justify-end">
                            <Link href={action.href} className="rounded-full border px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                              {action.label}
                            </Link>
                            {action.secondaryHref ? (
                              <Link href={action.secondaryHref} className="rounded-full px-3 py-2 text-xs font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                                {action.secondaryLabel}
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed p-12 text-center" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)]">
                  <Bell size={24} />
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>Alles ruhig</h2>
                <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Sobald es neue Systemhinweise oder Angebots-Updates gibt, erscheinen sie hier.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}