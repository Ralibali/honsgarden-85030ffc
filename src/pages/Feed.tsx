import React, { useState } from 'react';
import { todayLocal } from '@/lib/datetime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Package, Egg, Calculator, Loader2, Trash2, Wheat, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import EmptyState from '@/components/EmptyState';
import AffiliateProductStrip from '@/components/affiliate/AffiliateProductStrip';
import PageHeader from '@/components/PageHeader';

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

function formatKr(value: number) {
  return `${Number(value || 0).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} kr`;
}

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
      toast({ title: 'Foderinköpet är sparat 🌾' });
      setOpen(false);
      setNewType('');
      setNewCost('');
      setNewKg('');
      setNewBrand('');
      setNewCategory('');
    },
    onError: () => toast({
      title: 'Något gick fel',
      description: 'Vi kunde inte spara foderinköpet just nu. Kontrollera anslutningen och försök igen.',
      variant: 'destructive',
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFeedRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-stats'] });
      queryClient.invalidateQueries({ queryKey: ['feed-inventory'] });
      toast({ title: 'Foderinköpet är borttaget' });
    },
  });

  const handleAdd = () => {
    if (!newType || !newCost) return;
    createMutation.mutate({
      feed_type: newType,
      cost: Number(newCost),
      amount_kg: Number(newKg) || 0,
      date: todayLocal(),
      brand: newBrand || null,
      feed_category: newCategory || null,
    } as any);
  };

  const totalCost = Number(feedStats?.total_cost || feedRecords.reduce((sum: number, record: any) => sum + (record.cost || 0), 0));
  const totalKg = Number(feedStats?.total_kg || feedRecords.reduce((sum: number, record: any) => sum + (record.amount_kg || 0), 0));
  const costPerEgg = Number(feedStats?.cost_per_egg || 0);
  const totalEggs = Number(feedStats?.total_eggs || 0);
  const daysRemaining = Number(feedInventory?.days_remaining || 0);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  return (
    <PremiumGate feature="Foderspårning" featureKey="feed" blur>
      <div className="feed-journal max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        <PageHeader
          title="Foder"
          emoji="🌾"
          subtitle="Vad går åt – och vad kostar äggen egentligen?"
          actions={(
            <Button className="gap-2 rounded-xl" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Lägg in inköp
            </Button>
          )}
        />

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-3xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Vad köpte du till flocken?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="data-label mb-1.5 block">Beskrivning</label>
                <Input
                  className="rounded-xl h-11"
                  placeholder="T.ex. Hönsfoder 25 kg"
                  value={newType}
                  onChange={(event) => setNewType(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="data-label mb-1.5 block">Märke <span className="normal-case font-normal">(valfritt)</span></label>
                  <Input className="rounded-xl h-11" placeholder="T.ex. Granngården" value={newBrand} onChange={(event) => setNewBrand(event.target.value)} />
                </div>
                <div>
                  <label className="data-label mb-1.5 block">Typ <span className="normal-case font-normal">(valfritt)</span></label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Välj fodertyp" /></SelectTrigger>
                    <SelectContent>
                      {FEED_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="data-label mb-1.5 block">Pris</label>
                  <Input className="rounded-xl h-11" placeholder="kr" type="number" inputMode="decimal" value={newCost} onChange={(event) => setNewCost(event.target.value)} />
                </div>
                <div>
                  <label className="data-label mb-1.5 block">Vikt</label>
                  <Input className="rounded-xl h-11" placeholder="kg" type="number" inputMode="decimal" value={newKg} onChange={(event) => setNewKg(event.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Det räcker med beskrivning och pris. Vikt, märke och fodertyp gör jämförelserna bättre senare.
              </p>
              <Button className="w-full h-11 rounded-xl" onClick={handleAdd} disabled={createMutation.isPending || !newType || !newCost}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Spara i foderjournalen
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {feedRecords.length === 0 ? (
          <EmptyState
            icon={Wheat}
            title="Foderjournalen är redo"
            description="Lägg in nästa säck eller påse du köper. Därifrån kan Hönsgården börja räkna på förbrukning och ungefär vad fodret kostar per ägg."
            actionLabel="Lägg in första inköpet"
            onAction={() => setOpen(true)}
            secondaryLabel="Logga dagens ägg"
            onSecondaryAction={() => window.location.assign('/app/eggs')}
          />
        ) : (
          <>
            <Card className="feed-journal__story overflow-hidden">
              <CardContent className="p-5 sm:p-7">
                <div className="flex items-start gap-4">
                  <div className="feed-journal__story-icon"><Wheat className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="data-label">Så ser fodret ut just nu</p>
                    <h2 className="font-serif text-xl sm:text-2xl text-foreground mt-1 leading-tight">
                      {costPerEgg > 0
                        ? `Ungefär ${formatKr(costPerEgg)} i foder per ägg`
                        : `${formatKr(totalCost)} loggat i foder hittills`}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      {totalKg > 0 ? `Du har loggat ${totalKg.toLocaleString('sv-SE')} kg foder` : 'Du har börjat bygga din foderhistorik'}
                      {totalEggs > 0 ? ` tillsammans med ${totalEggs.toLocaleString('sv-SE')} ägg.` : '.'}
                      {daysRemaining > 0 ? ` Med nuvarande takt ser lagret ut att räcka ungefär ${daysRemaining} dagar till.` : ''}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="feed-journal__facts grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FeedFact icon={Package} value={totalKg > 0 ? `${totalKg.toLocaleString('sv-SE')} kg` : '–'} label="foder loggat" text="Ger en bild av hur mycket som faktiskt går åt." />
              <FeedFact icon={Calculator} value={formatKr(totalCost)} label="lagt på foder" text="Summan av inköpen du har sparat här." />
              <FeedFact icon={Egg} value={costPerEgg > 0 ? formatKr(costPerEgg) : '–'} label="per ägg" text={costPerEgg > 0 ? 'En enkel uppskattning utifrån foder och loggade ägg.' : 'Visas när det finns tillräckligt med äggdata.'} />
            </div>

            <Card className="feed-journal__history overflow-hidden">
              <CardHeader className="px-4 sm:px-6 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-serif text-lg">Foderjournal</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Dina inköp, nyast först.</p>
                  </div>
                  <span className="feed-journal__count">{feedRecords.length} {feedRecords.length === 1 ? 'inköp' : 'inköp'}</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/60">
                  {feedRecords.map((record: any) => {
                    const id = record._id || record.id;
                    const kg = Number(record.amount_kg || record.kg || 0);
                    return (
                      <div key={id} className="feed-journal__row px-4 sm:px-6 py-3.5">
                        <div className="feed-journal__date-mark"><CalendarDays className="h-3.5 w-3.5" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{record.feed_type || record.type}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {record.date}{kg > 0 ? ` · ${kg.toLocaleString('sv-SE')} kg` : ''}{record.brand ? ` · ${record.brand}` : ''}
                          </p>
                        </div>
                        <span className="font-semibold text-sm text-foreground tabular-nums shrink-0">{formatKr(Number(record.cost || 0))}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground/60 hover:text-destructive shrink-0"
                          onClick={() => deleteMutation.mutate(id)}
                          aria-label="Ta bort foderinköp"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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

function FeedFact({ icon: Icon, value, label, text }: { icon: React.ElementType; value: string; label: string; text: string }) {
  return (
    <div className="feed-journal__fact">
      <span className="feed-journal__fact-icon"><Icon className="h-4 w-4" /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );
}
