'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    X,
    Send,
    User,
    Bot,
    ArrowRight,
    ShieldCheck,
    MessageCircle
} from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AiAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: 'Hallo! Ich bin der cssberlin KI-Assistent. Frag mich zu Versand, Kaeuferschutz, Verkaufen oder allem rund um nachhaltige Second-Hand-Mode.',
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        const nextMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
        setMessages(nextMessages);
        setInput('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: nextMessages }),
            });

            if (response.status === 401) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Melde dich an, um den KI-Assistenten zu nutzen.' }]);
                return;
            }

            if (response.status === 429) {
                setMessages(prev => [...prev, { role: 'assistant', content: 'Du hast das Anfragelimit erreicht. Versuche es in einer Stunde erneut.' }]);
                return;
            }

            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('text/event-stream') && response.body) {
                let accumulated = '';
                setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        const payload = trimmed.slice(5).trim();
                        if (!payload || payload === '[DONE]') continue;
                        try {
                            const json = JSON.parse(payload);
                            const delta = json.choices?.[0]?.delta?.content || '';
                            if (delta) {
                                accumulated += delta;
                                setMessages(prev => {
                                    const copy = [...prev];
                                    copy[copy.length - 1] = { role: 'assistant', content: accumulated };
                                    return copy;
                                });
                            }
                        } catch {
                            // ignore malformed SSE chunk
                        }
                    }
                }
            } else {
                const json = await response.json();
                const payload = json.data ?? json;
                const content = payload?.content || 'Der Assistent konnte gerade keine Antwort generieren.';
                setMessages(prev => [...prev, { role: 'assistant', content }]);
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Verbindung zum Assistenten fehlgeschlagen. Bitte versuche es erneut.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    const quickLinks = [
        'Wie verkaufe ich?',
        'Was ist Kaeuferschutz?',
        'Wie funktioniert Versand?',
    ];

    return (
        <div className="fixed bottom-24 right-4 md:right-8 z-[90]">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 20, transformOrigin: 'bottom right' }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        className="mb-4 w-[calc(100vw-32px)] sm:w-96 glass-card overflow-hidden shadow-2xl border-primary/20 flex flex-col h-[500px]"
                    >
                        <div className="p-4 bg-primary text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                    <Sparkles size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm tracking-tight">KI-Assistent</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-300" />
                                        <span className="text-[10px] text-white/80 font-medium uppercase tracking-widest">Live</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50"
                        >
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                                KI-gestuetzter Assistent. Er ersetzt keine verbindliche Produkt-, Checkout- oder Rechtshinweis-Seite.
                            </div>

                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10, x: msg.role === 'user' ? 10 : -10 }}
                                    animate={{ opacity: 1, y: 0, x: 0 }}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border'}`}>
                                            {msg.role === 'user' ? <User size={14} /> : <Bot size={14} className="text-primary" />}
                                        </div>
                                        <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                ? 'bg-primary text-white rounded-tr-none shadow-md'
                                                : 'bg-white dark:bg-slate-800 border rounded-tl-none shadow-sm'
                                            }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white dark:bg-slate-800 border p-3 rounded-2xl rounded-tl-none flex gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce delay-100" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce delay-200" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isTyping && messages.length === 1 && (
                            <div className="px-4 pb-2 flex flex-wrap gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                                {quickLinks.map(link => (
                                    <button
                                        key={link}
                                        onClick={() => { setInput(link); }}
                                        className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
                                    >
                                        {link}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="p-4 bg-white dark:bg-slate-800 border-t">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Kurze Frage stellen..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    className="w-full h-11 pl-4 pr-12 rounded-xl bg-slate-100 dark:bg-slate-900 border-none text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 cursor-pointer"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                            <p className="text-[10px] text-center mt-2 text-muted-foreground">
                                KI-gestuetzt &ndash; bei wichtigen Fragen bitte Checkout- und Rechtsseiten pruefen
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center relative group cursor-pointer"
            >
                {isOpen ? (
                    <X size={28} />
                ) : (
                    <MessageCircle size={28} />
                )}

                {!isOpen && (
                    <div className="absolute right-full mr-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        KI-Assistent
                    </div>
                )}
            </motion.button>
        </div>
    );
}