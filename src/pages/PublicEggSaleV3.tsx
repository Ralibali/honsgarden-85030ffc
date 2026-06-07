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
import { useSeo } from '@/hooks/useSeo';
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

  // Per-page SEO + structured data for indexable listings
  const seoPath = slug ? `/s/${slug}` : '/s/agg';
  const seoTitleBase = slug ? `${sale.title} – Köp färska ägg i ${sale.location}` : 'Färska ägg till salu';
  const seoTitle = `${seoTitleBase.length > 50 ? seoTitleBase.slice(0, 50) : seoTitleBase} | Hönsgården`.slice(0, 70);
  const seoDescriptionRaw = sale.description?.replace(/\s+/g, ' ').trim() || 'Färska ägg från lokal hönsgård. Boka, hämta och betala enkelt via Hönsgården.';
  const seoDescription = (seoDescriptionRaw.length < 60
    ? `${seoDescriptionRaw} Hämtas i ${sale.location}. ${sale.size} ägg per karta för ${sale.price} kr.`
    : seoDescriptionRaw
  ).slice(0, 158);

  // Ensure absolute URLs (Schema.org requires absolute URIs for image / url)
  const toAbsolute = (u?: string | null) => {
    if (!u) return undefined;
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('//')) return `https:${u}`;
    return `https://honsgarden.se${u.startsWith('/') ? '' : '/'}${u}`;
  };
  const seoOgImage = toAbsolute(sale.imageUrl) || 'https://honsgarden.se/og-image.jpg';
  const seoUrl = `https://honsgarden.se${seoPath}`;
  const sellerId = `${seoUrl}#seller`;
  const productId = `${seoUrl}#product`;
  const offerId = `${seoUrl}#offer`;

  // priceValidUntil — recommended for Offer; default 60 days out
  const priceValidUntil = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  })();

  const priceNumber = Math.max(0, Math.round(Number(sale.price) || 0));
  const safePrice = String(priceNumber);

  const seoJsonLd = listing
    ? [
        {
          '@type': 'Product',
          '@id': productId,
          name: sale.title,
          description: seoDescriptionRaw,
          image: [seoOgImage],
          category: 'Mat & dryck > Ägg',
          sku: slug || listing.id,
          productID: slug || listing.id,
          brand: { '@type': 'Brand', name: 'Hönsgården' },
          offers: {
            '@type': 'Offer',
            '@id': offerId,
            url: seoUrl,
            priceCurrency: 'SEK',
            price: safePrice,
            priceValidUntil,
            availability: isSoldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            areaServed: { '@type': 'Place', name: sale.location },
            seller: { '@id': sellerId },
            eligibleQuantity: { '@type': 'QuantitativeValue', value: 1, unitText: 'karta' },
          },
        },
        {
          '@type': 'LocalBusiness',
          '@id': sellerId,
          name: sale.title,
          description: `Lokal äggförsäljning i ${sale.location} via Hönsgården.`,
          image: [seoOgImage],
          url: seoUrl,
          priceRange: `${safePrice} SEK`,
          address: {
            '@type': 'PostalAddress',
            addressLocality: sale.location,
            addressCountry: 'SE',
          },
          areaServed: { '@type': 'Place', name: sale.location },
          makesOffer: { '@id': offerId },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Hönsgården', item: 'https://honsgarden.se/' },
            { '@type': 'ListItem', position: 2, name: 'Äggförsäljning', item: 'https://honsgarden.se/salja-agg' },
            { '@type': 'ListItem', position: 3, name: sale.title, item: seoUrl },
          ],
        },
      ]
    : undefined;

  useSeo({
    title: seoTitle,
    description: seoDescription,
    path: seoPath,
    ogType: 'product',
    ogImage: seoOgImage,
    ogImageAlt: sale.title,
    noindex: !listing, // hide query-string preview pages from indexing
    jsonLd: seoJsonLd,
  });

  if (isLoading) return <main className="min-h-screen noise-bg px-4 py-8 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></main>;
  if (shouldLoadSlug && !listing) return <main className="min-h-screen noise-bg px-4 py-8 flex items-center justify-center"><Card className="max-w-md"><CardContent className="p-6 text-center space-y-3"><Egg className="h-10 w-10 mx-auto text-muted-foreground" /><h1 className="font-serif text-2xl">Säljlistan hittades inte</h1><p className="text-sm text-muted-foreground">Den kan vara pausad, borttagen eller felstavad.</p><Button variant="outline" onClick={() => window.open('https://honsgarden.se', '_blank')}>Till Hönsgården.se</Button></CardContent></Card></main>;

  const lowStock = !isSoldOut && remaining > 0 && remaining <= 3;
  const reviewCount = (publicReviews as any[]).length;
  const avgRating = reviewCount > 0 ? (publicReviews as any[]).reduce((s, r) => s + Number(r.rating || 0), 0) / reviewCount : 0;

  return <main className="min-h-screen noise-bg px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">

    {/* Hero */}
    <div className="text-center space-y-5">
      <div className="relative mx-auto max-w-xl">
        <div aria-hidden="true" className="absolute -inset-6 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent blur-2xl rounded-[2rem]" />
        {sale.imageUrl
          ? <img src={sale.imageUrl} alt={sale.title} className="relative mx-auto h-60 w-full rounded-3xl object-cover border border-primary/15 shadow-lg" />
          : <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-primary/15 shadow-sm"><Egg className="h-9 w-9 text-primary" /></div>}
        <div className="relative -mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge className="bg-card text-foreground border border-primary/25 shadow-sm">
            <Sparkles className="h-3 w-3 mr-1 text-primary" /> Lokal äggförsäljning
          </Badge>
          {lowStock && <Badge className="bg-warning/15 text-warning border-warning/30 shadow-sm">Endast {remaining} kvar</Badge>}
          {isSoldOut && <Badge className="bg-destructive/15 text-destructive border-destructive/30 shadow-sm">Slutsålt</Badge>}
        </div>
      </div>
      <div className="space-y-2.5">
        <h1 className="font-serif text-3xl sm:text-4xl leading-tight text-foreground">{sale.title}</h1>
        <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">{sale.description}</p>
        {reviewCount > 0 && (
          <div className="inline-flex items-center gap-2 text-sm rounded-full bg-card border border-border px-3 py-1.5 shadow-sm">
            <div className="flex">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(avgRating) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />)}</div>
            <span className="text-muted-foreground"><strong className="text-foreground">{avgRating.toFixed(1)}</strong> · {reviewCount} {reviewCount === 1 ? 'recension' : 'recensioner'}</span>
          </div>
        )}
      </div>
    </div>

    {/* Stats + details */}
    <Card className="border-primary/15 shadow-md bg-gradient-to-br from-primary/8 via-card to-accent/5 overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <InfoStat label="ägg/karta" value={sale.size} />
          <InfoStat label="pris/karta" value={`${sale.price} kr`} accent />
          <InfoStat label="kartor kvar" value={isSoldOut ? 0 : remaining} warn={isSoldOut} highlight={lowStock} />
        </div>
        {isSoldOut && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-center"><p className="font-serif text-lg">Slutsålt just nu</p><p className="text-sm text-muted-foreground">Anmäl dig till väntelistan nedan – du får mejl så fort nya ägg finns.</p></div>}
        <div className="rounded-2xl border bg-card/80 p-4 space-y-3"><Row icon={Package} title="Prislista">{priceRows.map((r) => <div key={r.label} className="flex justify-between text-sm"><span className="text-muted-foreground">{r.label}</span><strong>{r.price}</strong></div>)}</Row><Row icon={MapPin} title="Hämtning"><p className="text-sm text-muted-foreground">{sale.location}</p><p className="text-xs text-muted-foreground">{sale.pickup}</p></Row><Row icon={MessageCircle} title="Kontakt"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{sale.contact}</p></Row><a href="/karta" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline pt-1"><MapPin className="h-4 w-4" /> Se alla säljare på kartan</a></div>
        <Card className="border-primary/20 bg-primary/5 shadow-none"><CardContent className="p-4 space-y-3"><Row icon={Wallet} title="Betala med Swish"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{swishText}</p></Row>{sale.swish && <Button variant="outline" className="w-full rounded-xl" onClick={() => copy(swishText)}><Copy className="h-4 w-4 mr-2" /> Kopiera Swishuppgifter</Button>}</CardContent></Card>
        {listing?.id && <Card className="shadow-sm border-primary/15"><CardContent className="p-4 sm:p-5 space-y-3">{isSoldOut ? <><h2 className="font-serif text-base flex items-center gap-2"><BellRing className="h-4 w-4 text-primary" aria-hidden="true" /> Anmäl dig till väntelistan</h2><p className="text-xs text-muted-foreground">Få ett mejl direkt när säljaren har ägg i lager igen.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input aria-label="Namn" value={wlName} onChange={(e) => setWlName(e.target.value)} placeholder="Namn *" /><Input aria-label="E-post för notis" type="email" value={wlEmail} onChange={(e) => setWlEmail(e.target.value)} placeholder="E-post (för notis)" /></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input aria-label="Telefon (valfritt)" value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} placeholder="Telefon (valfritt)" /><Input aria-label="Önskat antal kartor" type="number" min="1" value={wlPacks} onChange={(e) => setWlPacks(e.target.value)} placeholder="Önskat antal kartor" /></div><Button size="lg" onClick={() => waitlistMutation.mutate()} disabled={waitlistMutation.isPending} className="w-full rounded-xl shadow-sm"><BellRing className="h-4 w-4 mr-2" aria-hidden="true" /> {waitlistMutation.isPending ? 'Skickar...' : 'Anmäl mig'}</Button></> : <><h2 className="font-serif text-base flex items-center gap-2"><ShoppingBasket className="h-4 w-4 text-primary" aria-hidden="true" /> Boka ägg</h2><p className="text-xs text-muted-foreground">Säljaren bekräftar din bokning och återkommer om hämtning.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><Input aria-label="Ditt namn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Namn *" /><Input aria-label="Telefonnummer" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon *" /></div><Input aria-label="E-postadress för bekräftelse" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-post * (för bekräftelse)" /><Input aria-label="Antal kartor" type="number" min="1" max={remaining} value={packs} onChange={(e) => setPacks(e.target.value)} placeholder="Antal kartor" /><Textarea aria-label="Meddelande till säljaren" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Meddelande, t.ex. önskad hämtningstid" /><Button size="lg" onClick={() => bookingMutation.mutate()} disabled={bookingMutation.isPending} className="w-full rounded-xl shadow-sm text-base"><CheckCircle2 className="h-5 w-5 mr-2" aria-hidden="true" /> {bookingMutation.isPending ? 'Skickar bokning...' : 'Skicka bokningsförfrågan'}</Button><p className="text-[11px] text-muted-foreground text-center">Ingen betalning sker här – endast en förfrågan till säljaren.</p></>}</CardContent></Card>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Button variant="secondary" onClick={() => copy(shareText)}><Copy className="h-4 w-4 mr-2" /> Kopiera info</Button><Button variant="outline" onClick={share}><Share2 className="h-4 w-4 mr-2" /> Dela sidan</Button></div>
      </CardContent>
    </Card>
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
function InfoStat({ label, value, warn, highlight, accent }: { label: string; value: string | number; warn?: boolean; highlight?: boolean; accent?: boolean }) {
  const bg = warn ? 'bg-destructive/5 border-destructive/20' : highlight ? 'bg-warning/5 border-warning/30' : accent ? 'bg-primary/8 border-primary/25 shadow-sm' : 'bg-card/90 border-border';
  const tone = warn ? 'text-destructive' : highlight ? 'text-warning' : accent ? 'text-primary' : 'text-foreground';
  return <div className={`rounded-2xl border p-4 transition-colors ${bg}`}><p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p><p className="data-label text-[10px] mt-1">{label}</p></div>;
}
function Row({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) { return <section className="flex gap-3 border-b border-border/40 last:border-0 pb-3 last:pb-0"><Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" /><div className="flex-1"><h2 className="text-sm font-medium font-serif">{title}</h2>{children}</div></section>; }
