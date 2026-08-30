import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Check, Send, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { readScoped, writeScoped, removeScoped } from '@/lib/userScopedStorage';
import PageHeader from '@/components/PageHeader';
import { assessHealthUrgency, HEALTH_ESCALATION_NOTICE, HEALTH_GENERAL_NOTICE } from '@/lib/agdaHealthGuard';
import { Stethoscope } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Satt deterministiskt av agdaHealthGuard när användarens fråga rör hälsa. */
  healthUrgency?: 'health' | 'urgent';
}

const STORAGE_KEY = 'agda-chat-history';
const MAX_STORED_MESSAGES = 50;

const STARTER_SUGGESTIONS = [
  { emoji: '🥚', text: 'Varför värper flocken mindre just nu?' },
  { emoji: '🐔', text: 'Hur mår min flock utifrån det jag loggat?' },
  { emoji: '🌾', text: 'Vad ska jag tänka på kring foder just nu?' },
  { emoji: '🍂', text: 'Vad är viktigt för hönsen den här årstiden?' },
  { emoji: '🪶', text: 'En höna tappar fjädrar – vad kan det bero på?' },
  { emoji: '✨', text: 'Ge mig tre saker att hålla koll på denna vecka' },
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
  } catch {
    // localStorage kan vara fullt eller blockerat
  }
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

    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message, history: history.slice(-20) }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        onError('Agda har många samtal just nu. Försök igen om en liten stund! 🐔');
        return;
      }
      if (response.status === 402) {
        onError('Agdas AI-krediter är tillfälligt slut. Försök igen senare.');
        return;
      }
      let errorMessage = 'Kunde inte nå Agda';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // använd det vänliga standardfelet
      }
      onError(errorMessage);
      return;
    }

    if (!response.body) {
      onError('Agda svarade inte den här gången. Försök igen.');
      return;
    }

    const remaining = Number(response.headers.get('X-Agda-Remaining'));
    if (onQuota && Number.isFinite(remaining)) onQuota(remaining);

    const reader = response.body.getReader();
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
        if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;

        const json = line.slice(6).trim();
        if (json === '[DONE]') break;

        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = `${line}\n${textBuffer}`;
          break;
        }
      }
    }

    if (textBuffer.trim()) {
      for (let line of textBuffer.split('\n')) {
        if (!line) continue;
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') continue;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          // ignorera ofullständig sista rad
        }
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Nätverksfel');
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

  useEffect(() => {
    setMessages(loadHistory(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) saveHistory(user?.id, messages);
  }, [messages, user?.id]);

  const clearHistory = () => {
    setMessages([]);
    removeScoped(user?.id, STORAGE_KEY);
    toast({ title: 'Samtalet är rensat' });
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    // Hälsoguard: deterministisk klassificering innan AI:n anropas. Svaret
    // blockeras aldrig – men en fast, mänskligt skriven säkerhetsnotis
    // följer alltid med hälsorelaterade frågor.
    const guard = assessHealthUrgency(text);
    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      ...(guard.urgency !== 'none' ? { healthUrgency: guard.urgency } : {}),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    assistantContentRef.current = '';

    await streamAgda({
      message: text.trim(),
      history: nextMessages,
      onQuota: setQuotaLeft,
      onDelta: (chunk) => {
        assistantContentRef.current += chunk;
        const current = assistantContentRef.current;
        setMessages((previous) => {
          const last = previous[previous.length - 1];
          if (last?.role === 'assistant') {
            return previous.map((message, index) => index === previous.length - 1 ? { ...message, content: current } : message);
          }
          return [...previous, { role: 'assistant', content: current }];
        });
      },
      onDone: () => {
        setLoading(false);
        inputRef.current?.focus();
      },
      onError: (error) => {
        toast({ title: 'Agda kunde inte svara', description: error, variant: 'destructive' });
        setLoading(false);
        inputRef.current?.focus();
      },
    });
  }, [messages, loading]);

  if (!isPremium) {
    return (
      <motion.div
        className="agda-preview max-w-3xl mx-auto space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <PageHeader
          title="Agda"
          emoji="🐔"
          subtitle="Din gårdskompis som känner flocken och hjälper dig se sådant som är lätt att missa"
        />

        <Card className="agda-invite-card overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-7 items-center">
              <div>
                <p className="data-label">Ingår i Plus</p>
                <h2 className="font-serif text-2xl sm:text-3xl text-foreground mt-2 leading-tight">
                  Fråga någon som redan känner din hönsgård
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-3">
                  Agda kan använda det du redan loggat – flocken, äggen, årstiden och dina rutiner – för att ge mer relevanta svar än en vanlig generell chatt.
                </p>

                <div className="space-y-2.5 mt-5">
                  {[
                    'Förklarar förändringar i värpningen på vanlig svenska',
                    'Hjälper dig tänka kring hälsa, foder och årstid',
                    'Minns samtalet så att följdfrågor känns naturliga',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-foreground/85">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <Button className="mt-6 rounded-xl h-11 gap-2" onClick={() => window.location.href = '/app/premium'}>
                  Möt Agda med Plus <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="agda-preview-note">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">🐔</div>
                  <div>
                    <p className="font-serif text-lg text-foreground">Agda</p>
                    <p className="text-xs text-muted-foreground">Ett exempel på hur hon tänker</p>
                  </div>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  “Jag ser att äggen gått ned lite senaste veckan. Det kan vara helt normalt, särskilt om vädret ändrats eller någon höna börjat rugga. Jag hade först tittat på tre saker…”
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span>🥚 Värpning</span>
                  <span>🌦️ Väder</span>
                  <span>🐔 Flocken</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="agda-chat-page max-w-3xl mx-auto flex flex-col"
      style={{ height: 'calc(100dvh - 8rem)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="agda-chat-header flex items-center justify-between gap-3 mb-4 px-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="agda-avatar w-11 h-11 rounded-2xl flex items-center justify-center text-xl">🐔</div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
          </div>
          <div className="min-w-0">
            <p className="data-label">Din gårdskompis</p>
            <h1 className="text-2xl sm:text-3xl font-serif text-foreground leading-none mt-1">Agda</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 truncate">Fråga om flocken, äggen eller det som känns lite konstigt idag</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {quotaLeft !== null && (
            <span className={`text-[10px] font-medium px-2.5 py-1.5 rounded-full ${quotaLeft <= 10 ? 'bg-warning/15 text-warning' : 'bg-muted/50 text-muted-foreground'}`}>
              {quotaLeft} kvar
            </span>
          )}
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground/60 hover:text-destructive" onClick={clearHistory} aria-label="Rensa samtalet">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Card className="agda-conversation flex-1 overflow-hidden flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.length === 0 && (
            <div className="agda-empty flex flex-col justify-center min-h-full py-6 sm:py-10">
              <div className="max-w-xl mx-auto w-full text-center">
                <div className="agda-empty-avatar w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-3xl">🐔</div>
                <p className="data-label mt-5">Hej, jag är Agda</p>
                <h2 className="font-serif text-2xl text-foreground mt-1">Vad funderar du på idag?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2 max-w-md mx-auto">
                  Jag kan resonera utifrån det du loggat i Hönsgården och hjälpa dig sortera vad som är normalt, vad som är värt att följa och vad du kan göra härnäst.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6 text-left">
                  {STARTER_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.text}
                      onClick={() => sendMessage(suggestion.text)}
                      className="agda-suggestion min-h-12 p-3.5 text-sm transition-all"
                    >
                      <span className="mr-2">{suggestion.emoji}</span>
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={`${index}-${message.role}`}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className={`agda-message-row flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex flex-col gap-2 max-w-full">
                  <div className={`agda-message ${message.role === 'user' ? 'agda-message--user' : 'agda-message--assistant'}`}>
                    {message.role === 'assistant' && (
                      <div className="agda-message-name"><span>🐔</span> Agda</div>
                    )}
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_h2]:text-base [&_h2]:font-serif [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-foreground">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                  {message.role === 'user' && message.healthUrgency && (
                    <div
                      role="note"
                      className={`agda-health-notice flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed ${
                        message.healthUrgency === 'urgent'
                          ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100'
                          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100'
                      }`}
                    >
                      <Stethoscope className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
                      <span>{message.healthUrgency === 'urgent' ? HEALTH_ESCALATION_NOTICE : HEALTH_GENERAL_NOTICE}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="agda-message agda-message--assistant agda-thinking">
                <div className="agda-message-name"><span>🐔</span> Agda</div>
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((index) => (
                      <motion.span
                        key={index}
                        className="w-1.5 h-1.5 rounded-full bg-primary/50"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: index * 0.18 }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Agda funderar…</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="agda-composer p-3 sm:p-4 border-t border-border/60">
          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }} className="flex items-center gap-2">
            <Input
              ref={inputRef}
              placeholder="Fråga Agda…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="flex-1 rounded-2xl h-12 px-4"
              disabled={loading}
              autoFocus
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-2xl shrink-0" disabled={!input.trim() || loading} aria-label="Skicka till Agda">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground/60 mt-2 px-1 text-center">
            Agda kan göra misstag. Vid oro för sjukdom eller skada bör du kontakta veterinär.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
