import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock3, Egg, Loader2 } from 'lucide-react';
import { eggSalesApi } from '@/lib/eggSalesApi';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WaitlistOffer() {
  const { token: accessKey = '' } = useParams<{ token: string }>();
  const query = useQuery<any>({
    queryKey: ['waitlist-offer', accessKey],
    enabled: accessKey.length >= 16,
    queryFn: () => eggSalesApi.getWaitlistOffer(accessKey),
  });

  const accept = useMutation({
    mutationFn: async () => {
      const data = await eggSalesApi.acceptWaitlistOffer(accessKey);
      if (!data?.ok) throw new Error(data?.error || 'Erbjudandet kunde inte accepteras.');
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: 'Äggen är bokade!' });
      if (data?.order_path) window.location.assign(data.order_path);
    },
    onError: (error: any) => toast({ title: 'Kunde inte boka', description: error.message, variant: 'destructive' }),
  });

  if (query.isLoading) return <div className="min-h-screen grid place-items-center bg-[#f5efe5]"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  const offer = query.data;
  if (!offer) return <div className="min-h-screen grid place-items-center bg-[#f5efe5] p-5"><Card className="max-w-md rounded-3xl"><CardContent className="p-8 text-center"><h1 className="font-serif text-2xl">Erbjudandet hittades inte</h1><Link to="/"><Button className="mt-4" variant="outline">Till Hönsgården</Button></Link></CardContent></Card></div>;

  const expired = offer.status !== 'offered' || new Date(offer.expires_at) <= new Date();
  return (
    <div className="min-h-screen bg-[#f5efe5] p-4 sm:p-8">
      <Card className="mx-auto max-w-lg rounded-3xl">
        <CardHeader className="text-center"><Egg className="mx-auto h-10 w-10 text-primary" /><CardTitle className="font-serif text-3xl">Ägg finns till dig!</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-center text-muted-foreground">Hej {offer.customer_name}! Du står först i kön hos {offer.listing_title}.</p>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm space-y-2"><p><strong>{offer.packs}</strong> förpackning(ar)</p><p><strong>{offer.eggs_per_pack}</strong> ägg per förpackning</p><p><strong>{Number(offer.price_per_pack || 0).toLocaleString('sv-SE')} kr</strong> per förpackning</p><p>{offer.location}</p></div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" /> Gäller till {new Date(offer.expires_at).toLocaleString('sv-SE')}</div>
          {expired ? <p className="rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">Erbjudandet har löpt ut.</p> : <Button className="w-full" size="lg" disabled={accept.isPending} onClick={() => accept.mutate()}>Acceptera och boka</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
