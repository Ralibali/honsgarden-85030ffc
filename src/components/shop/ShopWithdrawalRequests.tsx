import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Undo2, Loader2, Search, Mail, Monitor } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface WithdrawalRow {
  id: string;
  confirmation_code: string;
  order_id: string;
  order_number: string;
  customer_email: string;
  requested_items: Array<{ name: string; quantity: number; product_id?: string; variant_id?: string | null }>;
  customer_message: string | null;
  receipt_method: 'screen' | 'email';
  status: 'received' | 'reviewing' | 'accepted' | 'rejected' | 'completed';
  admin_note: string | null;
  requested_at: string;
}

const STATUSES: WithdrawalRow['status'][] = ['received', 'reviewing', 'accepted', 'rejected', 'completed'];
const STATUS_LABEL: Record<WithdrawalRow['status'], string> = {
  received: 'Mottagen',
  reviewing: 'Under bedömning',
  accepted: 'Godkänd',
  rejected: 'Avslagen',
  completed: 'Avslutad',
};

export default function ShopWithdrawalRequests() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('shop_withdrawal_requests').select('*').order('requested_at', { ascending: false }).limit(200);
    if (error) toast({ title: 'Kunde inte ladda ångerärenden', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as WithdrawalRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return r.confirmation_code.toLowerCase().includes(s)
      || r.order_number.toLowerCase().includes(s)
      || r.customer_email.toLowerCase().includes(s);
  });
  const newCount = rows.filter((r) => r.status === 'received').length;

  const updateStatus = async (id: string, patch: Partial<Pick<WithdrawalRow, 'status' | 'admin_note'>>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('shop_withdrawal_requests').update(patch).eq('id', id);
    if (error) { toast({ title: 'Kunde inte uppdatera', description: error.message, variant: 'destructive' }); return; }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } as WithdrawalRow : r)));
    toast({ title: 'Ärendet uppdaterat' });
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 rounded-3xl">
        <div className="flex items-center gap-2 mb-3">
          <Undo2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Ångerärenden</h3>
          {newCount > 0 && <Badge variant="secondary" className="ml-1">{newCount} nya</Badge>}
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 rounded-xl"
              placeholder="Sök på ordernr, kod eller e-post" aria-label="Sök ångerärenden" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Alla statusar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla statusar</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 rounded-2xl text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin" aria-hidden /> Laddar…
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 rounded-2xl text-center text-sm text-muted-foreground">
          Inga ångerärenden matchar filtret.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">Order {r.order_number}</p>
                    <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
                    <Badge variant="secondary" className="gap-1">
                      {r.receipt_method === 'email' ? <Mail className="h-3 w-3" aria-hidden /> : <Monitor className="h-3 w-3" aria-hidden />}
                      {r.receipt_method === 'email' ? 'E-post' : 'Skärm'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.customer_email} · Mottagen {new Date(r.requested_at).toLocaleString('sv-SE')}
                  </p>
                  <p className="text-xs mt-1">Kod: <code>{r.confirmation_code}</code></p>
                </div>
                <div className="min-w-40">
                  <Label htmlFor={`st-${r.id}`} className="sr-only">Status</Label>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, { status: v as WithdrawalRow['status'] })}>
                    <SelectTrigger id={`st-${r.id}`} className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-sm">
                <p className="font-medium mb-1">Ångrade produkter</p>
                <ul className="list-disc pl-5">
                  {r.requested_items.map((it, i) => <li key={i}>{it.quantity} × {it.name}</li>)}
                </ul>
              </div>
              {r.customer_message && (
                <div className="text-sm">
                  <p className="font-medium mb-0.5">Kundens meddelande</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{r.customer_message}</p>
                </div>
              )}
              <div>
                <Label htmlFor={`note-${r.id}`}>Adminanteckning</Label>
                <Textarea id={`note-${r.id}`} rows={2} defaultValue={r.admin_note ?? ''}
                  onBlur={(e) => {
                    if ((e.target.value || null) !== (r.admin_note || null)) {
                      updateStatus(r.id, { admin_note: e.target.value.trim() || null });
                    }
                  }} className="rounded-xl" />
              </div>
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" className="rounded-xl"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `Ordernr: ${r.order_number}\nKod: ${r.confirmation_code}\nE-post: ${r.customer_email}`
                    );
                    toast({ title: 'Kopierat till urklipp' });
                  }}>
                  Kopiera info
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Ingen automatisk återbetalning eller lageråterföring – uppdatera Stripe och lager manuellt vid behov.
      </p>
    </div>
  );
}
