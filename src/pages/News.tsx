import { useEffect, useMemo, useState } from 'react';
import { Sparkles, CheckCheck, ArrowRight, Newspaper, Clock, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useEffect as useTitleEffect } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

type FilterKey = 'all' | 'unread';

function extractUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s]+|\/app\/[^\s]+/i);
  return match?.[0] ?? null;
}

function getNotificationTarget(n: Notification): string | null {
  const explicit = extractUrl(n.message) || extractUrl(n.title);
  if (explicit) return explicit;
  const c = `${n.title} ${n.message}`.toLowerCase();
  if (c.includes('agdas bod') || c.includes('gårdsbutik') || c.includes('sälj') || c.includes('agda sälj') || c.includes('bokning')) return '/app/egg-sales';
  if (c.includes('feedback') || c.includes('förslag')) return '/app/community';
  if (c.includes('ägg')) return '/app/eggs';
  if (c.includes('hön') || c.includes('flock')) return '/app/hens';
  if (c.includes('premium')) return '/app/premium';
  if (c.includes('statistik')) return '/app/statistics';
  if (c.includes('ekonomi') || c.includes('kostnad')) return '/app/finance';
  if (c.includes('foder')) return '/app/feed';
  if (c.includes('agda ai') || c.includes('agda')) return '/app/agda';
  return null;
}

export default function News() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useTitleEffect(() => { document.title = 'Nyheter | Hönsgården'; }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data: notifs }, { data: reads }] = await Promise.all([
        supabase.from('notifications').select('id, title, message, created_at').order('created_at', { ascending: false }).limit(200),
        supabase.from('notification_reads').select('notification_id').eq('user_id', user.id),
      ]);
      if (cancelled) return;
      setItems((notifs as Notification[]) ?? []);
      setReadIds(new Set((reads ?? []).map((r: any) => r.notification_id)));
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('notifications-news')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setItems((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  const newCount = useMemo(() => items.filter((n) => !readIds.has(n.id)).length, [items, readIds]);
  const unreadCount = newCount;

  const filtered = useMemo(() => {
    let list = filter === 'unread' ? items.filter((n) => !readIds.has(n.id)) : items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((n) => `${n.title} ${n.message}`.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, readIds, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Notification[]>();
    filtered.forEach((n) => {
      const key = format(new Date(n.created_at), 'yyyy-MM');
      const arr = map.get(key) || [];
      arr.push(n);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const markAllRead = async () => {
    if (!user?.id) return;
    const unread = items.filter((n) => !readIds.has(n.id));
    if (unread.length === 0) {
      toast({ title: 'Allt är redan läst' });
      return;
    }
    const rows = unread.map((n) => ({ notification_id: n.id, user_id: user.id }));
    const { error } = await supabase.from('notification_reads').upsert(rows, { onConflict: 'notification_id,user_id' });
    if (error) {
      toast({ title: 'Kunde inte markera som läst', description: error.message, variant: 'destructive' });
      return;
    }
    setReadIds((prev) => { const next = new Set(prev); unread.forEach((n) => next.add(n.id)); return next; });
    toast({ title: 'Allt markerat som läst', description: `${unread.length} nyhet${unread.length === 1 ? '' : 'er'} markerade.` });
  };

  const markOneRead = async (n: Notification) => {
    if (!user?.id || readIds.has(n.id)) return;
    await supabase.from('notification_reads').upsert([{ notification_id: n.id, user_id: user.id }], { onConflict: 'notification_id,user_id' });
    setReadIds((prev) => new Set(prev).add(n.id));
  };

  const handleOpen = (n: Notification) => {
    markOneRead(n);
    const target = getNotificationTarget(n);
    if (!target) return;
    if (target.startsWith('http')) window.open(target, '_blank', 'noopener,noreferrer');
    else navigate(target);
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary/15 p-2.5"><Newspaper className="h-5 w-5 text-primary" /></div>
              <div>
                <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">Nyheter
                  {newCount > 0 && <Badge className="bg-primary text-primary-foreground border-primary">{newCount} nya</Badge>}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">Senaste uppdateringarna i Hönsgården – nya funktioner, förbättringar och tips.</p>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl gap-2 shrink-0" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="h-4 w-4" /> Markera allt som läst
            </Button>
          </div>

          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök i titel eller text…"
              aria-label="Sök i nyheter"
              className="w-full rounded-xl border border-border bg-card pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Rensa sökning"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrera nyheter">
            {([
              { key: 'all' as FilterKey, label: 'Alla' },
              { key: 'unread' as FilterKey, label: `Olästa${unreadCount ? ` (${unreadCount})` : ''}` },
            ]).map((chip) => {
              const active = filter === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(chip.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Laddar nyheter…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
          <p className="font-medium">Inga nyheter att visa</p>
          <p className="text-sm text-muted-foreground mt-1">{filter === 'unread' ? 'Du har läst allt – snyggt jobbat!' : 'Det har inte kommit några nyheter i den här perioden.'}</p>
        </CardContent></Card>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-18rem)]">
          <div className="space-y-6">
            {grouped.map(([monthKey, group]) => (
              <section key={monthKey} className="space-y-3">
                <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold px-1">
                  {format(new Date(`${monthKey}-01`), 'LLLL yyyy', { locale: sv })}
                </h2>
                <div className="relative pl-6 border-l-2 border-border/60 space-y-4">
                  {group.map((n) => {
                    const isUnread = !readIds.has(n.id);
                    const target = getNotificationTarget(n);
                    return (
                      <article key={n.id} className="relative">
                        <span className={`absolute -left-[31px] top-3 h-3 w-3 rounded-full ring-4 ring-background ${isUnread ? 'bg-primary animate-pulse' : 'bg-border'}`} aria-hidden />
                        <Card className={`overflow-hidden transition ${isUnread ? 'border-primary/40 bg-primary/[0.03]' : 'border-border/60'}`}>
                          <CardContent className="p-4 sm:p-5 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {isUnread && <Badge className="bg-primary text-primary-foreground border-primary text-[10px]">Ny</Badge>}
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: sv })}</span>
                              <span className="text-[11px] text-muted-foreground/60">· {format(new Date(n.created_at), 'd MMM yyyy', { locale: sv })}</span>
                            </div>
                            <h3 className="font-serif text-lg sm:text-xl text-foreground leading-snug break-words">{n.title}</h3>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{n.message}</p>
                            <div className="flex flex-col sm:flex-row gap-2 pt-1">
                              {target && (
                                <Button size="sm" className="rounded-xl gap-1.5" onClick={() => handleOpen(n)}>
                                  Öppna <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isUnread && (
                                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => markOneRead(n)}>
                                  <CheckCheck className="h-3.5 w-3.5" /> Markera som läst
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
