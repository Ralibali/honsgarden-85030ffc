import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Flag, Share2, MessageSquare, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useListingBySlug, useSendMessage, useReportListing, incrementView } from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeo } from '@/hooks/useSeo';
import { categoryEmoji, categoryLabel, formatPrice, timeAgo } from '@/lib/marketplace';

export default function MarketplaceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data: listing, isLoading } = useListingBySlug(slug);
  const [seller, setSeller] = useState<{ display_name: string; created_at: string } | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [msgOpen, setMsgOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [reportReason, setReportReason] = useState('');

  const sendMsg = useSendMessage();
  const report = useReportListing();

  usePageTitle(listing?.title ?? 'Annons');
  useSeo({
    title: listing ? `${listing.title} | Marknad Hönsgården` : 'Marknad',
    description: listing?.description?.slice(0, 155) ?? 'Köp och sälj på Hönsgården.',
    path: listing ? `/marknad/${listing.slug}` : '/marknad',
    ogImage: listing?.image_urls?.[0],
  });

  useEffect(() => { if (slug) incrementView(slug); }, [slug]);

  useEffect(() => {
    if (!listing) return;
    supabase.from('profiles').select('display_name, created_at')
      .eq('user_id', listing.user_id).maybeSingle()
      .then(({ data }) => data && setSeller(data as any));
  }, [listing]);

  const sendMessage = async () => {
    if (!listing || !msg.trim()) return;
    try {
      await sendMsg.mutateAsync({
        listing_id: listing.id,
        recipient_user_id: listing.user_id,
        content: msg.trim(),
      });
      toast({ title: 'Meddelande skickat!', description: 'Säljaren får en notis och kan svara från sin inkorg.' });
      setMsgOpen(false);
      setMsg('');
      navigate('/app/marknad/mina');
    } catch (e: any) {
      toast({ title: 'Kunde inte skicka', description: e.message, variant: 'destructive' });
    }
  };

  const submitReport = async () => {
    if (!listing || reportReason.trim().length < 3) return;
    try {
      await report.mutateAsync({ listing_id: listing.id, reason: reportReason });
      toast({ title: 'Anmälan mottagen', description: 'Tack! Vi tittar på annonsen.' });
      setReportOpen(false);
      setReportReason('');
    } catch (e: any) {
      toast({ title: 'Kunde inte rapportera', description: e.message, variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: listing?.title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Länk kopierad' });
    }
  };

  if (isLoading) return <div className="min-h-dvh bg-background"><LandingNavbar /><p className="pt-32 text-center text-muted-foreground">Laddar…</p></div>;
  if (!listing) return <div className="min-h-dvh bg-background"><LandingNavbar /><div className="pt-32 text-center"><p className="text-muted-foreground mb-4">Annonsen hittades inte eller är borttagen.</p><Button asChild><Link to="/marknad">Till Marknad</Link></Button></div></div>;

  const isOwner = user?.id === listing.user_id;
  const images = listing.image_urls?.length ? listing.image_urls : [];

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description,
    image: images,
    category: categoryLabel(listing.category),
    offers: {
      '@type': 'Offer',
      price: listing.price ?? 0,
      priceCurrency: listing.currency || 'SEK',
      availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: typeof window !== 'undefined' ? window.location.href : '',
    },
  };

  return (
    <div className="min-h-dvh bg-background">
      <LandingNavbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <main className="pt-24 pb-16 container max-w-4xl mx-auto px-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('/marknad')} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Till Marknad
        </Button>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Bilder */}
          <div className="md:col-span-3">
            <div className="aspect-[4/3] bg-muted rounded-2xl overflow-hidden relative">
              {images.length > 0 ? (
                <img src={images[activeImg]} alt={listing.title} className="w-full h-full object-contain bg-card" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-7xl">{categoryEmoji(listing.category)}</div>
              )}
              {images.length > 1 && (
                <>
                  <button onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-6 gap-2 mt-2">
                {images.map((url, i) => (
                  <button key={url} onClick={() => setActiveImg(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 ${i === activeImg ? 'border-primary' : 'border-transparent'}`}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="md:col-span-2 space-y-4">
            <Badge variant="secondary">{categoryEmoji(listing.category)} {categoryLabel(listing.category)}</Badge>
            <h1 className="font-serif text-3xl text-foreground">{listing.title}</h1>
            <p className="font-serif text-3xl text-primary">{formatPrice(listing.price as any, listing.is_giveaway)}</p>

            <div className="text-sm text-muted-foreground space-y-1">
              {(listing.city || listing.region) && (
                <p className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {[listing.city, listing.region].filter(Boolean).join(', ')}</p>
              )}
              <p>Publicerad {timeAgo(listing.created_at)} · {listing.view_count} visningar</p>
              {listing.condition && <p>Skick: {listing.condition}</p>}
            </div>

            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Säljare</p>
              <p className="font-medium text-foreground">{seller?.display_name ?? 'Hönsgården-medlem'}</p>
              {seller?.created_at && (
                <p className="text-xs text-muted-foreground">Medlem sedan {new Date(seller.created_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })}</p>
              )}
            </CardContent></Card>

            {listing.status === 'sold' && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100 p-4 text-center font-medium">
                ✅ Denna annons är såld
              </div>
            )}
            {isOwner ? (
              <Alert>Detta är din egen annons. <Link to="/app/marknad/mina" className="underline">Hantera den här</Link>.</Alert>
            ) : listing.status === 'active' ? (
              <Button size="lg" className="w-full rounded-2xl gap-2"
                onClick={() => isAuthenticated ? setMsgOpen(true) : navigate(`/login?redirect=/marknad/${listing.slug}`)}>
                <MessageSquare className="h-4 w-4" /> Skicka meddelande
              </Button>
            ) : listing.status !== 'sold' ? (
              <Badge variant="outline" className="w-full justify-center py-3">Annonsen är inte aktiv</Badge>
            ) : null}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={handleShare}>
                <Share2 className="h-3 w-3" /> Dela
              </Button>
              {!isOwner && isAuthenticated && (
                <Button variant="outline" size="sm" className="flex-1 gap-1 text-destructive" onClick={() => setReportOpen(true)}>
                  <Flag className="h-3 w-3" /> Anmäl
                </Button>
              )}
            </div>
          </div>
        </div>

        <Card className="mt-8"><CardContent className="p-6">
          <h2 className="font-serif text-xl text-foreground mb-3">Beskrivning</h2>
          <p className="text-foreground whitespace-pre-wrap leading-relaxed">{listing.description}</p>
        </CardContent></Card>
      </main>

      {/* Meddelande-modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skicka meddelande till säljaren</DialogTitle>
            <DialogDescription>Säljaren får en notis och kan svara direkt här på Hönsgården.</DialogDescription>
          </DialogHeader>
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} maxLength={2000}
            placeholder="Hej! Är annonsen kvar? Jag är intresserad…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)}>Avbryt</Button>
            <Button onClick={sendMessage} disabled={!msg.trim() || sendMsg.isPending}>
              {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Skicka'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rapportera */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anmäl annonsen</DialogTitle>
            <DialogDescription>Berätta kort vad som är fel så hanterar vi det.</DialogDescription>
          </DialogHeader>
          <Input value={reportReason} onChange={(e) => setReportReason(e.target.value)} maxLength={500}
            placeholder="T.ex. bluff, olämpligt innehåll, fel kategori…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Avbryt</Button>
            <Button onClick={submitReport} disabled={reportReason.trim().length < 3 || report.isPending}>Skicka anmälan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Liten inline Alert
function Alert({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">{children}</div>;
}
