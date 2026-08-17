'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Info,
  Loader2,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import {
  formatPrice,
  formatRelativeTime,
  offerStatusToLabel,
  orderStatusToLabel,
  productStatusToLabel,
} from '@/lib/utils/condition-map';
import { getPusherClient } from '@/lib/pusher-client';
import { CHANNELS, EVENTS } from '@/lib/realtime';

type Partner = {
  id: string;
  name: string | null;
  avatar: string | null;
  username?: string | null;
};

type OfferOrder = {
  id: string;
  status: string;
  createdAt: string;
};

type OfferContext = {
  id: string;
  offeredPrice: number;
  status: string;
  buyerId: string;
  sellerId: string;
  pendingOn?: 'BUYER' | 'SELLER' | null;
  product: {
    id: string;
    title: string;
    price: number;
    status: string;
    images: Array<{ url: string }>;
  };
  orders: OfferOrder[];
};

type ConversationSummary = {
  partnerId: string;
  partner: Partner;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
    receiverId: string;
    isRead: boolean;
    type: 'TEXT' | 'IMAGE' | 'OFFER_ACTION' | 'SYSTEM_INFO';
  } | null;
  unreadCount: number;
  offer?: OfferContext | null;
};

type MessageItem = {
  id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'OFFER_ACTION' | 'SYSTEM_INFO';
  isRead: boolean;
  senderId: string;
  receiverId: string;
  createdAt: string;
  sender: Partner;
  offer?: OfferContext | null;
};

type RealtimeMessageEvent = {
  partnerId: string;
  partner: Partner;
  message: MessageItem;
};

function sortConversations(conversations: ConversationSummary[]) {
  return [...conversations].sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

function appendUniqueMessage(messages: MessageItem[], message: MessageItem) {
  if (messages.some((item) => item.id === message.id)) {
    return messages;
  }

  return [...messages, message].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function getOfferBadge(status: string) {
  switch (status) {
    case 'ACCEPTED':
      return { label: offerStatusToLabel[status] || status, tone: 'bg-emerald-100 text-emerald-700' };
    case 'REJECTED':
      return { label: offerStatusToLabel[status] || status, tone: 'bg-rose-100 text-rose-700' };
    case 'COUNTERED':
      return { label: offerStatusToLabel[status] || status, tone: 'bg-sky-100 text-sky-700' };
    case 'PENDING':
      return { label: offerStatusToLabel[status] || status, tone: 'bg-amber-100 text-amber-800' };
    default:
      return { label: offerStatusToLabel[status] || status, tone: 'bg-slate-200 text-slate-700' };
  }
}

function getAvailabilityBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Aktiv', tone: 'bg-emerald-100 text-emerald-700' };
    case 'RESERVED':
      return { label: 'Reserviert', tone: 'bg-amber-100 text-amber-800' };
    case 'SOLD':
      return { label: 'Verkauft', tone: 'bg-rose-100 text-rose-700' };
    case 'HIDDEN':
      return { label: 'Offline', tone: 'bg-slate-200 text-slate-700' };
    default:
      return { label: productStatusToLabel[status] || status, tone: 'bg-slate-200 text-slate-700' };
  }
}

