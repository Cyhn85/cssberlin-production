'use client';

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import InboxThread from '@/components/messaging/InboxThread';

type PersonaHeader = { id: string; name: string | null };

export default function PersonaInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [persona, setPersona] = useState<PersonaHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch(`/api/admin/personas/${id}`);
      const result = await res.json();
      if (!mounted) return;
      if (result.success) {
        setPersona(result.data);
      } else {
        setError(result.error || 'Profil nicht gefunden.');
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 size={26} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (error || !persona) {
    return <p className="text-sm text-red-600">{error || 'Profil nicht gefunden.'}</p>;
  }

  return <InboxThread selfId={persona.id} apiBase={`/api/personas/${persona.id}/messages`} title={`Postfach: ${persona.name || 'Verkaeufer-Profil'}`} />;
}
