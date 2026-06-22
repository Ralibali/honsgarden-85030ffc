import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { eggSalesApi } from '@/lib/eggSalesApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RepeatPurchaseSummary({ accessKey }: { accessKey: string }) {
  const query = useQuery<any>({
    queryKey: ['repeat-purchase', accessKey],
    enabled: accessKey.length >= 16,
    queryFn: () => eggSalesApi.getSubscription(accessKey),
  });

  if (query.isLoading) return <div className="grid min-h-[300px] place-items-center"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  const item = query.data;
  if (!item) return <Card className="rounded-3xl"><CardContent className="p-8 text-center"><h1 className="font-serif text-2xl">Köpet hittades inte</h1><Link to="/"><Button className="mt-4" variant="outline">Till Hönsgården</Button></Link></CardContent></Card>;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Återkommande köp</p>
        <h1 className="font-serif text-3xl">{item.listing_title}</h1>
        <p className="text-muted-foreground">Hej {item.customer_name}!</p>
      </div>
      <Card className="rounded-3xl">
        <CardHeader><CardTitle className="font-serif">Ditt upplägg</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Status: <strong>{item.status === 'active' ? 'Aktivt' : item.status === 'paused' ? 'Pausat' : 'Avslutat'}</strong></p>
          <p>Förpackningar: <strong>{item.packs}</strong></p>
          <p>Intervall: <strong>{item.frequency === 'weekly' ? 'Varje vecka' : item.frequency === 'biweekly' ? 'Varannan vecka' : 'Var fjärde vecka'}</strong></p>
          <p>Nästa reservation: <strong>{new Date(item.next_run_at).toLocaleDateString('sv-SE')}</strong></p>
          {item.pause_until && <p>Pausat till: <strong>{new Date(item.pause_until).toLocaleDateString('sv-SE')}</strong></p>}
        </CardContent>
      </Card>
    </div>
  );
}
