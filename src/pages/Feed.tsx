import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, TrendingDown, Egg, Calculator, ShoppingCart, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import EmptyState from '@/components/EmptyState';
import AffiliateProductStrip from '@/components/affiliate/AffiliateProductStrip';

const FEED_CATEGORIES: { value: string; label: string }[] = [
  { value: 'layer', label: 'Värphönsfoder' },
  { value: 'starter', label: 'Kycklingfoder (starter)' },
  { value: 'grower', label: 'Tillväxtfoder (grower)' },
  { value: 'grain', label: 'Spannmål / korn' },
  { value: 'scratch', label: 'Pickfoder / scratch' },
  { value: 'oyster_shell', label: 'Ostronskal / kalcium' },
  { value: 'grit', label: 'Grit' },
  { value: 'treats', label: 'Godis / mjölmask' },
  { value: 'other', label: 'Annat' },
];

export default function Feed() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState('');
  const [newCost, setNewCost] = useState('');
  const [newKg, setNewKg] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState<string>('');

  const { data: feedRecords = [], isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: () => api.getFeedRecords(),
  });

  const { data: feedStats } = useQuery({
    queryKey: ['feed-stats'],
    queryFn: () => api.getFeedStatistics().catch(() => null),
  });

  const { data: feedInventory } = useQuery({
    queryKey: ['feed-inventory'],
    queryFn: () => api.getFeedInventory().catch(() => null),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createFeedRecord(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-stats'] });
      queryClient.invalidateQueries({ queryKey: ['feed-inventory'] });
      toast({ title: 'Foderinköpet är sparat! 🥣' });
      setOpen(false);
      setNewType(''); setNewCost(''); setNewKg(''); setNewBrand(''); setNewCategory('');
    },
    onError: () => toast({ title: 'Något gick fel', description: 'Vi kunde inte spara foderinköpet just nu. Kontrollera anslutningen och försök igen.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFeedRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-stats'] });
      toast({ title: 'Foderinköpet är borttaget' });
    },
  });

  const handleAdd = () => {
    if (!newType || !newCost) return;
    createMutation.mutate({
      feed_type: newType,
      cost: Number(newCost),
      amount_kg: Number(newKg) || 0,
      date: new Date().toISOString().split('T')[0],
      brand: newBrand || null,
      feed_category: newCategory || null,
    } as any);
  };

  const totalCost = feedStats?.total_cost || feedRecords.reduce((s: number, p: any) => s + (p.cost || 0), 0);
  const totalKg = feedStats?.total_kg || feedRecords.reduce((s: number, p: any) => s + (p.amount_kg || 0), 0);
  const costPerEgg = feedStats?.cost_per_egg || 0;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}</div>
      </div>
    );
  }

  return (
    <PremiumGate feature="Foderspårning" featureKey="feed" blur>
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Foder 🥣</h1>
          <p className="text-sm text-muted-foreground mt-1">Spåra foderinköp och kostnad per ägg</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" />Nytt inköp</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-serif">Registrera foderinköp</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input className="rounded-xl" placeholder="Beskrivning (t.ex. Hönsfoder 25 kg)" value={newType} onChange={(e) => setNewType(e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input className="rounded-xl" placeholder="Märke (t.ex. Granngården)" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Fodertyp (valfritt)" /></SelectTrigger>
                  <SelectContent>
                    {FEED_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input className="rounded-xl" placeholder="Kostnad (kr)" type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
                <Input className="rounded-xl" placeholder="Vikt (kg)" type="number" value={newKg} onChange={(e) => setNewKg(e.target.value)} />
              </div>
              <p className="text-[11px] text-muted-foreground">Märke + fodertyp gör det möjligt att jämföra kostnader och få bättre köprekommendationer.</p>
              <Button className="w-full rounded-xl" onClick={handleAdd} disabled={createMutation.isPending || !newType || !newCost}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Spara inköp
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {feedRecords.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Inga foderinköp ännu"
          description="Lägg in ditt första foderinköp så kan Hönsgården börja räkna på foderkostnad, total förbrukning och ungefärlig kostnad per ägg."
          actionLabel="Lägg till foderinköp"
          onAction={() => setOpen(true)}
          secondaryLabel="Logga ägg först"
          onSecondaryAction={() => window.location.assign('/app/eggs')}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <ShoppingCart className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="stat-number text-xl text-foreground">{totalCost} kr</p>
                <p className="data-label text-[10px] mt-1">Total foderkostnad</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <Package className="h-4 w-4 text-accent mx-auto mb-1" />
                <p className="stat-number text-xl text-foreground">{totalKg} kg</p>
                <p className="data-label text-[10px] mt-1">Totalt foder</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-3 sm:p-4 text-center">
                <Egg className="h-4 w-4 text-warning mx-auto mb-1" />
                <p className="stat-number text-xl text-foreground">{feedStats?.total_eggs || '–'}</p>
                <p className="data-label text-[10px] mt-1">Ägg totalt</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-sm border-l-4 border-l-primary">
              <CardContent className="p-3 sm:p-4 text-center">
                <Calculator className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="stat-number text-xl text-primary">{costPerEgg ? `${costPerEgg.toFixed(1)} kr` : '–'}</p>
                <p className="data-label text-[10px] mt-1">Kostnad/ägg</p>
              </CardContent>
            </Card>
          </div>

          {feedInventory && (
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  <span className="font-serif text-sm text-primary">Förbrukningsprognos</span>
                </div>
                <p className="text-sm text-foreground">
                  {feedInventory.days_remaining ? `Fodret räcker i ca ${feedInventory.days_remaining} dagar` : 'Logga några fler foderposter så kan vi visa en bättre prognos.'}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="font-serif text-base sm:text-lg">Inköpshistorik</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {feedRecords.map((p: any) => {
                  const id = p._id || p.id;
                  return (
                    <div key={id} className="flex items-center justify-between px-4 sm:px-6 py-3 hover:bg-secondary/50 transition-colors">
                      <div className="min-w-0 mr-3">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{p.feed_type || p.type}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{p.date} · {p.amount_kg || p.kg} kg</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="stat-number text-sm text-destructive">-{p.cost} kr</span>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => deleteMutation.mutate(id)} aria-label="Ta bort foderinköp">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
      <AffiliateProductStrip category="foder" title="Foder & tillbehör" />
    </div>
    </PremiumGate>
  );
}

