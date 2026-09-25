import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import BroodOriginEditor from './BroodOriginEditor';
import BroodOriginSummary from './BroodOriginSummary';

export default function HatchingOrigin({ id, name, date }: { id: string; name: string; date: string }) {
  const [open, setOpen] = useState(false);
  const { data: origins = [], isError, isPending, refetch } = useQuery({ queryKey: ['brood-origins'], queryFn: () => api.getBroodOrigins() });
  const origin = origins.find(o => o.hatching_id === id);
  return <div data-private-content className="mt-4 space-y-3 border-t pt-3">
    {isError ? <p role="alert" className="text-sm">Kullens ursprung kunde inte hämtas. <Button variant="link" onClick={() => void refetch()}>Försök igen</Button></p> : <>
      {origin && <BroodOriginSummary origin={origin} />}
      <Button variant="outline" disabled={isPending} onClick={() => setOpen(true)}>{origin ? 'Redigera kullens ursprung' : 'Lägg till möjliga föräldrar'}</Button>
      <p className="text-xs text-muted-foreground">Koppla kycklingar till kullen under ”Ursprung och genbank” på deras profiler.</p>
    </>}
    <BroodOriginEditor open={open} onOpenChange={setOpen} origin={origin} hatching={{ id, name, date }} />
  </div>;
}
