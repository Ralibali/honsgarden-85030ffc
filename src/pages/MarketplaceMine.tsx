import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, CheckCircle2, Loader2, MessageSquare, Send, Bell, BellOff, Heart, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  useMyListings, useThreads, useThreadMessages, useSendMessage, useMarkRead,
  useDeleteListing, useUpdateListingStatus, useFavoriteListings, useToggleFavorite, type Thread,
} from '@/hooks/useMarketplace';
import { categoryEmoji, categoryLabel, formatPrice, timeAgo } from '@/lib/marketplace';
import { supabase } from '@/integrations/supabase/client';

export default function MarketplaceMine() {
  usePageTitle('Mina annonser');
  const { user } = useAuth();
  const { data: listings = [], isLoading: lLoading } = useMyListings(user?.id);
  const { data: threads = [], isLoading: tLoading } = useThreads(user?.id);
  const del = useDeleteListing();
  const updateStatus = useUpdateListingStatus();

  const unreadTotal = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div className="space-y-6 pb-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Marknad</h1>
          <p className="text-sm text-muted-foreground">Hantera annonser och meddelanden</p>
        </div>
        <Button asChild className="rounded-2xl gap-2">
          <Link to="/marknad/ny"><Plus className="h-4 w-4" /> Ny annons</Link>
        </Button>
      </div>

      <Tabs defaultValue={unreadTotal > 0 ? 'messages' : 'listings'}>
        <TabsList>
          <TabsTrigger value="listings">Mina annonser ({listings.length})</TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            Meddelanden
            {unreadTotal > 0 && <Badge variant="default" className="h-5 px-1.5">{unreadTotal}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Heart className="h-3.5 w-3.5" /> Sparade
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-3.5 w-3.5" /> Bevakningar
          </TabsTrigger>
        </TabsList>

        {/* Annonser */}
        <TabsContent value="listings" className="space-y-3">
          {lLoading ? (
            <p className="text-muted-foreground py-6 text-center">Laddar…</p>
          ) : listings.length === 0 ? (
            <Card><CardContent className="p-10 text-center">
              <p className="text-muted-foreground mb-4">Du har inga annonser ännu.</p>
              <Button asChild><Link to="/marknad/ny">Lägg in din första annons</Link></Button>
            </CardContent></Card>
          ) : (
            listings.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-4 flex gap-4 items-start">
                  <Link to={`/marknad/${l.slug}`} className="shrink-0">
                    <div className="h-20 w-20 bg-muted rounded-lg overflow-hidden flex items-center justify-center text-3xl">
                      {l.image_urls?.[0] ? (
                        <img src={l.image_urls[0]} alt="" className="w-full h-full object-cover" />
                      ) : categoryEmoji(l.category)}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/marknad/${l.slug}`} className="font-medium text-foreground hover:underline line-clamp-1">{l.title}</Link>
                    <p className="text-sm text-primary">{formatPrice(l.price as any, l.is_giveaway)}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={l.status === 'active' ? 'default' : 'secondary'}>{statusLabel(l.status)}</Badge>
                      <span className="text-xs text-muted-foreground">{l.view_count} visningar · {timeAgo(l.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {l.status === 'active' && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-8"
                        onClick={() => updateStatus.mutate({ id: l.id, status: 'sold' })}>
                        <CheckCircle2 className="h-3 w-3" /> Markera såld
                      </Button>
                    )}
                    {l.status === 'sold' && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-8"
                        onClick={() => updateStatus.mutate({ id: l.id, status: 'active' })}>
                        Återaktivera
                      </Button>
                    )}
                    {l.status === 'active' ? (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-8"
                        onClick={() => updateStatus.mutate({ id: l.id, status: 'hidden' })}>
                        <EyeOff className="h-3 w-3" /> Dölj
                      </Button>
                    ) : l.status === 'hidden' && (
                      <Button size="sm" variant="outline" className="gap-1 text-xs h-8"
                        onClick={() => updateStatus.mutate({ id: l.id, status: 'active' })}>
                        <Eye className="h-3 w-3" /> Aktivera
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-xs h-8 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('Ta bort annonsen permanent?')) del.mutate(l.id); }}>
                      <Trash2 className="h-3 w-3" /> Radera
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Meddelanden */}
        <TabsContent value="messages">
          <MessagesPanel threads={threads} loading={tLoading} meId={user?.id} />
        </TabsContent>

        {/* Sparade */}
        <TabsContent value="favorites">
          <FavoritesPanel userId={user?.id} />
        </TabsContent>

        {/* Bevakningar */}
        <TabsContent value="alerts">
          <AlertsPanel userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type MarketplaceAlert = {
  id: string;
  category: string | null;
  region: string | null;
  search_term: string | null;
  active: boolean;
  created_at: string;
  last_notified_at: string | null;
};

function describeAlert(a: MarketplaceAlert): string {
  const parts: string[] = [];
  if (a.category) parts.push(categoryLabel(a.category));
  if (a.region) parts.push(`i ${a.region}`);
  if (a.search_term) parts.push(`sökord: ${a.search_term}`);
  return parts.length ? parts.join(', ') : 'Alla nya annonser';
}

function AlertsPanel({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['marketplace-alerts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_alerts')
        .select('id, category, region, search_term, active, created_at, last_notified_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MarketplaceAlert[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('marketplace_alerts').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketplace-alerts', userId] }),
    onError: (e: any) => toast({ title: 'Kunde inte uppdatera', description: e?.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketplace_alerts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-alerts', userId] });
      toast({ title: 'Bevakning borttagen' });
    },
    onError: (e: any) => toast({ title: 'Kunde inte ta bort', description: e?.message, variant: 'destructive' }),
  });

  if (isLoading) return <p className="text-muted-foreground py-6 text-center">Laddar…</p>;
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Du har inga bevakningar ännu.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Sök på <Link to="/marknad" className="text-primary underline">Marknaden</Link> och klicka på 🔔 Bevaka denna sökning så mejlar vi dig när nya annonser matchar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${a.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {a.active ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{describeAlert(a)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Skapad {timeAgo(a.created_at)}
                {a.last_notified_at && ` · senaste mejl ${timeAgo(a.last_notified_at)}`}
                {!a.active && ' · pausad'}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Switch
                checked={a.active}
                onCheckedChange={(v) => toggle.mutate({ id: a.id, active: v })}
                aria-label={a.active ? 'Pausa bevakning' : 'Aktivera bevakning'}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive h-8 w-8 p-0"
                onClick={() => { if (confirm('Ta bort bevakningen?')) del.mutate(a.id); }}
                aria-label="Ta bort"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function statusLabel(s: string): string {
  return { active: 'Aktiv', sold: 'Såld', expired: 'Utgången', draft: 'Utkast', hidden: 'Dold' }[s] ?? s;
}

function MessagesPanel({ threads, loading, meId }: { threads: Thread[]; loading: boolean; meId?: string }) {
  const [active, setActive] = useState<Thread | null>(null);

  if (loading) return <p className="text-muted-foreground py-6 text-center">Laddar…</p>;
  if (threads.length === 0) return (
    <Card><CardContent className="p-10 text-center">
      <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-muted-foreground">Inga meddelanden ännu.</p>
    </CardContent></Card>
  );

  return (
    <div className="grid md:grid-cols-3 gap-4 min-h-[400px]">
      <div className="md:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
        {threads.map((t) => (
          <button key={`${t.listing_id}-${t.other_user_id}`}
            onClick={() => setActive(t)}
            className={`w-full text-left p-3 rounded-xl border transition ${
              active?.listing_id === t.listing_id && active?.other_user_id === t.other_user_id
                ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            }`}>
            <div className="flex items-start gap-2">
              <div className="h-10 w-10 bg-muted rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                {t.listing?.image_urls?.[0]
                  ? <img src={t.listing.image_urls[0]} alt="" className="w-full h-full object-cover" />
                  : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-1">{t.listing?.title ?? 'Annons'}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{t.other_name}: {t.last_message.content}</p>
                <p className="text-[10px] text-muted-foreground/70">{timeAgo(t.last_message.created_at)}</p>
              </div>
              {t.unread_count > 0 && (
                <Badge variant="default" className="h-5 px-1.5 shrink-0">{t.unread_count}</Badge>
              )}
            </div>
          </button>
        ))}
      </div>
      <div className="md:col-span-2">
        {active ? <ThreadView thread={active} meId={meId} /> : (
          <Card className="h-full"><CardContent className="p-10 text-center text-muted-foreground">
            Välj en konversation till vänster
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

function ThreadView({ thread, meId }: { thread: Thread; meId?: string }) {
  const { data: msgs = [], isLoading } = useThreadMessages(thread.listing_id, thread.other_user_id);
  const send = useSendMessage();
  const markRead = useMarkRead();
  const [text, setText] = useState('');

  useEffect(() => {
    if (meId && thread.unread_count > 0) {
      markRead.mutate({ listing_id: thread.listing_id, other_user_id: thread.other_user_id, me: meId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.listing_id, thread.other_user_id, meId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await send.mutateAsync({
        listing_id: thread.listing_id,
        recipient_user_id: thread.other_user_id,
        content: text.trim(),
      });
      setText('');
    } catch (e: any) {
      toast({ title: 'Kunde inte skicka', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 border-b border-border">
        <Link to={`/marknad/${thread.listing?.slug ?? ''}`} className="flex items-center gap-3 hover:opacity-80">
          <div className="h-10 w-10 bg-muted rounded-lg overflow-hidden shrink-0">
            {thread.listing?.image_urls?.[0] && <img src={thread.listing.image_urls[0]} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{thread.listing?.title}</p>
            <p className="text-xs text-muted-foreground">med {thread.other_name}</p>
          </div>
        </Link>
      </CardContent>
      <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[400px]">
        {isLoading ? <p className="text-muted-foreground text-center">Laddar…</p> : msgs.map((m) => {
          const mine = m.sender_user_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{timeAgo(m.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Skriv ett svar…"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
        <Button onClick={handleSend} disabled={!text.trim() || send.isPending} size="icon" className="shrink-0">
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  );
}

function FavoritesPanel({ userId }: { userId?: string }) {
  const { data: favs = [], isLoading } = useFavoriteListings(userId);
  const toggle = useToggleFavorite();

  if (!userId) {
    return (
      <Card><CardContent className="p-10 text-center">
        <p className="text-muted-foreground">Logga in för att se sparade annonser.</p>
      </CardContent></Card>
    );
  }
  if (isLoading) return <p className="text-muted-foreground py-6 text-center">Laddar…</p>;
  if (favs.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground mb-2">Du har inga sparade annonser ännu.</p>
          <p className="text-sm text-muted-foreground mb-4">
            Klicka på hjärtat på en annons i <Link to="/marknad" className="text-primary underline">Marknaden</Link> för att spara den här.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {favs.map((l) => {
        const inactive = l.status !== 'active';
        const remove = () =>
          toggle.mutate(
            { listingId: l.id, isFavorite: true },
            { onSuccess: () => toast({ title: 'Borttagen från sparade' }) },
          );
        return (
          <Card key={l.id} className={`overflow-hidden border-border/60 ${inactive ? 'opacity-60' : ''}`}>
            <Link
              to={inactive ? '#' : `/marknad/${l.slug}`}
              onClick={(e) => { if (inactive) e.preventDefault(); }}
              className="block group"
            >
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {l.image_urls?.[0] ? (
                  <img src={l.image_urls[0]} alt={l.title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">{categoryEmoji(l.category)}</div>
                )}
                <Badge variant="secondary" className="absolute top-2 left-2 bg-background/90 backdrop-blur">
                  {categoryEmoji(l.category)} {categoryLabel(l.category)}
                </Badge>
                {inactive && (
                  <Badge variant="destructive" className="absolute top-2 right-2">
                    Ej längre tillgänglig
                  </Badge>
                )}
              </div>
            </Link>
            <CardContent className="p-4 space-y-2">
              <h3 className="font-medium text-foreground line-clamp-2">{l.title}</h3>
              <p className="font-serif text-lg text-primary">{formatPrice(l.price as any, l.is_giveaway)}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {l.city || l.region ? <><MapPin className="h-3 w-3" /> {l.city || l.region}</> : null}
                </span>
                <span>{timeAgo(l.created_at)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={remove}
                className="w-full gap-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Ta bort från sparade
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

