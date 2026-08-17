'use client';

import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import InboxThread from '@/components/messaging/InboxThread';

export default function InboxPage() {
  const { data: session, status } = useSession();

  if (status === 'loading' || !session?.user?.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  return <InboxThread selfId={session.user.id} apiBase="/api/messages" title="Inbox" />;
}
