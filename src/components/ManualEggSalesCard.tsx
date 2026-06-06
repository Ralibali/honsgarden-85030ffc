import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { NotebookPen, Plus, Trash2, Wallet } from 'lucide-react';
import {
  getSyncedEggSales,
  createSyncedEggSale,
  updateSyncedEggSale,
  deleteSyncedEggSale,
} from '@/lib/syncedProductState';
import type { EggSale } from '@/lib/localProductState';

function kr(value: number) {
  return `${Math.round(value).toLocaleString('sv-SE')} kr`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ManualEggSalesCard() {
  const [sales, setSales] = useState<EggSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState('');
  const [eggs, setEggs] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState(todayISO());
  const [paid, setPaid] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getSyncedEggSales();
        setSales(data);
      } catch (err: any) {
        console.warn('[manual-sales] load failed', err?.message || err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    const total = sales.reduce((s, sale) => s + Number(sale.amount || 0), 0);
    const unpaid = sales.filter((s) => !s.paid).reduce((s, sale) => s + Number(sale.amount || 0), 0);
    const eggsSold = sales.reduce((s, sale) => s + Number(sale.eggs || 0), 0);
    return { total, unpaid, eggsSold };
  }, [sales]);

  function resetForm() {
    setCustomer('');
    setEggs('');
    setAmount('');
    setDate(todayISO());
    setPaid(true);
    setNote('');
  }

  async function handleAdd() {
    const trimmedCustomer = customer.trim();
    if (!trimmedCustomer) {
      toast({ title: 'Skriv vem du sålde till', variant: 'destructive' });
      return;
    }
    const eggsNum = Number(eggs);
    const amountNum = Number(amount);
    if (!eggsNum || eggsNum <= 0) {
      toast({ title: 'Antal ägg måste vara större än 0', variant: 'destructive' });
      return;
    }
    if (amountNum < 0 || Number.isNaN(amountNum)) {
      toast({ title: 'Summan ser konstig ut', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const newSale = await createSyncedEggSale({
        customer: trimmedCustomer.slice(0, 100),
        eggs: eggsNum,
        amount: amountNum,
        paid,
        date,
        note: note.trim().slice(0, 500) || undefined,
      });
      setSales((prev) => [newSale, ...prev]);
      toast({ title: 'Försäljning sparad' });
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Kunde inte spara', description: err?.message || 'Försök igen', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(sale: EggSale) {
    try {
      const updated = await updateSyncedEggSale(sale.id, { paid: !sale.paid });
      setSales((prev) => prev.map((s) => (s.id === sale.id ? updated : s)));
    } catch (err: any) {
      toast({ title: 'Kunde inte uppdatera', description: err?.message, variant: 'destructive' });
    }
  }

  async function remove(sale: EggSale) {
    if (!confirm(`Ta bort försäljningen till ${sale.customer}?`)) return;
    try {
      await deleteSyncedEggSale(sale.id);
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      toast({ title: 'Försäljning borttagen' });
    } catch (err: any) {
      toast({ title: 'Kunde inte ta bort', description: err?.message, variant: 'destructive' });
    }
  }

  return (
    <Card className="border-border/60 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <NotebookPen className="h-3 w-3 mr-1" /> Manuell loggbok
              </Badge>
            </div>
            <h2 className="text-xl font-serif text-foreground">Sälj ägg utan säljsida</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sålt på jobbet eller till en kompis? Skriv in antal och summa här – ingen publik sida behövs.
            </p>
          </div>
          <Button onClick={() => setOpen((v) => !v)} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" /> {open ? 'Stäng' : 'Lägg till försäljning'}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-card/80 p-3">
            <Wallet className="h-4 w-4 text-primary mb-1" />
            <p className="text-lg font-bold tabular-nums">{kr(totals.total)}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Totalt</p>
          </div>
          <div className="rounded-2xl border bg-card/80 p-3">
            <p className="text-lg font-bold tabular-nums">{totals.eggsSold}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Ägg sålda</p>
          </div>
          <div className="rounded-2xl border bg-card/80 p-3">
            <p className="text-lg font-bold tabular-nums text-warning">{kr(totals.unpaid)}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Obetalt</p>
          </div>
        </div>

        {open && (
          <div className="rounded-2xl border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ms-customer">Kund</Label>
                <Input
                  id="ms-customer"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="t.ex. Anna på jobbet"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-date">Datum</Label>
                <Input id="ms-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-eggs">Antal ägg</Label>
                <Input
                  id="ms-eggs"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={eggs}
                  onChange={(e) => setEggs(e.target.value)}
                  placeholder="12"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ms-amount">Summa (kr)</Label>
                <Input
                  id="ms-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="60"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-note">Anteckning (valfritt)</Label>
              <Textarea
                id="ms-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="t.ex. ska hämtas på fredag"
                maxLength={500}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ms-paid" checked={paid} onCheckedChange={(v) => setPaid(!!v)} />
              <Label htmlFor="ms-paid" className="cursor-pointer">Betalt</Label>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pr-20 sm:pr-0">
              <Button variant="ghost" onClick={() => { resetForm(); setOpen(false); }} disabled={saving} className="sm:w-auto">
                Avbryt
              </Button>
              <Button onClick={handleAdd} disabled={saving} className="sm:w-auto">
                {saving ? 'Sparar…' : 'Spara försäljning'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Laddar…</p>
          ) : sales.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-5 text-center">
              <NotebookPen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="font-medium">Inga loggade försäljningar ännu</p>
              <p className="text-sm text-muted-foreground mt-1">
                Klicka på "Lägg till försäljning" för att skriva in en sälj till en kompis eller på jobbet.
              </p>
            </div>
          ) : (
            <div className="divide-y border rounded-2xl bg-background/70">
              {sales.slice(0, 30).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{sale.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sale.date).toLocaleDateString('sv-SE')} · {sale.eggs} ägg · {kr(Number(sale.amount))}
                    </p>
                    {sale.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sale.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => togglePaid(sale)}
                      className={`text-[11px] px-2 py-1 rounded-full border ${sale.paid ? 'bg-primary/10 text-primary border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}
                    >
                      {sale.paid ? 'Betalt' : 'Obetalt'}
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => remove(sale)} aria-label="Ta bort">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
