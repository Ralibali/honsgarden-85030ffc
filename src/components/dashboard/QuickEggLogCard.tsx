import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Egg, Loader2, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { hapticTap, hapticSuccess } from '@/lib/haptics';
import { todayLocal } from '@/lib/datetime';
import { CountUp } from '@/components/CountUp';
import { useState } from 'react';
import { trackFirstEggIfNew } from '@/lib/analytics';

interface Props {
  todayEggs: number;
  todayEggRowIds: string[];
}

export default function QuickEggLogCard({ todayEggs, todayEggRowIds }: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [justLogged, setJustLogged] = useState(false);

  const addOne = useMutation({
    mutationFn: async () => {
      await api.createEggRecord({ date: todayLocal(), count: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eggs'] });
      trackFirstEggIfNew('quick_log_card');
      hapticSuccess();
      setJustLogged(true);
      window.setTimeout(() => setJustLogged(false), 700);
      toast({ title: '🥚 +1 ägg loggat' });
    },
    onError: (err: Error) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
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
    onError: (err: Error) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
    onSettled: () => setBusy(false),
  });

  const handleAdd = () => {
    hapticTap();
    setBusy(true);
    addOne.mutate();
  };

  const handleRemove = () => {
    hapticTap();
    setBusy(true);
    removeOne.mutate();
  };

  const disableMinus = busy || todayEggs === 0;

  return (
    <Card className={`egg-counter-v3 overflow-hidden ${justLogged ? 'is-celebrating' : ''}`}>
      <CardContent className="p-0">
        <div className="egg-counter-v3__top">
          <div>
            <p className="egg-counter-v3__eyebrow">Dagens ägg</p>
            <p className="egg-counter-v3__hint">Tryck när du hämtar ett ägg</p>
          </div>
          <a href="/app/eggs" className="egg-counter-v3__details">
            Historik <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="egg-counter-v3__controls">
          <Button
            variant="outline"
            size="icon"
            className="egg-counter-v3__button egg-counter-v3__button--minus"
            onClick={handleRemove}
            disabled={disableMinus}
            aria-label="Ta bort ett ägg"
          >
            {busy && removeOne.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Minus className="h-6 w-6" />}
          </Button>

          <div className="egg-counter-v3__count" aria-live="polite">
            <span className="egg-counter-v3__eggmark" aria-hidden="true"><Egg className="h-4 w-4" /></span>
            <strong><CountUp value={todayEggs} duration={360} /></strong>
            <span>ägg</span>
          </div>

          <Button
            size="icon"
            className="egg-counter-v3__button egg-counter-v3__button--plus"
            onClick={handleAdd}
            disabled={busy}
            aria-label="Lägg till ett ägg"
          >
            {busy && addOne.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-7 w-7" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
