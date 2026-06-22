import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { eggSalesApi } from '@/lib/eggSalesApi';
import { eggOrderDateTime } from '@/lib/eggOrderPortal';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function EggOrderReschedule({ accessKey }: { accessKey: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [slotId, setSlotId] = useState('');

  const slots = useQuery<any[]>({
    queryKey: ['egg-order-slots', accessKey],
    enabled: open,
    queryFn: async () => {
      const data = await eggSalesApi.listPickupSlots(accessKey);
      return Array.isArray(data) ? data : [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!slotId) throw new Error('Välj en ny tid.');
      const data = await eggSalesApi.rescheduleOrder(accessKey, slotId);
      if (!data?.ok) throw new Error(data?.error || 'Tiden kunde inte ändras.');
    },
    onSuccess: () => {
      setOpen(false);
      setSlotId('');
      toast({ title: 'Upphämtningstiden är ändrad' });
      qc.invalidateQueries({ queryKey: ['egg-order', accessKey] });
    },
    onError: (error: any) => toast({ title: 'Kunde inte boka om', description: error.message, variant: 'destructive' }),
  });

  if (!open) {
    return <Button variant="outline" onClick={() => setOpen(true)}><RefreshCw className="mr-2 h-4 w-4" /> Byt upphämtningstid</Button>;
  }

  return (
    <Card className="rounded-3xl sm:col-span-2">
      <CardHeader><CardTitle className="font-serif">Välj ny upphämtningstid</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {slots.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (slots.data || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Det finns inga andra lediga tider just nu.</p>
        ) : (
          <div className="grid gap-2">
            {(slots.data || []).map((slot) => (
              <button key={slot.id} onClick={() => setSlotId(slot.id)} className={`rounded-2xl border p-3 text-left ${slotId === slot.id ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}>
                <span className="font-medium">{eggOrderDateTime(slot.starts_at)}</span>
                <span className="block text-xs text-muted-foreground">{slot.label || `${slot.available_places} platser kvar`}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button disabled={!slotId || save.isPending} onClick={() => save.mutate()}>Spara ny tid</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>Stäng</Button>
        </div>
      </CardContent>
    </Card>
  );
}