function getOfferSummary(offer: OfferContext, selfId: string) {
  const latestOrder = offer.orders[0] || null;

  if (latestOrder) {
    return {
      text: `Aus dieser Verhandlung gibt es bereits eine Bestellung: ${orderStatusToLabel[latestOrder.status] || latestOrder.status}.`,
      actionHref: selfId === offer.buyerId ? `/purchases/${latestOrder.id}` : `/sales/${latestOrder.id}`,
      actionLabel: 'Bestellung ansehen',
    };
  }

  if (offer.product.status === 'SOLD') {
    return { text: 'Der Artikel wurde bereits verkauft und kann nicht mehr abgeschlossen werden.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
  }
  if (offer.product.status === 'RESERVED') {
    return { text: 'Der Artikel ist aktuell reserviert. Neue Abschluesse sind vorerst blockiert.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
  }
  if (offer.product.status === 'HIDDEN') {
    return { text: 'Das Listing ist nicht mehr oeffentlich verfuegbar.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
  }
  if (offer.status === 'ACCEPTED' && selfId === offer.buyerId) {
    return {
      text: 'Das Angebot wurde angenommen. Du kannst jetzt mit dem verhandelten Preis in den Checkout gehen.',
      actionHref: `/checkout/${offer.product.id}?offerId=${encodeURIComponent(offer.id)}`,
      actionLabel: 'Jetzt kaufen',
    };
  }
  if (offer.status === 'ACCEPTED') {
    return { text: 'Das Angebot wurde angenommen. Jetzt kann der Kaeufer den Checkout abschliessen.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
  }
  if (offer.status === 'PENDING') {
    return { text: 'Diese Verhandlung ist noch offen.', actionHref: '/offers', actionLabel: 'Verhandlung oeffnen' };
  }
  if (offer.status === 'COUNTERED') {
    return { text: 'Dieser Stand wurde von einer neueren Verhandlungsrunde abgeloest.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
  }
  if (offer.status === 'REJECTED') {
    return { text: 'Diese Verhandlungsrunde wurde beendet.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
  }

  return { text: 'Der aktuelle Status ist in deiner Angebotsuebersicht verfuegbar.', actionHref: '/offers', actionLabel: 'Zu Angeboten' };
}

/**
 * Real conversation UI shared by /inbox (selfId = the signed-in user) and
 * /admin/personas/[id]/inbox (selfId = a persona managed by the signed-in
 * user). apiBase points at the matching real message endpoints - no data
 * shape differs between the two, only whose identity is "self".
 */
export default function InboxThread({ selfId, apiBase, title }: { selfId: string; apiBase: string; title: string }) {
  const searchParams = useSearchParams();
  const requestedPartnerId = searchParams.get('with');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(requestedPartnerId);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [offerActionBusyId, setOfferActionBusyId] = useState<string | null>(null);
  const [expandedCounterOfferId, setExpandedCounterOfferId] = useState<string | null>(null);
  const [counterDrafts, setCounterDrafts] = useState<Record<string, string>>({});
  const [offerActionError, setOfferActionError] = useState<string | null>(null);

  const refreshActiveConversationMessages = async (partnerId: string) => {
    const response = await fetch(`${apiBase}/${partnerId}`);
    const result = await response.json();
    if (result.success) {
      setMessages(result.data.messages || []);
    }
  };

  const submitInlineOfferAction = async (offer: OfferContext, action: 'accept' | 'reject' | 'counter') => {
    if (!activePartnerId || offerActionBusyId) return;
    const counterPrice = action === 'counter' ? Number((counterDrafts[offer.id] || '').replace(',', '.')) : undefined;
    if (action === 'counter' && (!counterPrice || Number.isNaN(counterPrice))) {
      setOfferActionError('Bitte gib einen gueltigen Gegenpreis ein.');
      return;
    }

    setOfferActionError(null);
    setOfferActionBusyId(offer.id);
    try {
      const response = await fetch(`/api/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, counterPrice }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setOfferActionError(result?.error || 'Aktion konnte nicht ausgefuehrt werden.');
        return;
      }
      setExpandedCounterOfferId(null);
      await refreshActiveConversationMessages(activePartnerId);
    } finally {
      setOfferActionBusyId(null);
    }
  };

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.partnerId === activePartnerId) || null,
    [activePartnerId, conversations]
  );

  const activeOffer = activeConversation?.offer || messages.find((message) => message.offer)?.offer || null;
  const activeOfferSummary = activeOffer ? getOfferSummary(activeOffer, selfId) : null;

  useEffect(() => {
    if (requestedPartnerId) {
      setActivePartnerId(requestedPartnerId);
    }
  }, [requestedPartnerId]);

  useEffect(() => {
    let mounted = true;

    const loadConversations = async () => {
      try {
        const response = await fetch(apiBase);
        const result = await response.json();
        if (!mounted) return;
        if (result.success) {
          const list: ConversationSummary[] = result.data?.conversations || result.data || [];
          setConversations(sortConversations(list));
          if (!requestedPartnerId && !activePartnerId && list.length) {
            setActivePartnerId(list[0].partnerId);
          }
        }
      } finally {
        if (mounted) setLoadingConversations(false);
      }
    };

    void loadConversations();
    const interval = window.setInterval(loadConversations, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePartnerId, requestedPartnerId, apiBase]);

  useEffect(() => {
    const loadConversation = async () => {
      if (!activePartnerId) return;
      setLoadingMessages(true);

      try {
        const response = await fetch(`${apiBase}/${activePartnerId}`);
        const result = await response.json();
        if (result.success) {
          setMessages(result.data.messages || []);
          setPartner(result.data.partner || null);
          setConversations((current) =>
            current.map((conversation) =>
              conversation.partnerId === activePartnerId ? { ...conversation, unreadCount: 0 } : conversation
            )
          );
          return;
        }

        const profileResponse = await fetch(`/api/users/${activePartnerId}`);
        const profileResult = await profileResponse.json();
        if (profileResult.success) {
          setMessages([]);
          setPartner({
            id: profileResult.data.id,
            name: profileResult.data.name,
            avatar: profileResult.data.avatar,
            username: profileResult.data.username,
          });
        }
      } finally {
        setLoadingMessages(false);
      }
    };

    void loadConversation();
    const interval = window.setInterval(loadConversation, 20000);
    return () => window.clearInterval(interval);
  }, [activePartnerId, apiBase]);

  useEffect(() => {
    if (!selfId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = CHANNELS.user(selfId);
    const channel = pusher.subscribe(channelName);

    const handleNewMessage = async (event: RealtimeMessageEvent) => {
      const isActiveThread = event.partnerId === activePartnerId;
      const isIncoming = event.message.receiverId === selfId;

      setConversations((current) => {
        const existing = current.find((conversation) => conversation.partnerId === event.partnerId);
        const unreadCount = isIncoming ? (isActiveThread ? 0 : (existing?.unreadCount || 0) + 1) : 0;

        const nextConversation: ConversationSummary = {
          partnerId: event.partnerId,
          partner: event.partner,
          lastMessage: event.message,
          unreadCount,
          offer: event.message.offer || existing?.offer || null,
        };

        if (!existing) {
          return sortConversations([nextConversation, ...current]);
        }

        return sortConversations(
          current.map((conversation) => (conversation.partnerId === event.partnerId ? nextConversation : conversation))
        );
      });

      if (isActiveThread) {
        setPartner(event.partner);
        setMessages((current) => appendUniqueMessage(current, event.message));

        if (isIncoming) {
          try {
            await fetch(`${apiBase}/${event.partnerId}/read`, { method: 'POST' });
          } catch {
            // Polling fallback will keep the read state in sync.
          }
        }
      }
    };

    channel.bind(EVENTS.NEW_MESSAGE, handleNewMessage);

    return () => {
      channel.unbind(EVENTS.NEW_MESSAGE, handleNewMessage);
      pusher.unsubscribe(channelName);
    };
  }, [activePartnerId, selfId, apiBase]);

  const handleSend = async () => {
    if (!activePartnerId || !messageInput.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: activePartnerId, content: messageInput.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Nachricht konnte nicht gesendet werden.');
      }

      setMessages((current) => appendUniqueMessage(current, result.data));
      setMessageInput('');

      setConversations((current) => {
        const existing = current.find((conversation) => conversation.partnerId === activePartnerId);
        if (existing) {
          return sortConversations(
            current.map((conversation) =>
              conversation.partnerId === activePartnerId
                ? { ...conversation, lastMessage: result.data, offer: result.data.offer || conversation.offer || null }
                : conversation
            )
          );
        }

        return sortConversations([
          {
            partnerId: activePartnerId,
            partner: partner || { id: activePartnerId, name: 'Neue Unterhaltung', avatar: null },
            lastMessage: result.data,
            unreadCount: 0,
            offer: result.data.offer || null,
          },
          ...current,
        ]);
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen pt-2" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-[1200px] flex-col overflow-hidden border-x border-b md:flex-row" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}>
        <div className="flex w-full shrink-0 flex-col border-r md:w-[340px] lg:w-[380px]" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex h-14 items-center border-b px-4 text-lg font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            {title}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={26} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              </div>
            ) : conversations.length > 0 ? (
              conversations.map((conversation) => {
                const isActive = conversation.partnerId === activePartnerId;
                const conversationOfferSummary = conversation.offer ? getOfferSummary(conversation.offer, selfId) : null;
                return (
                  <button
                    key={conversation.partnerId}
                    onClick={() => setActivePartnerId(conversation.partnerId)}
                    className={`w-full border-b p-4 text-left transition-colors hover:bg-[var(--color-bg-secondary)] ${isActive ? 'bg-[var(--color-bg-secondary)]' : ''}`}
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-light)] font-bold text-white">
                        {(conversation.partner.name || conversation.partner.username || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <h4 className={`truncate text-sm ${conversation.unreadCount > 0 ? 'font-bold' : 'font-medium'}`} style={{ color: 'var(--color-text)' }}>
                            {conversation.partner.name || conversation.partner.username || 'cssberlin member'}
                          </h4>
                          <span className="shrink-0 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {conversation.lastMessage ? formatRelativeTime(conversation.lastMessage.createdAt) : 'neu'}
                          </span>
                        </div>
                        <p className="truncate text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {conversation.lastMessage?.content || 'Noch keine Nachricht'}
                        </p>
                        {conversation.offer ? (
                          <p className="mt-1 truncate text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                            {conversationOfferSummary?.text || 'Angebotsstatus verfuegbar'}
                          </p>
                        ) : null}
                      </div>
                      {conversation.unreadCount > 0 ? <span className="rounded-full bg-[var(--color-error)] px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unreadCount}</span> : null}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Noch keine Unterhaltungen.
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col bg-gray-50/30">
          <div className="flex h-14 items-center justify-between border-b bg-white px-6" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h2 className="font-bold text-[var(--color-primary-dark)]">{partner?.name || partner?.username || 'Unterhaltung'}</h2>
              {partner?.username ? <p className="text-xs text-gray-400">@{partner.username}</p> : null}
            </div>
            <button className="text-gray-400 hover:text-gray-600">
              <Info size={20} />
            </button>
          </div>

          {activeOffer?.product ? (
            <div className="border-b bg-white p-4 shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                    {activeOffer.product.images[0]?.url ? (
                      <img src={activeOffer.product.images[0].url} alt={activeOffer.product.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${getOfferBadge(activeOffer.status).tone}`}>
                        {getOfferBadge(activeOffer.status).label}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${getAvailabilityBadge(activeOffer.product.status).tone}`}>
                        {getAvailabilityBadge(activeOffer.product.status).label}
                      </span>
                      {activeOffer.orders[0] ? (
                        <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                          {orderStatusToLabel[activeOffer.orders[0].status] || activeOffer.orders[0].status}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {activeOffer.product.title}
                    </h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Listenpreis {formatPrice(activeOffer.product.price)}
                    </p>
                    <p className="mt-0.5 text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                      Verhandlungspreis {formatPrice(activeOffer.offeredPrice)}
                    </p>
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {activeOfferSummary?.text}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {activeOfferSummary ? (
                    <Link href={activeOfferSummary.actionHref} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                      {activeOfferSummary.actionLabel} <ArrowRight size={14} />
                    </Link>
                  ) : null}
                  <Link href={`/product/${activeOffer.product.id}`} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    Produkt ansehen
                  </Link>
                  <Link href="/offers" className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    <ShoppingBag size={14} /> Angebote
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {!activePartnerId ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <MessageCircle size={32} className="mx-auto mb-4" style={{ color: 'var(--color-primary)' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Waehle links eine Unterhaltung aus.</p>
                </div>
              </div>
            ) : loadingMessages ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 shadow-sm">
                  <div className="flex gap-3">
                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                    <p>
                      Preise, Angebote und Nachweise bleiben innerhalb des Systems nachvollziehbar. Das hilft bei Schutzfaellen und beim Abschluss der Bestellung.
                    </p>
                  </div>
                </div>

                {offerActionError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{offerActionError}</div>
                ) : null}

                {messages.length > 0 ? messages.map((message) => {
                  const isOwn = message.senderId === selfId;
                  const messageOfferSummary = message.offer ? getOfferSummary(message.offer, selfId) : null;
                  const myRole = message.offer && selfId === message.offer.buyerId ? 'BUYER' : 'SELLER';
                  const canActOnOffer =
                    !!message.offer &&
                    message.offer.pendingOn === myRole &&
                    message.offer.orders.length === 0 &&
                    message.offer.product.status === 'ACTIVE';
                  return (
                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isOwn ? 'rounded-tr-sm bg-[var(--color-primary)] text-white' : 'rounded-tl-sm bg-white'}`}
                        style={!isOwn ? { border: '1px solid var(--color-border)', color: 'var(--color-text)' } : undefined}
                      >
                        {message.offer ? (
                          <div className="mb-3 rounded-xl bg-black/5 p-3 text-xs">
                            <div className="mb-2 flex flex-wrap gap-2">
                              <span className={`rounded-full px-2 py-1 font-bold ${getOfferBadge(message.offer.status).tone}`}>
                                {getOfferBadge(message.offer.status).label}
                              </span>
                              <span className={`rounded-full px-2 py-1 font-bold ${getAvailabilityBadge(message.offer.product.status).tone}`}>
                                {getAvailabilityBadge(message.offer.product.status).label}
                              </span>
                            </div>
                            <p className="font-bold">Angebot: {formatPrice(message.offer.offeredPrice)}</p>
                            <p className="mt-1">{message.offer.product.title}</p>
                            <p className="mt-2 opacity-80">{messageOfferSummary?.text}</p>

                            {canActOnOffer ? (
                              <div className="mt-3 space-y-2 border-t border-black/10 pt-3">
                                {expandedCounterOfferId === message.offer.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="Preis in EUR"
                                      value={counterDrafts[message.offer.id] || ''}
                                      onChange={(event) =>
                                        setCounterDrafts((current) => ({ ...current, [message.offer!.id]: event.target.value }))
                                      }
                                      className="w-24 rounded-lg border px-2 py-1.5 text-xs text-gray-800"
                                      style={{ borderColor: 'var(--color-border)' }}
                                    />
                                    <button
                                      onClick={() => submitInlineOfferAction(message.offer!, 'counter')}
                                      disabled={offerActionBusyId === message.offer.id}
                                      className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white"
                                      style={{ background: 'var(--color-primary)' }}
                                    >
                                      Senden
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={() => submitInlineOfferAction(message.offer!, 'accept')}
                                      disabled={offerActionBusyId === message.offer.id}
                                      className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                                      style={{ background: 'var(--color-primary)' }}
                                    >
                                      Annehmen
                                    </button>
                                    <button
                                      onClick={() => setExpandedCounterOfferId(message.offer!.id)}
                                      disabled={offerActionBusyId === message.offer.id}
                                      className="rounded-full border px-3 py-1.5 text-[11px] font-bold disabled:opacity-60"
                                      style={{ borderColor: 'var(--color-orange)', color: isOwn ? '#fff' : 'var(--color-orange)' }}
                                    >
                                      Gegenangebot
                                    </button>
                                    <button
                                      onClick={() => submitInlineOfferAction(message.offer!, 'reject')}
                                      disabled={offerActionBusyId === message.offer.id}
                                      className="rounded-full px-3 py-1.5 text-[11px] font-bold text-rose-600 disabled:opacity-60"
                                      style={{ background: 'rgba(225,29,72,0.1)' }}
                                    >
                                      Ablehnen
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <p>{message.content}</p>
                        <p className={`mt-2 text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                          {formatRelativeTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <p className="mb-2 font-semibold" style={{ color: 'var(--color-text)' }}>Neue Unterhaltung</p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        Schick die erste Nachricht an {partner?.name || partner?.username || 'diese Person'}.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t bg-white p-4" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-3 rounded-xl border bg-gray-100 px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
              <input
                type="text"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={activePartnerId ? 'Schreibe hier deine Nachricht' : 'Waehle zuerst eine Unterhaltung'}
                disabled={!activePartnerId || sending}
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!activePartnerId || !messageInput.trim() || sending}
                className={`transition-colors ${messageInput.trim() ? 'text-[var(--color-primary)]' : 'text-gray-400'}`}
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={20} />}
              </button>
            </div>
            {!activePartnerId ? (
              <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Noch keine Konversation? Oeffne ein Produkt und nutze &quot;Verkaeufer kontaktieren&quot;.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
