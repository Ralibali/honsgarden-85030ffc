import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Download, Egg, Loader2, PackageCheck, Printer, RefreshCw, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

const columns = [
  { id: 'reserved', label: 'Ny' },
  { id: 'confirmed', label: 'Bekräftad' },
  { id: 'paid', label: 'Betald' },
  { id: 'packed', label: 'Packad' },
  { id: 'picked_up', label: 'Hämtad' },
] as const;

const archived = ['cancelled', 'no_show', 'refunded'];
const rpcName = (...parts: string[]) => parts.join('_');

function dateTime(value?: string | null) {
  if (!value) return 'Ingen tid vald';
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

export default function EggSaleDashboardV2() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [listingId, setListingId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const listings = useQuery<any[]>({
    queryKey: ['seller-egg-listings-v2', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('public_egg_sale_listings').select('id, title, slug, is_active').eq('user_id', user!.id).order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  const activeListingId = listingId || listings.data?.[0]?.id || '';
  const bookings = useQuery<any[]>({
    queryKey: ['seller-egg-bookings-v2', activeListingId],
    enabled: Boolean(activeListingId),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('*, egg_sale_pickup_slots(id, starts_at, ends_at, label)')
        .eq('listing_id', activeListingId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const changeStatus = useMutation({
    mutationFn: async ({ ids, status, payment }: { ids: string[]; status?: string; payment?: string }) => {
      const name = ids.length > 1 ? rpcName('bulk', 'update', 'egg', 'sale', 'bookings') : rpcName('update', 'egg', 'sale', 'booking', 'status');
      const args = ids.length > 1
        ? { p_booking_ids: ids, p_status: status || null, p_payment_status: payment || null }
        : { p_booking_id: ids[0], p_status: status || null, p_payment_status: payment || null };
      const { data, error } = await (supabase as any).rpc(name, args);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setSelected([]);
      toast({ title: 'Bokningen är uppdaterad' });
      qc.invalidateQueries({ queryKey: ['seller-egg-bookings-v2', activeListingId] });
    },
    onError: (error: any) => toast({ title: 'Kunde inte uppdatera', description: error.message, variant: 'destructive' }),
  });

  const grouped = useMemo(() => {
    const rows = bookings.data || [];
    return Object.fromEntries(columns.map((column) => [column.id, rows.filter((item) => item.status === column.id)]));
  }, [bookings.data]);
  const archivedRows = useMemo(() => (bookings.data || []).filter((item) => archived.includes(item.status)), [bookings.data]);
  const selectedRows = (bookings.data || []).filter((item) => selected.includes(item.id));

  const exportCsv = () => {
    const rows = bookings.data || [];
    const header = ['Referens', 'Kund', 'Telefon', 'E-post', 'Förpackningar', 'Ägg', 'Belopp', 'Status', 'Betalning', 'Upphämtning'];
    const values = rows.map((item) => [
      item.booking_reference || item.id.slice(0, 8), item.customer_name, item.customer_phone || '', item.customer_email || '',
      item.packs, item.packs * (item.eggs_per_pack_snapshot || 12), item.total_amount || '', item.status, item.payment_status,
      item.egg_sale_pickup_slots?.starts_at || '',
    ]);
    const csv = [header, ...values].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `agdas-bod-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (listings.isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  if (!listings.data?.length) return <div className="mx-auto max-w-xl p-6 text-center"><Egg className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-3 font-serif text-3xl">Skapa din första äggbod</h1><Link to="/app/egg-sales"><Button className="mt-5">Kom igång</Button></Link></div>;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div><p className="text-xs uppercase tracking-widest text-muted-foreground">Agdas bod</p><h1 className="font-serif text-3xl">Beställningar</h1></div>
        <div className="flex flex-wrap gap-2">
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={activeListingId} onChange={(event) => setListingId(event.target.value)}>{listings.data.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
          <Button variant="outline" onClick={() => bookings.refetch()}><RefreshCw className="mr-2 h-4 w-4" /> Uppdatera</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Packlista</Button>
        </div>
      </div>

      {selected.length > 0 && (
        <Card className="sticky top-3 z-20 rounded-2xl border-primary/30 shadow-md"><CardContent className="flex flex-wrap items-center gap-2 p-3"><strong className="mr-auto text-sm">{selected.length} valda</strong><Button size="sm" onClick={() => changeStatus.mutate({ ids: selected, status: 'packed' })}><PackageCheck className="mr-1 h-4 w-4" /> Packade</Button><Button size="sm" onClick={() => changeStatus.mutate({ ids: selected, status: 'picked_up' })}><Check className="mr-1 h-4 w-4" /> Hämtade</Button><Button size="sm" variant="outline" onClick={() => setSelected([])}>Avmarkera</Button></CardContent></Card>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        {columns.map((column, columnIndex) => (
          <section key={column.id} className="min-w-0 rounded-3xl bg-muted/35 p-3">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-serif text-lg">{column.label}</h2><Badge variant="secondary">{grouped[column.id]?.length || 0}</Badge></div>
            <div className="space-y-3">
              {(grouped[column.id] || []).map((item: any) => {
                const next = columns[columnIndex + 1]?.id;
                const totalEggs = item.packs * (item.eggs_per_pack_snapshot || 12);
                return (
                  <Card key={item.id} className="rounded-2xl"><CardContent className="space-y-2 p-3">
                    <div className="flex items-start gap-2"><Checkbox checked={selected.includes(item.id)} onCheckedChange={(checked) => setSelected((current) => checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.customer_name}</p><p className="text-xs text-muted-foreground">{item.booking_reference || item.id.slice(0, 8)}</p></div></div>
                    <div className="rounded-xl bg-muted/50 p-2 text-xs"><p>{item.packs} förp. · {totalEggs} ägg · <strong>{Number(item.total_amount || 0).toLocaleString('sv-SE')} kr</strong></p><p>{dateTime(item.egg_sale_pickup_slots?.starts_at)}</p><p>{item.customer_phone}</p>{item.customer_message && <p className="mt-1 italic">“{item.customer_message}”</p>}</div>
                    <div className="flex flex-wrap gap-1"><Badge variant={item.payment_status === 'paid' ? 'default' : 'outline'}>{item.payment_status === 'paid' ? 'Betald' : 'Obetald'}</Badge>{item.pickup_person_name && <Badge variant="secondary">Hämtas av annan</Badge>}</div>
                    <div className="grid gap-1">
                      {item.payment_status !== 'paid' && <Button size="sm" variant="outline" onClick={() => changeStatus.mutate({ ids: [item.id], payment: 'paid', status: item.status === 'reserved' ? 'paid' : undefined })}><Wallet className="mr-1 h-3.5 w-3.5" /> Markera betald</Button>}
                      {next && <Button size="sm" onClick={() => changeStatus.mutate({ ids: [item.id], status: next })}>Flytta till {columns[columnIndex + 1].label}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>}
                    </div>
                  </CardContent></Card>
                );
              })}
              {(grouped[column.id] || []).length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Inga bokningar</p>}
            </div>
          </section>
        ))}
      </div>

      <Card className="rounded-3xl"><CardHeader><button className="flex w-full items-center justify-between text-left" onClick={() => setShowArchived((value) => !value)}><CardTitle className="font-serif">Avslutade och avvikande</CardTitle><Badge variant="outline">{archivedRows.length}</Badge></button></CardHeader>{showArchived && <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{archivedRows.map((item) => <div key={item.id} className="rounded-xl border p-3 text-sm"><strong>{item.customer_name}</strong><p>{item.booking_reference}</p><Badge variant="outline">{item.status}</Badge></div>)}</CardContent>}</Card>
    </div>
  );
}
