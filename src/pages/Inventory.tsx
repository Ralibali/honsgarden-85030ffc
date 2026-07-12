import React, { useState } from 'react';
import { todayLocal } from '@/lib/datetime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Package, Plus, Trash2, Loader2, ArrowDown, ArrowUp, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { PremiumGate } from '@/components/PremiumGate';

const CATEGORIES = [
  { value: 'foder', label: 'Foder' },
  { value: 'agg', label: 'Ägg' },
  { value: 'forbrukning', label: 'Förbrukning' },
  { value: 'medicin', label: 'Medicin' },
];

const UNITS = ['kg', 'st', 'liter', 'g', 'ml', 'paket'];

function InventoryInner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openItem, setOpenItem] = useState(false);
  const [openTx, setOpenTx] = useState<{ item: any } | null>(null);

  const [itemForm, setItemForm] = useState({
    category: 'foder', name: '', unit: 'kg', current_quantity: '', low_threshold: '', notes: '',
  });
  const [txForm, setTxForm] = useState({
    transaction_type: 'in', quantity: '', cost: '', notes: '',
    transaction_date: todayLocal(),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_items').select('*').order('category').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const createItem = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Ej inloggad');
      const { error } = await supabase.from('inventory_items').insert({
        user_id: user.id,
        category: itemForm.category,
        name: itemForm.name,
        unit: itemForm.unit,
        current_quantity: Number(itemForm.current_quantity) || 0,
        low_threshold: itemForm.low_threshold ? Number(itemForm.low_threshold) : null,
        notes: itemForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      toast({ title: 'Lagervara skapad ✓' });
      setOpenItem(false);
      setItemForm({ category: 'foder', name: '', unit: 'kg', current_quantity: '', low_threshold: '', notes: '' });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const createTx = useMutation({
    mutationFn: async () => {
      if (!user?.id || !openTx) throw new Error('Saknar data');
      const { error } = await supabase.from('inventory_transactions').insert({
        user_id: user.id,
        inventory_item_id: openTx.item.id,
        transaction_type: txForm.transaction_type,
        quantity: Number(txForm.quantity),
        cost: txForm.cost ? Number(txForm.cost) : null,
        notes: txForm.notes || null,
        transaction_date: txForm.transaction_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      toast({ title: 'Transaktion sparad ✓' });
      setOpenTx(null);
      setTxForm({ transaction_type: 'in', quantity: '', cost: '', notes: '', transaction_date: todayLocal() });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      toast({ title: 'Borttagen' });
    },
  });

  const grouped = items.reduce((acc: any, it: any) => {
    (acc[it.category] = acc[it.category] || []).push(it);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Lager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Håll koll på foder, förbrukning och medicin. Få varning när lagret är lågt.
          </p>
        </div>
        <Dialog open={openItem} onOpenChange={setOpenItem}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Ny lagervara</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader><DialogTitle className="font-serif">Ny lagervara</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kategori</Label>
                  <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Enhet</Label>
                  <Select value={itemForm.unit} onValueChange={(v) => setItemForm({ ...itemForm, unit: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Namn</Label>
                <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="T.ex. Värphönsfoder Granngården" className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nuvarande mängd</Label>
                  <Input type="number" step="0.1" value={itemForm.current_quantity} onChange={(e) => setItemForm({ ...itemForm, current_quantity: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Varna under</Label>
                  <Input type="number" step="0.1" value={itemForm.low_threshold} onChange={(e) => setItemForm({ ...itemForm, low_threshold: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anteckningar</Label>
                <Textarea value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} className="rounded-xl min-h-[60px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setOpenItem(false)}>Avbryt</Button>
              <Button className="rounded-xl" disabled={!itemForm.name.trim() || createItem.isPending} onClick={() => createItem.mutate()}>
                {createItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-32" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Inget i lagret ännu"
          description="Lägg in dina foder- och förbrukningsvaror så ser du saldo, kostnad per period och får varning när det börjar ta slut."
          actionLabel="Ny lagervara"
          onAction={() => setOpenItem(true)}
        />
      ) : (
        <div className="space-y-5">
          {CATEGORIES.filter(c => grouped[c.value]?.length).map(cat => (
            <div key={cat.value}>
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 px-1">
                {cat.label}
              </h2>
              <div className="space-y-2">
                {grouped[cat.value].map((it: any) => {
                  const low = it.low_threshold != null && Number(it.current_quantity) <= Number(it.low_threshold);
                  return (
                    <Card key={it.id} className={`border-border/50 ${low ? 'border-warning/40 bg-warning/5' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-foreground">{it.name}</h3>
                              {low && (
                                <Badge variant="outline" className="text-[10px] gap-1 bg-warning/15 text-warning border-warning/30">
                                  <AlertTriangle className="h-3 w-3" /> Lågt saldo
                                </Badge>
                              )}
                            </div>
                            <p className="text-2xl font-serif text-foreground mt-1">
                              {Number(it.current_quantity).toLocaleString('sv-SE')} <span className="text-sm text-muted-foreground">{it.unit}</span>
                            </p>
                            {it.notes && <p className="text-xs text-muted-foreground mt-0.5">{it.notes}</p>}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" onClick={() => { setTxForm(t => ({ ...t, transaction_type: 'in' })); setOpenTx({ item: it }); }}>
                              <ArrowDown className="h-3.5 w-3.5 text-success" /> In
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8 text-xs" onClick={() => { setTxForm(t => ({ ...t, transaction_type: 'ut' })); setOpenTx({ item: it }); }}>
                              <ArrowUp className="h-3.5 w-3.5 text-destructive" /> Ut
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => { if (confirm("Ta bort?")) delItem.mutate(it.id); }} aria-label="Ta bort artikel">
                              <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!openTx} onOpenChange={(o) => !o && setOpenTx(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {txForm.transaction_type === 'in' ? 'Inleverans' : 'Uttag'} – {openTx?.item.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Datum</Label>
                <Input type="date" value={txForm.transaction_date} onChange={(e) => setTxForm({ ...txForm, transaction_date: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mängd ({openTx?.item.unit})</Label>
                <Input type="number" step="0.1" min={0} value={txForm.quantity} onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })} className="rounded-xl" />
              </div>
            </div>
            {txForm.transaction_type === 'in' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Kostnad (kr)</Label>
                <Input type="number" step="0.01" value={txForm.cost} onChange={(e) => setTxForm({ ...txForm, cost: e.target.value })} className="rounded-xl" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Anteckning</Label>
              <Input value={txForm.notes} onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpenTx(null)}>Avbryt</Button>
            <Button className="rounded-xl" disabled={!txForm.quantity || createTx.isPending} onClick={() => createTx.mutate()}>
              {createTx.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Inventory() {
  return (
    <PremiumGate feature="Lagerhantering" blur={false}>
      <InventoryInner />
    </PremiumGate>
  );
}
