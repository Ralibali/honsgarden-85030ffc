import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Egg, Loader2, Phone, Repeat2, Star, XCircle } from 'lucide-react';
import { eggSalesApi } from '@/lib/eggSalesApi';
import { eggOrderStatusLabels } from '@/lib/eggOrderPortal';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import OrderTimeline from '@/components/egg-sales/OrderTimeline';
import EggOrderDetails from '@/components/egg-sales/EggOrderDetails';
import EggOrderReschedule from '@/components/egg-sales/EggOrderReschedule';

export default function EggOrderPortal() {
  const { token: accessKey = '' } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [showRecurring, setShowRecurring] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [packs, setPacks] = useState('1');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const orderQuery = useQuery<any>({
    queryKey: ['egg-order', accessKey],
    enabled: accessKey.length >= 16,
    queryFn: async () => {
      const data = await eggSalesApi.getOrder(accessKey);
      if (!data) throw new Error('Bokningen hittades inte.');
      return data;
    },
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const data = await eggSalesApi.cancelOrder(accessKey);
      if (!data?.ok) throw new Error(data?.error || 'Bokningen kunde inte avbokas.');
    },
    onSuccess: () => {
      toast({ title: 'Bokningen är avbokad', description: 'Lagret och tidsplatsen har återställts.' });
      qc.invalidateQueries({ queryKey: ['egg-order', accessKey] });
    },
    onError: (error: any) => toast({ title: 'Kunde inte avboka', description: error.message, variant: 'destructive' }),
  });

  const recurring = useMutation({
    mutationFn: async () => {
      const data = await eggSalesApi.createSubscription(accessKey, frequency, Math.max(1, Number(packs) || 1), orderQuery.data?.pickup_slot?.id);
      if (!data?.ok) throw new Error(data?.error || 'Det återkommande köpet kunde inte skapas.');
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: 'Ditt återkommande köp är skapat' });
      if (data?.manage_path) window.location.assign(data.manage_path);
    },
    onError: (error: any) => toast({ title: 'Kunde inte spara', description: error.message, variant: 'destructive' }),
  });

  const review = useMutation({
    mutationFn: async () => {
      const data = await eggSalesApi.createReview(accessKey, rating, comment.trim());
      if (!data?.ok) throw new Error(data?.error || 'Recensionen kunde inte sparas.');
    },
    onSuccess: () => {
      toast({ title: 'Tack för din recension! ⭐' });
      qc.invalidateQueries({ queryKey: ['egg-order', accessKey] });
    },
    onError: (error: any) => toast({ title: 'Kunde inte spara recensionen', description: error.message, variant: 'destructive' }),
  });

  const copy = (value: string, title = 'Kopierat') => {
    navigator.clipboard?.writeText(value);
    toast({ title });
  };

  if (orderQuery.isLoading) return <div className="min-h-screen grid place-items-center bg-[#f5efe5]"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (orderQuery.isError || !orderQuery.data) {
    return <div className="min-h-screen grid place-items-center bg-[#f5efe5] p-5"><Card className="w-full max-w-md rounded-3xl"><CardContent className="space-y-3 p-8 text-center"><XCircle className="mx-auto h-12 w-12 text-destructive" /><h1 className="font-serif text-2xl">Bokningen hittades inte</h1><p className="text-sm text-muted-foreground">Kontrollera länken eller kontakta säljaren.</p><Link to="/"><Button variant="outline">Till Hönsgården</Button></Link></CardContent></Card></div>;
  }

  const order = orderQuery.data;
  const cancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-[#f5efe5]">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 font-serif font-semibold"><Egg className="h-5 w-5 text-primary" /> Agdas bod</Link>
          <Badge variant={cancelled ? 'destructive' : order.status === 'picked_up' ? 'default' : 'secondary'}>{eggOrderStatusLabels[order.status] || order.status}</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 sm:py-10">
        <section className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{order.booking_reference}</p>
          <h1 className="font-serif text-3xl sm:text-4xl">{order.listing_title}</h1>
          <p className="mt-1 text-muted-foreground">Hej {order.customer_name}! Här följer och hanterar du beställningen.</p>
        </section>

        <OrderTimeline status={order.status} />
        <EggOrderDetails order={order} onCopy={copy} />

        {!cancelled && order.status !== 'picked_up' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {order.can_reschedule && <EggOrderReschedule accessKey={accessKey} />}
            <Button variant="outline" onClick={() => setShowRecurring((value) => !value)}><Repeat2 className="mr-2 h-4 w-4" /> Beställ regelbundet</Button>
            <Link to={`/s/${order.listing_slug}`} className="sm:col-span-2"><Button variant="outline" className="w-full"><Egg className="mr-2 h-4 w-4" /> Beställ igen</Button></Link>
            {order.contact_phone && <Button variant="outline" onClick={() => window.location.assign(`tel:${String(order.contact_phone).replace(/\s/g, '')}`)}><Phone className="mr-2 h-4 w-4" /> Kontakta säljaren</Button>}
            {order.can_cancel && <Button variant="destructive" onClick={() => window.confirm('Vill du verkligen avboka beställningen?') && cancel.mutate()} disabled={cancel.isPending}><XCircle className="mr-2 h-4 w-4" /> Avboka</Button>}
          </div>
        )}

        {showRecurring && (
          <Card className="rounded-3xl">
            <CardHeader><CardTitle className="font-serif">Återkommande beställning</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="frequency">Intervall</Label><select id="frequency" className="h-10 w-full rounded-md border bg-background px-3" value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="weekly">Varje vecka</option><option value="biweekly">Varannan vecka</option><option value="monthly">Var fjärde vecka</option></select></div>
              <div><Label htmlFor="packs">Förpackningar</Label><Input id="packs" type="number" min="1" value={packs} onChange={(event) => setPacks(event.target.value)} /></div>
              <Button disabled={recurring.isPending} onClick={() => recurring.mutate()}><Repeat2 className="mr-2 h-4 w-4" /> Skapa</Button>
              <Button variant="ghost" onClick={() => setShowRecurring(false)}>Stäng</Button>
            </CardContent>
          </Card>
        )}

        {order.status === 'picked_up' && order.can_review && (
          <Card className="rounded-3xl">
            <CardHeader><CardTitle className="font-serif">Lämna en recension</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1">{[1,2,3,4,5].map((value) => <button key={value} aria-label={`${value} stjärnor`} onClick={() => setRating(value)}><Star className={`h-8 w-8 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} /></button>)}</div>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Skriv gärna några ord" />
              <Button disabled={review.isPending} onClick={() => review.mutate()}>Skicka recension</Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-3xl bg-primary text-primary-foreground">
          <CardContent className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div><p className="font-serif text-lg">Spara din personliga länk</p><p className="text-sm opacity-80">Den ger tillgång till just denna beställning.</p></div>
            <Button variant="secondary" onClick={() => copy(window.location.href, 'Beställningslänken är kopierad')}><Copy className="mr-2 h-4 w-4" /> Kopiera länk</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
