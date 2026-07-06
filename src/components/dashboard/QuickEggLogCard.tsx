import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Egg, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { todayLocal } from '@/lib/datetime';
import { CountUp } from '@/components/CountUp';
import { useState } from 'react';

interface Props {
  todayEggs: number;
  todayEggRowIds: string[];
}

export default function QuickEggLogCard({ todayEggs, todayEggRowIds }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const addOne = useMutation({
    mutationFn: async () => {
      await api.createEggRecord({ date: todayLocal(), count: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      toast({ title: '🥚 +1 ägg loggat' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
    onSettled: () => setBusy(false),
  });

  const removeOne = useMutation({
    mutationFn: async () => {
      if (todayEggRowIds.length === 0) throw new Error('Inga ägg att ta bort idag');
      const lastId = todayEggRowIds[0];
      await api.deleteEggRecord(lastId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      toast({ title: '−1 ägg borttaget' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
    onSettled: () => setBusy(false),
  });

  const handleAdd = () => { setBusy(true); addOne.mutate(); };
  const handleRemove = () => { setBusy(true); removeOne.mutate(); };
  const disableMinus = busy || todayEggs === 0;

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Egg className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Snabblogg – idag</p>
            <p className="font-serif text-2xl leading-none text-foreground tabular-nums">
              <CountUp value={todayEggs} duration={400} /> <span className="text-sm text-muted-foreground font-sans">ägg</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl"
            onClick={handleRemove}
            disabled={disableMinus}
            aria-label="Ta bort ett ägg"
          >
            {busy && removeOne.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-5 w-5" />}
          </Button>
          <Button
            size="icon"
            className="h-11 w-11 rounded-xl"
            onClick={handleAdd}
            disabled={busy}
            aria-label="Lägg till ett ägg"
          >
            {busy && addOne.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
