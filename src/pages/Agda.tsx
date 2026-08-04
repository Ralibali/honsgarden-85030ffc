import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User, Sparkles, Lock, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { readScoped, writeScoped, removeScoped } from '@/lib/userScopedStorage';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'agda-chat-history';
const MAX_STORED_MESSAGES = 50;

const STARTER_SUGGESTIONS = [
  { emoji: '🥚', text: 'Varför har mina hönor slutat värpa?' },
  { emoji: '🏆', text: 'Vilka hönor värper bäst just nu?' },
  { emoji: '❄️', text: 'Hur förbereder jag hönshuset inför vintern?' },
  { emoji: '📊', text: 'Ge mig en sammanfattning av min flock!' },
  { emoji: '🪶', text: 'Vad ska jag göra om en höna tappar fjädrar?' },
  { emoji: '📈', text: 'Tips för att öka äggproduktionen?' },
];

function loadHistory(userId: string | null | undefined): ChatMessage[] {
  try {
    const raw = readScoped(userId, STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_STORED_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveHistory(userId: string | null | undefined, messages: ChatMessage[]) {
  try {
    writeScoped(userId, STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
  } catch { /* quota exceeded */ }
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agda-chat`;

async function streamAgda({
  message,
  history,
  onDelta,
  onDone,
  onError,
  onQuota,
}: {
  message: string;
  history: ChatMessage[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  onQuota?: (remaining: number) => void;
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      onError('Du måste vara inloggad för att prata med Agda');
      return;
    }

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message, history: history.slice(-20) }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        onError('Agda har för många samtal just nu. Försök igen om en liten stund! 🐔');
        return;
      }
      if (resp.status === 402) {
        onError('AI-krediter slut. Kontakta support för att fylla på.');
        return;
      }
      let errMsg = 'Kunde inte nå Agda';
      try {
        const errData = await resp.json();
        errMsg = errData.message || errData.error || errMsg;
      } catch (parseErr) {
        console.warn('[Agda] Kunde inte tolka felsvar:', parseErr);
      }
      onError(errMsg);
      return;
    }

    if (!resp.body) {
      onError('Ingen data från Agda');
      return;
    }

    const remaining = Number(resp.headers.get('X-Agda-Remaining'));
    if (onQuota && Number.isFinite(remaining)) onQuota(remaining);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Nätverksfel');
  }
}

export default function Agda() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === 'premium';
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(user?.id));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [quotaLeft, setQuotaLeft] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const assistantContentRef = useRef('');

  // Reload history when user changes
  useEffect(() => {
    setMessages(loadHistory(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages]);

  // Save history whenever messages change
  useEffect(() => {
    if (messages.length > 0) saveHistory(user?.id, messages);
  }, [messages, user?.id]);

  const clearHistory = () => {
    setMessages([]);
    removeScoped(user?.id, STORAGE_KEY);
    toast({ title: '🗑️ Historik rensad' });
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    assistantContentRef.current = '';

    await streamAgda({
      message: text.trim(),
      history: newMessages,
      onQuota: setQuotaLeft,
      onDelta: (chunk) => {
        assistantContentRef.current += chunk;
        const current = assistantContentRef.current;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: current } : m);
          }
          return [...prev, { role: 'assistant', content: current }];
        });
      },
      onDone: () => {
        setLoading(false);
        inputRef.current?.focus();
      },
      onError: (err) => {
        toast({ title: 'Fel', description: err, variant: 'destructive' });
        setLoading(false);
        inputRef.current?.focus();
      },
    });
  }, [messages, loading]);

  if (!isPremium) {
    return (
      <motion.div
        className="max-w-2xl mx-auto space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Agda 🐔</h1>
          <p className="text-sm text-muted-foreground mt-1">Din AI-hönskonsult</p>
        </div>
        <Card className="border-primary/20 bg-primary/3 shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-serif text-foreground">Agda är en Plus-funktion</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Med Plus kan du ställa frågor till Agda – din AI-hönskonsult som svarar baserat på din egna logghistorik, med kunskap om raser, sjukdomar, foder och säsonger.
            </p>
            <Button className="rounded-xl gap-1.5" onClick={() => window.location.href = '/app/premium'}>
              <Sparkles className="h-4 w-4" /> Uppgradera till Plus
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="max-w-2xl mx-auto flex flex-col"
      style={{ height: 'calc(100vh - 8rem)' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              className="absolute -inset-1 rounded-2xl bg-primary/25 blur-md"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xl">
              🐔
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Agda</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Fråga om dina höns – hon känner din flock</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {quotaLeft !== null && (
            <span
              className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                quotaLeft <= 10 ? 'bg-warning/15 text-warning' : 'bg-muted/50 text-muted-foreground'
              }`}
              title="Månadens Agda-frågor"
            >
              {quotaLeft} frågor kvar
            </span>
          )}
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground/50 hover:text-destructive gap-1.5 rounded-xl text-xs"
              onClick={clearHistory}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Rensa
            </Button>
          )}
        </div>
      </div>

      <Card className="flex-1 border-border shadow-sm overflow-hidden flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
              <div className="relative mb-4">
                <motion.div
                  className="absolute -inset-2 rounded-3xl bg-primary/20 blur-lg"
                  animate={{ opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <span className="text-3xl">🐔</span>
                </div>
              </div>
              <h3 className="font-serif text-lg text-foreground mb-1">Hej! Jag är Agda.</h3>
              <p className="text-sm text-muted-foreground mb-2 max-w-sm">
                Jag kan svara på frågor om dina höns baserat på din logghistorik. Jag har kunskap om raser, sjukdomar, foder och årstider.
              </p>
              <p className="text-[10px] text-muted-foreground/60 mb-6 max-w-xs">
                💡 Jag kommer ihåg vår konversation så du kan ställa följdfrågor
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {STARTER_SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => sendMessage(s.text)}
                    className="text-left text-xs p-3 rounded-xl border border-border/60 bg-muted/20 hover:border-primary/30 hover:bg-primary/5 hover:-translate-y-0.5 transition-all text-muted-foreground hover:text-foreground"
                  >
                    <span className="mr-1.5">{s.emoji}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={`${i}-${msg.role}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm">🐔</span>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md shadow-[0_4px_16px_hsl(var(--primary)/0.25)]'
                      : 'bg-gradient-to-br from-primary/8 to-accent/5 border border-primary/10 text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-foreground [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-accent" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm">🐔</span>
              </div>
              <div className="bg-gradient-to-br from-primary/8 to-accent/5 border border-primary/10 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2.5">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary/50"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">Agda skriver…</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border bg-background">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              placeholder="Skriv till Agda..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-full border-border/60 h-11 px-4 focus-visible:ring-primary/30"
              disabled={loading}
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              className="h-11 w-11 rounded-full p-0 shadow-[0_4px_16px_hsl(var(--primary)/0.3)]"
              disabled={!input.trim() || loading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </motion.div>
  );
}
