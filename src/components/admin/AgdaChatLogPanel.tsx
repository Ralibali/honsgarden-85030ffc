import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, Search, Sparkles, User as UserIcon, Bot, Database } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

type LogRow = {
  id: string;
  user_id: string;
  question: string;
  answer: string | null;
  context_snapshot: any;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type Profile = { user_id: string; email: string | null; display_name: string | null };

export default function AgdaChatLogPanel() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<LogRow | null>(null);

  const { data: logs = [], isLoading } = useQuery<LogRow[]>({
    queryKey: ['admin-agda-chat-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agda_chat_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as unknown as LogRow[]) || [];
    },
    refetchInterval: 30_000,
  });

  const userIds = useMemo(() => Array.from(new Set(logs.map((l) => l.user_id))), [logs]);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['admin-agda-chat-profiles', userIds.join(',')],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, display_name')
        .in('user_id', userIds);
      if (error) throw error;
      return (data as Profile[]) || [];
    },
  });

  const profileById = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach((p) => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  const query = q.trim().toLowerCase();
  const filtered = !query
    ? logs
    : logs.filter((l) => {
        const p = profileById[l.user_id];
        return (
          l.question.toLowerCase().includes(query) ||
          (l.answer || '').toLowerCase().includes(query) ||
          (p?.email || '').toLowerCase().includes(query) ||
          (p?.display_name || '').toLowerCase().includes(query)
        );
      });

  const stats = useMemo(() => {
    const total = logs.length;
    const uniqueUsers = new Set(logs.map((l) => l.user_id)).size;
    const totalTokens = logs.reduce((s, l) => s + (l.total_tokens || 0), 0);
    const withAnswer = logs.filter((l) => l.answer && l.answer.length > 0).length;
    const errors = logs.filter((l) => l.error).length;
    return { total, uniqueUsers, totalTokens, withAnswer, errors };
  }, [logs]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Agda AI – chatt-logg
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Alla frågor användare skickat till Agda, tillsammans med den data-ögonblicksbild Agda såg när svaret genererades.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <StatCard label="Frågor totalt" value={stats.total} />
        <StatCard label="Unika användare" value={stats.uniqueUsers} />
        <StatCard label="Med svar" value={stats.withAnswer} />
        <StatCard label="Fel" value={stats.errors} tint={stats.errors > 0 ? 'warn' : undefined} />
        <StatCard label="Tokens (summa)" value={stats.totalTokens.toLocaleString('sv-SE')} />
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök i frågor, svar eller e-post..."
          className="pl-10 h-11 bg-background"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((l) => {
          const p = profileById[l.user_id];
          const c = l.context_snapshot?.counts || {};
          return (
            <Card
              key={l.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSelected(l)}
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <UserIcon className="h-3 w-3" />
                      <span className="truncate">{p?.display_name || p?.email || l.user_id.slice(0, 8)}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: sv })}</span>
                      {l.error && <Badge variant="destructive" className="text-[10px] ml-1">Fel</Badge>}
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2">{l.question}</p>
                    {l.answer && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                        {l.answer.slice(0, 200)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                  <Badge variant="outline" className="text-[10px]">
                    <Database className="h-2.5 w-2.5 mr-1" />
                    {c.hens_active ?? 0}/{c.hens_total ?? 0} hönor
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {c.eggs_sum_90d ?? 0} ägg 90d
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {c.health_notes ?? 0} hälsonot
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {c.feed_records ?? 0} foder
                  </Badge>
                  {typeof l.total_tokens === 'number' && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {l.total_tokens} tokens
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
            Inga loggade frågor {query && 'som matchar sökningen'}
          </CardContent></Card>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Agda-konversation
                </DialogTitle>
                <DialogDescription>
                  {new Date(selected.created_at).toLocaleString('sv-SE')} ·{' '}
                  {profileById[selected.user_id]?.email || selected.user_id}
                  {selected.model && ` · ${selected.model}`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                    <UserIcon className="h-3.5 w-3.5" /> Användarens fråga
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                    {selected.question}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                    <Bot className="h-3.5 w-3.5" /> Agdas svar
                    {selected.total_tokens != null && (
                      <span className="ml-auto tabular-nums">
                        {selected.prompt_tokens ?? '?'}→{selected.completion_tokens ?? '?'} ({selected.total_tokens} tokens)
                      </span>
                    )}
                  </div>
                  <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
                    {selected.answer || <span className="text-muted-foreground italic">Inget svar sparades{selected.error ? ` – ${selected.error}` : ''}</span>}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                    <Database className="h-3.5 w-3.5" /> Datapunkter Agda såg (kontext-snapshot)
                  </div>
                  <pre className="rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed overflow-x-auto max-h-96">
{JSON.stringify(selected.context_snapshot, null, 2)}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Stäng</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: string | number; tint?: 'warn' }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className={`text-lg sm:text-xl font-semibold tabular-nums leading-none ${tint === 'warn' ? 'text-warning' : ''}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1.5">{label}</p>
      </CardContent>
    </Card>
  );
}
