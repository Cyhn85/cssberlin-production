'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bot, MapPin, Send, Sparkles, User, X } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PAGE_CONTEXT_LABELS: Array<{ test: (path: string) => boolean; label: string }> = [
  { test: (p) => p === '/', label: 'Startseite' },
  { test: (p) => p.startsWith('/catalog'), label: 'Katalog / Produktsuche' },
  { test: (p) => p.startsWith('/product/'), label: 'Produktdetailseite' },
  { test: (p) => p.startsWith('/checkout'), label: 'Checkout' },
  { test: (p) => p.startsWith('/inbox'), label: 'Nachrichten' },
  { test: (p) => p.startsWith('/offers'), label: 'Preisvorschläge' },
  { test: (p) => p.startsWith('/upload'), label: 'Artikel verkaufen' },
  { test: (p) => p.startsWith('/settings'), label: 'Einstellungen' },
  { test: (p) => p.startsWith('/bestellungen') || p.startsWith('/purchases') || p.startsWith('/sales'), label: 'Meine Bestellungen' },
  { test: (p) => p.startsWith('/geldbeutel'), label: 'Geldbeutel' },
  { test: (p) => p.startsWith('/favorites'), label: 'Favoriten' },
  { test: (p) => p.startsWith('/profile'), label: 'Profilseite' },
  { test: (p) => p.startsWith('/hilfe'), label: 'Hilfe-Center' },
];

const QUICK = ['Wie funktioniert Abholung?', 'Kann ich einen Kauf stornieren?', 'Was kostet der Käuferschutz?', 'Zeig mir Jacken unter 40 €'];

const GREETING = 'Hallo! Ich bin CSS Assist, der KI-Assistent von cssberlin.de. Ich helfe bei Fragen zu Kaufen, Verkaufen, Preisvorschlägen, Versand, Abholung und Stornierung - und suche dir passende Artikel heraus.';

/** Renders **bold**, line breaks and [text](/internal-link). External links are shown as plain text. */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        const parts: React.ReactNode[] = [];
        const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
          if (m.index > last) parts.push(line.slice(last, m.index));
          if (m[1]) {
            const href = m[2];
            parts.push(href.startsWith('/') && !href.startsWith('//')
              ? <Link key={`${li}-${m.index}`} href={href} className="font-semibold text-primary underline">{m[1]}</Link>
              : <span key={`${li}-${m.index}`}>{m[1]}</span>);
          } else if (m[3]) {
            parts.push(<strong key={`${li}-${m.index}`}>{m[3]}</strong>);
          }
          last = m.index + m[0].length;
        }
        if (last < line.length) parts.push(line.slice(last));
        return <Fragment key={li}>{parts}{li < lines.length - 1 ? <br /> : null}</Fragment>;
      })}
    </>
  );
}

