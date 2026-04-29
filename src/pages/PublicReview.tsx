import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Egg, Loader2, Star } from 'lucide-react';

export default function PublicReview() {
  const { token } = useParams<{ token: string }>();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: tokenRow, isLoading } = useQuery({
    queryKey: ['review-token', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('egg_sale_review_tokens')
        .select('booking_id, listing_id, seller_user_id, used_at')
        .eq('token', token)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: booking } = useQuery({
    queryKey: ['review-booking', tokenRow?.booking_id],
    enabled: Boolean(tokenRow?.booking_id),
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('customer_name')
        .eq('id', tokenRow!.booking_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: listing } = useQuery({
    queryKey: ['review-listing', tokenRow?.listing_id],
    enabled: Boolean(tokenRow?.listing_id),
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('title, slug, image_url')
        .eq('id', tokenRow!.listing_id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (booking?.customer_name && !name) setName(booking.customer_name);
  }, [booking, name]);

  const alreadyUsed = Boolean(tokenRow?.used_at);

  const submit = useMutation({
    mutationFn: async () => {
      if (!tokenRow) throw new Error('Ogiltig länk.');
      if (rating < 1) throw new Error('Välj antal stjärnor.');
      if (!name.trim()) throw new Error('Skriv ditt namn.');
      const { error: insertError } = await (supabase as any).from('egg_sale_reviews').insert({
        booking_id: tokenRow.booking_id,
        listing_id: tokenRow.listing_id,
        seller_user_id: tokenRow.seller_user_id,
        customer_name: name.trim(),
        rating,
        comment: comment.trim() || null,
      });
      if (insertError) throw insertError;
      // Markera token som använd (best effort – RLS tillåter ej från publik, men trigger/serverless kan rensa)
      await (supabase as any).from('egg_sale_review_tokens').update({ used_at: new Date().toISOString() }).eq('token', token);
    },
    onSuccess: () => { setSubmitted(true); toast({ title: 'Tack för ditt betyg! ⭐' }); },
    onError: (e: any) => toast({ title: 'Kunde inte spara betyget', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) {
    return <main className="min-h-screen noise-bg px-4 py-8 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></main>;
  }

  if (!tokenRow) {
    return <main className="min-h-screen noise-bg px-4 py-8 flex items-center justify-center"><Card className="max-w-md"><CardContent className="p-6 text-center space-y-3"><Egg className="h-10 w-10 mx-auto text-muted-foreground" /><h1 className="font-serif text-2xl">Länken är ogiltig</h1><p className="text-sm text-muted-foreground">Den kan ha gått ut eller redan använts.</p></CardContent></Card></main>;
  }

  return (
    <main className="min-h-screen noise-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center space-y-3">
          {listing?.image_url ? <img src={listing.image_url} alt={listing.title} className="mx-auto h-32 w-full max-w-sm rounded-3xl object-cover border shadow-sm" /> : <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 border"><Egg className="h-8 w-8 text-primary" /></div>}
          <div>
            <h1 className="font-serif text-3xl">Vad tyckte du? ⭐</h1>
            <p className="mt-2 text-muted-foreground text-sm">Lämna gärna ett kort betyg på <strong>{listing?.title || 'äggen'}</strong>.</p>
          </div>
        </div>

        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-5 sm:p-6 space-y-5">
            {submitted || alreadyUsed ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                <h2 className="font-serif text-xl">Tack så mycket!</h2>
                <p className="text-sm text-muted-foreground">{alreadyUsed && !submitted ? 'Det här betyget är redan inskickat.' : 'Ditt betyg har sparats och hjälper andra hitta lokala ägg.'}</p>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Klicka för att välja betyg</p>
                  <div className="flex justify-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => setRating(n)}
                        className="p-1 transition-transform hover:scale-110"
                        aria-label={`${n} av 5 stjärnor`}
                      >
                        <Star className={`h-9 w-9 ${(hover || rating) >= n ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn *" className="rounded-xl" />
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Kort kommentar (valfritt)" className="rounded-xl min-h-[100px]" />
                <Button onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full rounded-xl">{submit.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Skicka betyg</Button>
                <p className="text-xs text-muted-foreground text-center">Genom att skicka godkänner du att betyget visas på säljarens annonssida.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
