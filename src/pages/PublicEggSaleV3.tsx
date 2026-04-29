import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { BellRing, CheckCircle2, Copy, Egg, ExternalLink, Loader2, MapPin, MessageCircle, Package, Share2, ShieldCheck, ShoppingBasket, Sparkles, Star, Wallet } from 'lucide-react';

function getParam(params: URLSearchParams, key: string, fallback = '') { return params.get(key)?.trim() || fallback; }
function copy(text: string) { navigator.clipboard?.writeText(text); toast({ title: 'Kopierat' }); }
function asKr(v: unknown, fallback = '') { const n = Number(v); return Number.isFinite(n) && n > 0 ? `${Math.round(n)} kr` : fallback; }

export default function PublicEggSaleV3() {
  const [params] = useSearchParams();
  const { slug } = useParams<{ slug?: string }>();
  const qc = useQueryClient();
  const shouldLoadSlug = Boolean(slug && slug !== 'agg');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [packs, setPacks] = useState('1');
  const [wlName, setWlName] = useState('');
  const [wlEmail, setWlEmail] = useState('');
  const [wlPhone, setWlPhone] = useState('');
  const [wlPacks, setWlPacks] = useState('1');

  const { data: listing, isLoading: queryLoading, isFetching } = useQuery({
    queryKey: ['public-egg-sale-listing-v3', slug],
    enabled: shouldLoadSlug,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('public_egg_sale_listings').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
  const isLoading = shouldLoadSlug && (queryLoading || isFetching);

  const { data: bookedPacks = 0 } = useQuery({
    queryKey: ['public-egg-sale-reserved-packs-v3', listing?.id],
    enabled: Boolean(listing?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_public_egg_sale_reserved_packs', { p_listing_id: listing.id });
      if (error) return 0;
      return Number(data) || 0;
    },
    staleTime: 15_000,
  });

  const { data: publicReviews = [] } = useQuery({
    queryKey: ['public-egg-sale-reviews-v3', listing?.id],
    enabled: Boolean(listing?.id),
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('egg_sale_reviews')
        .select('id, customer_name, rating, comment, created_at')
        .eq('listing_id', listing.id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 60_000,
  });

  const sale = useMemo(() => {
    if (listing) return {
      id: listing.id, sellerUserId: listing.user_id, title: listing.title || 'Färska ägg till salu', description: listing.description || 'Färska ägg från lokal hönsgård.', imageUrl: listing.image_url || '', packs: Number(listing.packs_available || 1), size: String(listing.eggs_per_pack || 12), price: String(Math.round(Number(listing.price_per_pack || 60))), location: listing.location || 'Lokalt område', pickup: listing.pickup_info || 'Hämtning efter överenskommelse', contact: listing.contact_info || 'Kontakta säljaren', swish: listing.swish_number || '', swishName: listing.swish_name || '', swishMsg: listing.swish_message || 'Ägg', p6: asKr(listing.p6_price), p12: asKr(listing.p12_price, asKr(listing.price_per_pack)), p30: asKr(listing.p30_price), soldOut: Boolean(listing.sold_out_manually)
    };
    const price = getParam(params, 'price', '60');
    return { id: null, sellerUserId: null, title: getParam(params, 'title', 'Färska ägg till salu'), description: getParam(params, 'desc', 'Färska ägg från lokal hönsgård.'), imageUrl: getParam(params, 'image', ''), packs: Number(getParam(params, 'packs', '6')) || 6, size: getParam(params, 'size', '12'), price, location: getParam(params, 'location', 'Lokalt område'), pickup: getParam(params, 'pickup', 'Hämtning efter överenskommelse'), contact: getParam(params, 'contact', 'Kontakta säljaren'), swish: getParam(params, 'swish', ''), swishName: getParam(params, 'swishName', ''), swishMsg: getParam(params, 'swishMsg', 'Ägg'), p6: getParam(params, 'p6', ''), p12: getParam(params, 'p12', price), p30: getParam(params, 'p30', ''), soldOut: false };
  }, [listing, params]);

  const remaining = Math.max(0, sale.packs - bookedPacks);
  const isSoldOut = sale.soldOut || remaining <= 0;
  const swishText = sale.swish ? `Swish: ${sale.swish}${sale.swishName ? ` (${sale.swishName})` : ''}\nMeddelande: ${sale.swishMsg}` : 'Kontakta säljaren för betalningsinformation.';
  const shareText = `${sale.title}\n\n${sale.description}\n\n${sale.size}-pack: ${sale.price} kr\n${remaining} kartor kvar\nHämtas: ${sale.location}\n${sale.pickup}`;
  const priceRows = [sale.p6 ? { label: '6-pack', price: sale.p6 } : null, { label: `${sale.size}-pack`, price: sale.p12 || `${sale.price} kr` }, sale.p30 ? { label: '30-pack', price: sale.p30 } : null].filter(Boolean) as { label: string; price: string }[];

  const bookingMutation = useMutation({
    mutationFn: async () => {
      if (!listing?.id || !listing?.user_id) throw new Error('Den här säljlistan kan inte ta emot förfrågningar just nu.');
      const packAmount = Math.max(1, Number(packs) || 1);
      if (!name.trim()) throw new Error('Skriv ditt namn.');
      if (!phone.trim()) throw new Error('Skriv ditt telefonnummer.');
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Skriv en giltig e-postadress.');
      if (packAmount > remaining) throw new Error(`Det finns bara ${remaining} kartor kvar.`);
      const { error } = await (supabase as any).from('public_egg_sale_bookings').insert({ listing_id: listing.id, seller_user_id: listing.user_id, customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim(), customer_message: message.trim() || null, packs: packAmount, status: 'reserved' });
      if (error) throw error;
    },
    onSuccess: async () => { setName(''); setPhone(''); setEmail(''); setMessage(''); setPacks('1'); await qc.invalidateQueries({ queryKey: ['public-egg-sale-reserved-packs-v3', listing?.id] }); toast({ title: 'Bokningsförfrågan är skickad 🥚', description: 'Säljaren återkommer för att bekräfta tillgång och hämtning.' }); },
    onError: (e: any) => toast({ title: 'Kunde inte skicka förfrågan', description: e.message, variant: 'destructive' }),
  });

  const waitlistMutation = useMutation({
    mutationFn: async () => {
      if (!listing?.id || !listing?.user_id) throw new Error('Kan inte anmäla intresse just nu.');
      if (!wlName.trim()) throw new Error('Skriv ditt namn.');
      if (!wlEmail.trim() && !wlPhone.trim()) throw new Error('Lämna e-post eller telefon så vi kan höra av oss.');
      const { error } = await (supabase as any).from('egg_sale_waitlist').insert({
        listing_id: listing.id,
        seller_user_id: listing.user_id,
        customer_name: wlName.trim(),
        customer_email: wlEmail.trim() || null,
        customer_phone: wlPhone.trim() || null,
        packs_wanted: Math.max(1, Number(wlPacks) || 1),
      });
      if (error) throw error;
    },
    onSuccess: () => { setWlName(''); setWlEmail(''); setWlPhone(''); setWlPacks('1'); toast({ title: 'Du är på väntelistan 🔔', description: 'Vi mejlar dig så fort det finns ägg i lager igen.' }); },
    onError: (e: any) => toast({ title: 'Kunde inte anmäla intresse', description: e.message, variant: 'destructive' }),
  });

  const share = async () => { if (navigator.share) await navigator.share({ title: sale.title, text: shareText, url: window.location.href }).catch(() => undefined); else copy(`${shareText}\n\n${window.location.href}`); };

  if (isLoading) return <main className="min-h-screen noise-bg px-4 py-8 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></main>;
  if (shouldLoadSlug && !listing) return <main className="min-h-screen noise-bg px-4 py-8 flex items-center justify-center"><Card className="max-w-md"><CardContent className="p-6 text-center space-y-3"><Egg className="h-10 w-10 mx-auto text-muted-foreground" /><h1 className="font-serif text-2xl">Säljlistan hittades inte</h1><p className="text-sm text-muted-foreground">Den kan vara pausad, borttagen eller felstavad.</p><Button variant="outline" onClick={() => window.open('https://honsgarden.se', '_blank')}>Till Hönsgården.se</Button></CardContent></Card></main>;

  return <main className="min-h-screen noise-bg px-4 py-8 sm:py-12"><div className="mx-auto max-w-2xl space-y-5">
    <div className="text-center space-y-3">{sale.imageUrl ? <img src={sale.imageUrl} alt={sale.title} className="mx-auto h-52 w-full max-w-xl rounded-3xl object-cover border shadow-sm" /> : <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 border"><Egg className="h-8 w-8 text-primary" /></div>}<div><Badge className="mb-3">Lokal äggförsäljning</Badge><h1 className="font-serif text-3xl sm:text-4xl">{sale.title}</h1><p className="mt-2 text-muted-foreground leading-relaxed">{sale.description}</p></div></div>
    <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/8 via-card to-accent/8"><CardContent className="p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-3 gap-3 text-center"><InfoStat label="ägg/karta" value={sale.size} /><InfoStat label="kr" value={sale.price} /><InfoStat label="kartor kvar" value={isSoldOut ? 0 : remaining} warn={isSoldOut} /></div>
      {isSoldOut && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center"><p className="font-serif text-lg">Slutsålt just nu</p><p className="text-sm text-muted-foreground">Kontakta säljaren för att fråga om nästa omgång.</p></div>}
      <div className="rounded-2xl border bg-card/70 p-4 space-y-3"><Row icon={Package} title="Prislista">{priceRows.map((r) => <div key={r.label} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.label}</span><strong>{r.price}</strong></div>)}</Row><Row icon={MapPin} title="Hämtning"><p className="text-sm text-muted-foreground">{sale.location}</p><p className="text-xs text-muted-foreground">{sale.pickup}</p></Row><Row icon={MessageCircle} title="Kontakt"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{sale.contact}</p></Row></div>
      <Card className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="p-4 space-y-3"><Row icon={Wallet} title="Betala med Swish"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{swishText}</p></Row>{sale.swish && <Button variant="outline" className="w-full rounded-xl" onClick={() => copy(swishText)}><Copy className="h-4 w-4 mr-2" /> Kopiera Swishuppgifter</Button>}</CardContent></Card>
      {listing?.id && <Card className="shadow-none"><CardContent className="p-4 space-y-3">{isSoldOut ? <><p className="font-serif text-sm flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" /> Anmäl dig till väntelistan</p><p className="text-xs text-muted-foreground">Få ett mejl direkt när säljaren har ägg i lager igen.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input value={wlName} onChange={(e) => setWlName(e.target.value)} placeholder="Namn *" /><Input type="email" value={wlEmail} onChange={(e) => setWlEmail(e.target.value)} placeholder="E-post (för notis)" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} placeholder="Telefon (valfritt)" /><Input type="number" min="1" value={wlPacks} onChange={(e) => setWlPacks(e.target.value)} placeholder="Önskat antal kartor" /></div><Button onClick={() => waitlistMutation.mutate()} disabled={waitlistMutation.isPending} className="w-full rounded-xl"><BellRing className="h-4 w-4 mr-2" /> {waitlistMutation.isPending ? 'Skickar...' : 'Anmäl mig'}</Button></> : <><p className="font-serif text-sm flex items-center gap-2"><ShoppingBasket className="h-4 w-4 text-primary" /> Skicka bokningsförfrågan</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Namn *" /><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon *" /></div><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post * (för bekräftelse & recension)" /><Input type="number" min="1" max={remaining} value={packs} onChange={(e) => setPacks(e.target.value)} placeholder="Antal kartor" /><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Meddelande, t.ex. önskad hämtningstid" /><p className="text-[11px] text-muted-foreground">Vi använder kontaktuppgifterna för att bekräfta bokningen och skicka en kort recensions-länk efter hämtning.</p><Button onClick={() => bookingMutation.mutate()} disabled={bookingMutation.isPending} className="w-full rounded-xl"><CheckCircle2 className="h-4 w-4 mr-2" /> {bookingMutation.isPending ? 'Skickar...' : 'Skicka bokningsförfrågan'}</Button></>}</CardContent></Card>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Button onClick={() => copy(shareText)}><Copy className="h-4 w-4 mr-2" /> Kopiera info</Button><Button variant="outline" onClick={share}><Share2 className="h-4 w-4 mr-2" /> Dela sidan</Button></div>
    </CardContent></Card>
    {(publicReviews as any[]).length > 0 && (() => {
      const avg = (publicReviews as any[]).reduce((s, r) => s + Number(r.rating || 0), 0) / (publicReviews as any[]).length;
      return (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <p className="stat-number text-2xl text-amber-700">{avg.toFixed(1)}</p>
            <div>
              <div className="flex">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= Math.round(avg) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />)}</div>
              <p className="text-xs text-muted-foreground">{(publicReviews as any[]).length} recension(er) från kunder</p>
            </div>
          </div>
          <div className="space-y-2">
            {(publicReviews as any[]).slice(0, 5).map((r: any) => (
              <div key={r.id} className="rounded-2xl border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.customer_name}</p>
                  <div className="flex">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-3 w-3 ${n <= Number(r.rating) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />)}</div>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground italic">"{r.comment}"</p>}
              </div>
            ))}
          </div>
        </CardContent></Card>
      );
    })()}
    <Card><CardContent className="p-4 flex gap-3"><ShieldCheck className="h-5 w-5 text-primary shrink-0" /><div><p className="text-sm font-medium">Tips till köpare</p><p className="text-sm text-muted-foreground">Bokningen är en förfrågan. Kontakta säljaren för att bekräfta tillgång, hämtning och betalning innan du Swishar.</p></div></CardContent></Card>
    <details className="rounded-2xl border bg-card/60 p-4 text-center"><summary className="cursor-pointer list-none text-xs text-muted-foreground">Skapad med <strong>Hönsgården.se</strong></summary><div className="pt-4 space-y-3"><Sparkles className="h-5 w-5 mx-auto text-primary" /><p className="text-sm font-medium">Vill du också sälja ägg enklare?</p><p className="text-xs text-muted-foreground">Med Hönsgården kan du logga ägg, skapa säljannonser, dela försäljningssidor och hålla koll på betalningar.</p><Button variant="outline" size="sm" onClick={() => window.open('https://honsgarden.se', '_blank')}><ExternalLink className="h-3.5 w-3.5 mr-2" /> Besök Hönsgården.se</Button></div></details>
  </div></main>;
}
function InfoStat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) { return <div className={`rounded-2xl border p-4 ${warn ? 'bg-destructive/5 border-destructive/20' : 'bg-card/80'}`}><p className="text-2xl font-bold tabular-nums">{value}</p><p className="data-label text-[10px] mt-1">{label}</p></div>; }
function Row({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) { return <div className="flex gap-3 border-b border-border/40 last:border-0 pb-3 last:pb-0"><Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" /><div className="flex-1"><p className="text-sm font-medium">{title}</p>{children}</div></div>; }