export default function AiAssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() || '/';
  const { status } = useSession();
  const pageContextLabel = PAGE_CONTEXT_LABELS.find((e) => e.test(pathname))?.label || 'cssberlin.de';
  const [useContext, setUseContext] = useState(true);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text?: string) => {
    const userMessage = (text ?? input).trim().slice(0, 1000);
    if (!userMessage || isTyping) return;
    // the greeting is UI, not conversation - never send it to the model
    const history: Message[] = [...messages.filter((m, i) => !(i === 0 && m.content === GREETING)), { role: 'user', content: userMessage }];
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsTyping(true);

    try {
      const category = new URLSearchParams(window.location.search).get('category');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-10), pageContext: useContext ? (category ? `${pageContextLabel} (Kategorie: ${category})` : pageContextLabel) : undefined }),
      });

      if (res.status === 429) {
        const j = await res.json().catch(() => null);
        setMessages((p) => [...p, { role: 'assistant', content: j?.error || 'Limit erreicht. Bitte versuche es später erneut.' }]);
        return;
      }

      if ((res.headers.get('content-type') || '').includes('text/event-stream') && res.body) {
        let acc = '';
        setMessages((p) => [...p, { role: 'assistant', content: '' }]);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const delta = JSON.parse(payload).choices?.[0]?.delta?.content || '';
              if (delta) {
                acc += delta;
                setMessages((p) => {
                  const copy = [...p];
                  copy[copy.length - 1] = { role: 'assistant', content: acc };
                  return copy;
                });
              }
            } catch { /* ignore malformed chunk */ }
          }
        }
        if (!acc) {
          setMessages((p) => {
            const copy = [...p];
            copy[copy.length - 1] = { role: 'assistant', content: 'Darauf habe ich gerade keine Antwort. Schau ins [Hilfe-Center](/hilfe) oder schreib uns über das [Kontaktformular](/kontakt).' };
            return copy;
          });
        }
      } else {
        const j = await res.json().catch(() => null);
        setMessages((p) => [...p, { role: 'assistant', content: j?.data?.content || j?.error || 'Der Assistent konnte gerade keine Antwort geben.' }]);
      }
    } catch {
      setMessages((p) => [...p, { role: 'assistant', content: 'Verbindung fehlgeschlagen. Bitte versuche es erneut.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-label="CSS Assist" className="glass-card mb-4 flex h-[min(540px,calc(100vh-8rem))] w-[calc(100vw-32px)] flex-col overflow-hidden border-primary/20 shadow-2xl sm:w-96">
      <div className="flex items-center justify-between bg-primary p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/20"><Sparkles size={20} /></div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">CSS Assist</h3>
            <p className="text-[11px] text-white/80">KI-Assistent · keine echte Person</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Schließen" className="rounded-full p-2 hover:bg-white/10"><X size={20} /></button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 dark:bg-slate-900/50" aria-live="polite">
        <button
          onClick={() => setUseContext((c) => !c)}
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${useContext ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent bg-slate-100 text-slate-400 dark:bg-slate-800'}`}
        >
          <MapPin size={13} className="shrink-0" />
          <span className="flex-1">Seite berücksichtigen: {pageContextLabel}</span>
          <span className="shrink-0">{useContext ? 'an' : 'aus'}</span>
        </button>

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[88%] gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-primary text-white' : 'border bg-white dark:bg-slate-800'}`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} className="text-primary" />}
              </div>
              <div className={`rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-none bg-primary text-white shadow-md' : 'rounded-tl-none border bg-white shadow-sm dark:bg-slate-800'}`}>
                {msg.role === 'assistant' ? <RichText text={msg.content} /> : msg.content}
              </div>
            </div>
          </div>
        ))}
        {isTyping && messages[messages.length - 1]?.role === 'user' ? (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-tl-none border bg-white p-3 dark:bg-slate-800">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/40" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 delay-100" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/80 delay-200" />
            </div>
          </div>
        ) : null}
      </div>

      {!isTyping && messages.length === 1 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {QUICK.map((q) => (
            <button key={q} onClick={() => void send(q)} className="rounded-full border border-primary/20 bg-white px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-white dark:bg-slate-800">
              {q}
            </button>
          ))}
        </div>
      ) : null}

      <div className="border-t bg-white p-4 dark:bg-slate-800">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Frag mich etwas…"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            aria-label="Nachricht an CSS Assist"
            className="h-11 w-full rounded-xl border-none bg-slate-100 pl-4 pr-12 text-sm outline-none focus:ring-2 focus:ring-primary/50 dark:bg-slate-900"
          />
          <button onClick={() => void send()} disabled={!input.trim() || isTyping} aria-label="Senden" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-50">
            <Send size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          KI-Antworten können Fehler enthalten. Verbindlich sind Checkout, <Link href="/agb" className="underline">AGB</Link> und <Link href="/hilfe" className="underline">Hilfe-Center</Link>.
          {status !== 'authenticated' ? ' Für Bestellstatus bitte anmelden.' : ''}
        </p>
      </div>
    </div>
  );
}
