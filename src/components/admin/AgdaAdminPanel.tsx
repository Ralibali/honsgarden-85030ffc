import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Loader2, Search, ShoppingBasket, Store, Users, Wallet, MousePointerClick, TrendingUp, ExternalLink } from 'lucide-react';

type Listing = any;
type Booking = any;
type Profile = { user_id: string; email: string | null; display_name: string | null };

function kr(n: number) {
  return `${Math.round(n || 0)} kr`;
}

export default function AgdaAdminPanel() {
  const [q, setQ] = useState('');
  const [drillSellerId, setDrillSellerId] = useState<string | null>(null);

  const { data: listings = [], isLoading: l1 } = useQuery<Listing[]>({
    queryKey: ['admin-agda-listings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bookings = [], isLoading: l2 } = useQuery<Booking[]>({
    queryKey: ['admin-agda-bookings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pageViews = [] } = useQuery<{ path: string; session_id: string | null; created_at: string }[]>({
    queryKey: ['admin-agda-pageviews'],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('page_views')
        .select('path, session_id, created_at')
        .like('path', '/s/%')
        .gte('created_at', since)
        .limit(20000);
      if (error) throw error;
      return data || [];
    },
  });

  const viewStatsBySlug = useMemo(() => {
    const map = new Map<string, { views: number; sessions: Set<string> }>();
    pageViews.forEach((v) => {
      const slug = (v.path || '').replace(/^\/s\//, '').split('/')[0];
      if (!slug) return;
      const row = map.get(slug) || { views: 0, sessions: new Set<string>() };
      row.views += 1;
      if (v.session_id) row.sessions.add(v.session_id);
      map.set(slug, row);
    });
    return map;
  }, [pageViews]);

  const userIds = useMemo(() => {
    const s = new Set<string>();
    listings.forEach((l) => l.user_id && s.add(l.user_id));
    bookings.forEach((b) => b.seller_user_id && s.add(b.seller_user_id));
    return Array.from(s);
  }, [listings, bookings]);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['admin-agda-profiles', userIds.join(',')],
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

  const listingById = useMemo(() => {
    const m: Record<string, Listing> = {};
    listings.forEach((l) => { m[l.id] = l; });
    return m;
  }, [listings]);

  const sellerStats = useMemo(() => {
    const map = new Map<string, {
      user_id: string;
      email: string;
      name: string;
      listings: number;
      activeListings: number;
      bookings: number;
      paid: number;
      packs: number;
      revenue: number;
    }>();
    listings.forEach((l) => {
      const uid = l.user_id;
      const p = profileById[uid];
      const row = map.get(uid) || {
        user_id: uid,
        email: p?.email || '—',
        name: p?.display_name || '—',
        listings: 0, activeListings: 0, bookings: 0, paid: 0, packs: 0, revenue: 0,
      };
      row.listings += 1;
      if (l.is_active && !l.sold_out_manually) row.activeListings += 1;
      map.set(uid, row);
    });
    bookings.forEach((b) => {
      const uid = b.seller_user_id;
      const p = profileById[uid];
      const row = map.get(uid) || {
        user_id: uid,
        email: p?.email || '—',
        name: p?.display_name || '—',
        listings: 0, activeListings: 0, bookings: 0, paid: 0, packs: 0, revenue: 0,
      };
      if (b.status !== 'cancelled') {
        row.bookings += 1;
        row.packs += Number(b.packs || 0);
        const price = Number(listingById[b.listing_id]?.price_per_pack || 0);
        row.revenue += price * Number(b.packs || 0);
        if (b.status === 'paid' || b.status === 'picked_up') row.paid += 1;
      }
      map.set(uid, row);
    });
    return Array.from(map.values()).sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue);
  }, [listings, bookings, profileById, listingById]);

  const totals = useMemo(() => {
    const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
    const revenue = activeBookings.reduce((s, b) => {
      const price = Number(listingById[b.listing_id]?.price_per_pack || 0);
      return s + price * Number(b.packs || 0);
    }, 0);
    let totalViews = 0;
    const uniqueSessions = new Set<string>();
    viewStatsBySlug.forEach((v) => {
      totalViews += v.views;
      v.sessions.forEach((s) => uniqueSessions.add(s));
    });
    return {
      sellers: sellerStats.length,
      activeListings: listings.filter((l) => l.is_active && !l.sold_out_manually).length,
      bookings: activeBookings.length,
      revenue,
      views: totalViews,
      uniqueVisitors: uniqueSessions.size,
    };
  }, [bookings, listings, listingById, sellerStats, viewStatsBySlug]);

  const query = q.trim().toLowerCase();
  const filteredSellers = !query ? sellerStats : sellerStats.filter((s) =>
    s.email.toLowerCase().includes(query) || s.name.toLowerCase().includes(query)
  );
  const filteredListings = !query ? listings : listings.filter((l) => {
    const p = profileById[l.user_id];
    return String(l.title || '').toLowerCase().includes(query)
      || String(p?.email || '').toLowerCase().includes(query)
      || String(p?.display_name || '').toLowerCase().includes(query)
      || String(l.location || '').toLowerCase().includes(query);
  });
  const filteredBookings = !query ? bookings : bookings.filter((b) => {
    const p = profileById[b.seller_user_id];
    const l = listingById[b.listing_id];
    return String(b.customer_name || '').toLowerCase().includes(query)
      || String(b.customer_email || '').toLowerCase().includes(query)
      || String(b.customer_phone || '').toLowerCase().includes(query)
      || String(p?.email || '').toLowerCase().includes(query)
      || String(l?.title || '').toLowerCase().includes(query);
  });

  if (l1 || l2) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const conversionRate = totals.uniqueVisitors > 0
    ? Math.round((totals.bookings / totals.uniqueVisitors) * 1000) / 10
    : 0;

  const kpis = [
    { icon: Users, label: 'Säljare', value: totals.sellers, tint: 'primary' },
    { icon: Store, label: 'Aktiva sidor', value: totals.activeListings, tint: 'warning' },
    { icon: Eye, label: 'Besökare 90d', value: totals.uniqueVisitors.toLocaleString('sv-SE'), tint: 'info' },
    { icon: MousePointerClick, label: 'Sidvisningar', value: totals.views.toLocaleString('sv-SE'), tint: 'indigo' },
    { icon: ShoppingBasket, label: 'Bokningar', value: totals.bookings, sub: `${conversionRate}% konv.`, tint: 'accent' },
    { icon: Wallet, label: 'Bekräftat värde', value: kr(totals.revenue), tint: 'success' },
  ] as const;

  const tintMap: Record<string, { bg: string; text: string; ring: string }> = {
    primary: { bg: 'bg-primary/10', text: 'text-primary', ring: 'ring-primary/20' },
    warning: { bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning/20' },
    info: { bg: 'bg-blue-500/10', text: 'text-blue-600', ring: 'ring-blue-500/20' },
    indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-600', ring: 'ring-indigo-500/20' },
    accent: { bg: 'bg-accent/10', text: 'text-accent-foreground', ring: 'ring-accent/30' },
    success: { bg: 'bg-success/10', text: 'text-success', ring: 'ring-success/20' },
  };

  const statusBadge = (b: any) => {
    if (b.status === 'cancelled') return <Badge variant="outline" className="text-[10px]">Avbokad</Badge>;
    if (b.status === 'paid' || b.status === 'picked_up') return <Badge className="bg-success/15 text-success border-success/20 text-[10px]">{b.status === 'paid' ? 'Betald' : 'Hämtad'}</Badge>;
    if (b.status === 'pending') return <Badge className="bg-warning/15 text-warning border-warning/20 text-[10px]">Väntar</Badge>;
    return <Badge variant="secondary" className="text-[10px]">{b.status}</Badge>;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" /> Agdas bod
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Översikt över säljare, sidor och bokningar.</p>
        </div>
        {totals.uniqueVisitors > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-success" />
            <span>{conversionRate}% av besökare bokar</span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {kpis.map(({ icon: Icon, label, value, tint, ...rest }) => {
          const t = tintMap[tint];
          const sub = (rest as any).sub as string | undefined;
          return (
            <Card key={label} className="border-border/60 hover:border-border transition-colors overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                <div className={`w-9 h-9 rounded-xl ${t.bg} ring-1 ${t.ring} flex items-center justify-center mb-2.5`}>
                  <Icon className={`h-4.5 w-4.5 ${t.text}`} />
                </div>
                <p className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums leading-none">{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">{label}</p>
                {sub && <p className="text-[10px] text-success mt-0.5 font-medium">{sub}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök på namn, e-post, kund eller säljsida..."
          className="pl-10 h-11 bg-background"
        />
      </div>

      <Tabs defaultValue="sellers" className="space-y-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-auto h-10 p-1 bg-muted/60">
            <TabsTrigger value="sellers" className="text-xs sm:text-sm px-3 sm:px-4 data-[state=active]:bg-background">
              Säljare <span className="ml-1.5 text-muted-foreground">{filteredSellers.length}</span>
            </TabsTrigger>
            <TabsTrigger value="listings" className="text-xs sm:text-sm px-3 sm:px-4 data-[state=active]:bg-background">
              Säljsidor <span className="ml-1.5 text-muted-foreground">{filteredListings.length}</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs sm:text-sm px-3 sm:px-4 data-[state=active]:bg-background">
              Bokningar <span className="ml-1.5 text-muted-foreground">{filteredBookings.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* SELLERS */}
        <TabsContent value="sellers" className="mt-0">
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:hidden gap-2">
            {filteredSellers.map((s) => (
              <Card key={s.user_id} className="cursor-pointer active:scale-[0.99] transition-transform" onClick={() => setDrillSellerId(s.user_id)}>
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-success whitespace-nowrap">{kr(s.revenue)}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border/50 text-center">
                    <div><p className="text-sm font-semibold tabular-nums">{s.activeListings}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Sidor</p></div>
                    <div><p className="text-sm font-semibold tabular-nums">{s.bookings}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Bokn.</p></div>
                    <div><p className="text-sm font-semibold tabular-nums">{s.paid}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Betalda</p></div>
                    <div><p className="text-sm font-semibold tabular-nums">{s.packs}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Kartor</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredSellers.length === 0 && (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Inga säljare</CardContent></Card>
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Säljare</TableHead>
                    <TableHead className="text-right">Säljsidor</TableHead>
                    <TableHead className="text-right">Aktiva</TableHead>
                    <TableHead className="text-right">Bokningar</TableHead>
                    <TableHead className="text-right">Betalda</TableHead>
                    <TableHead className="text-right">Kartor</TableHead>
                    <TableHead className="text-right">Värde</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSellers.map((s) => (
                    <TableRow key={s.user_id} className="cursor-pointer" onClick={() => setDrillSellerId(s.user_id)}>
                      <TableCell>
                        <div className="font-medium text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.listings}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.activeListings}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.bookings}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.paid}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.packs}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-success">{kr(s.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {filteredSellers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Inga säljare</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LISTINGS */}
        <TabsContent value="listings" className="mt-0">
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:hidden gap-2">
            {filteredListings.map((l) => {
              const p = profileById[l.user_id];
              const active = l.is_active && !l.sold_out_manually;
              const vs = viewStatsBySlug.get(l.slug || '');
              return (
                <Card key={l.id}>
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <a href={`/s/${l.slug}`} target="_blank" rel="noreferrer" className="font-medium text-sm text-primary hover:underline truncate flex items-center gap-1 min-w-0">
                        <span className="truncate">{l.title || '(utan titel)'}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                      {active ? <Badge className="bg-success/15 text-success border-success/20 text-[10px]">Aktiv</Badge>
                        : l.sold_out_manually ? <Badge variant="secondary" className="text-[10px]">Slutsåld</Badge>
                          : <Badge variant="outline" className="text-[10px]">Inaktiv</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p?.display_name || '—'} · {l.location || 'Ingen ort'}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                      <div><p className="text-sm font-semibold tabular-nums">{kr(Number(l.price_per_pack))}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Pris</p></div>
                      <div><p className="text-sm font-semibold tabular-nums">{l.stock_packs ?? '—'}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Lager</p></div>
                      <div><p className="text-sm font-semibold tabular-nums">{vs ? vs.sessions.size : 0}</p><p className="text-[9px] uppercase text-muted-foreground tracking-wide">Besökare</p></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredListings.length === 0 && (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Inga säljsidor</CardContent></Card>
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Titel</TableHead>
                    <TableHead>Säljare</TableHead>
                    <TableHead>Ort</TableHead>
                    <TableHead className="text-right">Pris/karta</TableHead>
                    <TableHead className="text-right">Lager</TableHead>
                    <TableHead className="text-right">Besökare</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Uppdaterad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredListings.map((l) => {
                    const p = profileById[l.user_id];
                    const active = l.is_active && !l.sold_out_manually;
                    const vs = viewStatsBySlug.get(l.slug || '');
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="max-w-[220px] truncate">
                          <a href={`/s/${l.slug}`} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {l.title || '(utan titel)'}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{p?.display_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{p?.email || '—'}</div>
                        </TableCell>
                        <TableCell className="text-xs">{l.location || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{kr(Number(l.price_per_pack))}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.stock_packs ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {vs ? <><span className="font-medium">{vs.sessions.size}</span> <span className="text-muted-foreground">/ {vs.views}</span></> : '—'}
                        </TableCell>
                        <TableCell>
                          {active
                            ? <Badge className="bg-success/15 text-success border-success/20">Aktiv</Badge>
                            : l.sold_out_manually
                              ? <Badge variant="secondary">Slutsåld</Badge>
                              : <Badge variant="outline">Inaktiv</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {l.updated_at ? new Date(l.updated_at).toLocaleDateString('sv-SE') : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredListings.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Inga säljsidor</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BOOKINGS */}
        <TabsContent value="bookings" className="mt-0">
          {/* Mobile cards */}
          <div className="grid grid-cols-1 sm:hidden gap-2">
            {filteredBookings.map((b) => {
              const l = listingById[b.listing_id];
              const p = profileById[b.seller_user_id];
              const price = Number(l?.price_per_pack || 0);
              return (
                <Card key={b.id}>
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{b.customer_name || 'Kund'}</p>
                        <p className="text-xs text-muted-foreground truncate">{b.customer_phone || b.customer_email || '—'}</p>
                      </div>
                      {statusBadge(b)}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                      <div className="min-w-0">
                        <p className="truncate text-foreground">{l?.title || '—'}</p>
                        <p className="text-muted-foreground truncate">{p?.display_name || '—'}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-semibold tabular-nums">{kr(price * Number(b.packs || 0))}</p>
                        <p className="text-muted-foreground">{b.packs} kartor</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {b.created_at ? new Date(b.created_at).toLocaleString('sv-SE') : '—'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
            {filteredBookings.length === 0 && (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Inga bokningar</CardContent></Card>
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Datum</TableHead>
                    <TableHead>Kund</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Säljsida</TableHead>
                    <TableHead>Säljare</TableHead>
                    <TableHead className="text-right">Kartor</TableHead>
                    <TableHead className="text-right">Värde</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((b) => {
                    const l = listingById[b.listing_id];
                    const p = profileById[b.seller_user_id];
                    const price = Number(l?.price_per_pack || 0);
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {b.created_at ? new Date(b.created_at).toLocaleString('sv-SE') : '—'}
                        </TableCell>
                        <TableCell className="text-sm">{b.customer_name || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{b.customer_phone || '—'}</div>
                          <div>{b.customer_email || ''}</div>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">{l?.title || '—'}</TableCell>
                        <TableCell>
                          <div className="text-sm">{p?.display_name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{p?.email || '—'}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{b.packs}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{kr(price * Number(b.packs || 0))}</TableCell>
                        <TableCell>{statusBadge(b)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredBookings.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Inga bokningar</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      <Dialog open={!!drillSellerId} onOpenChange={(open) => !open && setDrillSellerId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {(() => {
            if (!drillSellerId) return null;
            const seller = sellerStats.find((s) => s.user_id === drillSellerId);
            const sellerBookings = bookings.filter((b) => b.seller_user_id === drillSellerId);
            const sellerListings = listings.filter((l) => l.user_id === drillSellerId);
            const active = sellerBookings.filter((b) => b.status !== 'cancelled');
            const confirmed = sellerBookings.filter((b) => b.status === 'paid' || b.status === 'picked_up');
            const confirmedAmount = confirmed.reduce((sum, b) => sum + Number(listingById[b.listing_id]?.price_per_pack || 0) * Number(b.packs || 0), 0);

            // Group by customer (phone || name)
            const customerMap = new Map<string, { name: string; phone: string; email: string; bookings: any[]; amount: number; packs: number }>();
            active.forEach((b) => {
              const key = String(b.customer_phone || '').replace(/\s+/g, '') || String(b.customer_name || '').toLowerCase();
              if (!key) return;
              const row = customerMap.get(key) || { name: b.customer_name || 'Kund', phone: b.customer_phone || '', email: b.customer_email || '', bookings: [], amount: 0, packs: 0 };
              row.bookings.push(b);
              row.packs += Number(b.packs || 0);
              row.amount += Number(listingById[b.listing_id]?.price_per_pack || 0) * Number(b.packs || 0);
              customerMap.set(key, row);
            });
            const customers = Array.from(customerMap.values()).sort((a, b) => b.amount - a.amount);

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{seller?.name || 'Säljare'}</DialogTitle>
                  <DialogDescription>{seller?.email}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-lg font-bold">{sellerListings.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Säljsidor</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-lg font-bold">{active.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Aktiva bokn.</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-lg font-bold">{customers.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Kunder</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-lg font-bold text-success">{kr(confirmedAmount)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Bekräftat</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {customers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">Inga bokningar ännu.</p>
                  )}
                  {customers.map((c, idx) => (
                    <div key={idx} className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.phone || '—'}{c.email ? ` · ${c.email}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">{kr(c.amount)}</p>
                          <p className="text-[10px] text-muted-foreground">{c.bookings.length} bokn. · {c.packs} kartor</p>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-[11px]">Datum</TableHead>
                            <TableHead className="h-8 text-[11px]">Säljsida</TableHead>
                            <TableHead className="h-8 text-[11px] text-right">Kartor</TableHead>
                            <TableHead className="h-8 text-[11px] text-right">Summa</TableHead>
                            <TableHead className="h-8 text-[11px]">Status</TableHead>
                            <TableHead className="h-8 text-[11px]">Meddelande</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {c.bookings.map((b: any) => {
                            const l = listingById[b.listing_id];
                            const amount = Number(l?.price_per_pack || 0) * Number(b.packs || 0);
                            return (
                              <TableRow key={b.id}>
                                <TableCell className="text-xs py-2 whitespace-nowrap">
                                  {b.created_at ? new Date(b.created_at).toLocaleDateString('sv-SE') : '—'}
                                </TableCell>
                                <TableCell className="text-xs py-2 max-w-[140px] truncate">{l?.title || '—'}</TableCell>
                                <TableCell className="text-xs py-2 text-right tabular-nums">{b.packs}</TableCell>
                                <TableCell className="text-xs py-2 text-right tabular-nums">{kr(amount)}</TableCell>
                                <TableCell className="text-xs py-2">
                                  <Badge variant={b.status === 'cancelled' ? 'outline' : b.status === 'paid' || b.status === 'picked_up' ? 'default' : 'secondary'} className="text-[10px]">
                                    {b.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs py-2 max-w-[200px] truncate text-muted-foreground" title={b.customer_message || ''}>
                                  {b.customer_message || '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
