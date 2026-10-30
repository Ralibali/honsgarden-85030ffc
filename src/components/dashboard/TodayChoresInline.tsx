import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Circle } from 'lucide-react';
import { api } from '@/lib/api';
import { hapticSuccess } from '@/lib/haptics';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';

interface ChoreRow {
  id: string;
  title: string;
  completed?: boolean;
}

const MAX_CHIPS = 4;

/**
 * Dagens sysslor att bocka av direkt på Idag – ett tryck, utan att lämna
 * vyn. Uppdateras optimistiskt och rullas tillbaka om sparningen misslyckas.
 */
export default function TodayChoresInline({ chores }: { chores: ChoreRow[] }) {
  const queryClient = useQueryClient();
  const pending = chores.filter((c) => !c.completed);
  const doneToday = chores.length - pending.length;

  const complete = useMutation({
    mutationFn: (choreId: string) => api.completeChore(choreId),
    onMutate: async (choreId) => {
      await queryClient.cancelQueries({ queryKey: ['daily-chores'] });
      const previous = queryClient.getQueryData<ChoreRow[]>(['daily-chores']);
      queryClient.setQueryData<ChoreRow[]>(['daily-chores'], (old) => (old ?? []).map((c) => (c.id === choreId ? { ...c, completed: true } : c)));
      hapticSuccess();
      return { previous };
    },
    onError: (err: Error, _choreId, context) => {
      if (context?.previous) queryClient.setQueryData(['daily-chores'], context.previous);
      toast({ title: 'Kunde inte bocka av', description: err.message, variant: 'destructive' });
    },
    onSuccess: () => trackEvent('Today Chore Completed', {}),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['daily-chores'] }),
  });

  if (chores.length === 0) return null;

  if (pending.length === 0) {
    return (
      <p className="flex items-center gap-2 px-1 pt-3 text-xs font-medium text-success">
        <Check className="h-4 w-4" aria-hidden="true" />
        Alla {doneToday} sysslor är gjorda idag – snyggt jobbat!
      </p>
    );
  }

  return (
    <div className="pt-3" aria-label="Bocka av dagens sysslor">
      <ul className="flex flex-wrap gap-2" role="list">
        {pending.slice(0, MAX_CHIPS).map((chore) => (
          <li key={chore.id}>
            <button
              type="button"
              onClick={() => complete.mutate(chore.id)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition active:scale-95"
              aria-label={`Bocka av ${chore.title}`}
            >
              <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {chore.title}
            </button>
          </li>
        ))}
      </ul>
      {pending.length > MAX_CHIPS && (
        <p className="px-1 pt-2 text-xs text-muted-foreground">+{pending.length - MAX_CHIPS} till under Gården</p>
      )}
    </div>
  );
}
