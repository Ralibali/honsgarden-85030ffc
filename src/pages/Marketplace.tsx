import { useState, MouseEvent, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Search, MapPin, Plus, Image as ImageIcon, X, Bell, Heart } from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useListings, useFavorites, useToggleFavorite, type ListingFilters } from '@/hooks/useMarketplace';
import { CATEGORIES, REGIONS, categoryEmoji, categoryLabel, formatPrice, timeAgo } from '@/lib/marketplace';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSeo } from '@/hooks/useSeo';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { findMarketplaceCategoryPage } from '@/data/marketplaceCategories.ts';


export default function Marketplace() {
  const { kategori } = useParams<{ kategori?: string }>();
  const categoryPage = useMemo(() => findMarketplaceCategoryPage(kategori), [kategori]);

  const pageTitle = categoryPage?.title ?? 'Marknad – köp & sälj höns, utrustning & mer';
  const seoDescription = categoryPage?.metaDescription ??
    'Sveriges marknadsplats för hönsfolk. Köp och sälj höns, kläckägg, hönshus, foder, maskiner och mer. Helt gratis.';
  const seoPath = categoryPage ? `/marknad/k/${categoryPage.slug}` : '/marknad';

  usePageTitle(pageTitle);

  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const initialCategory = categoryPage && categoryPage.categoryFilter !== 'all' ? categoryPage.categoryFilter : 'all';
  const [filters, setFilters] = useState<ListingFilters>({ sort: 'newest', category: initialCategory as any, region: 'all' });
  const [searchInput, setSearchInput] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { data: rawListings = [], isLoading } = useListings(filters);
  const { data: favoriteIds = new Set<string>() } = useFavorites(user?.id);
  const toggleFav = useToggleFavorite();

  const listings = onlyFavorites
    ? rawListings.filter((l) => favoriteIds.has(l.id))
    : rawListings;

  const jsonLd = useMemo(() => {
    const url = `https://honsgarden.se${seoPath}`;
    const graph: Record<string, any>[] = [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        url,
        name: categoryPage?.h1 ?? 'Marknad',
        description: seoDescription,
        isPartOf: { '@type': 'WebSite', name: 'Hönsgården', url: 'https://honsgarden.se' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://honsgarden.se/' },
          { '@type': 'ListItem', position: 2, name: 'Marknad', item: 'https://honsgarden.se/marknad' },
          ...(categoryPage
            ? [{ '@type': 'ListItem', position: 3, name: categoryPage.h1, item: url }]
            : []),
        ],
      },
    ];
    if (rawListings.length) {
      graph.push({
        '@type': 'ItemList',
        name: categoryPage?.h1 ?? 'Aktuella annonser',
        numberOfItems: Math.min(rawListings.length, 30),
        itemListElement: rawListings.slice(0, 30).map((l, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `https://honsgarden.se/marknad/${l.slug}`,
          name: l.title,
        })),
      });
    }
    if (categoryPage?.faq?.length) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: categoryPage.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    return graph;
  }, [seoPath, seoDescription, categoryPage, rawListings]);

  useSeo({
    title: categoryPage ? pageTitle : 'Marknad – Köp & sälj höns, utrustning & lantliv | Hönsgården',
    description: seoDescription,
    path: seoPath,
    jsonLd,
  });



  const handleToggleFavorite = (e: MouseEvent, listingId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login?redirect=/marknad');
      return;
    }
    const isFav = favoriteIds.has(listingId);
    toggleFav.mutate(
      { listingId, isFavorite: isFav },
      {
        onSuccess: (res) => {
          if (res.saved) toast.success('Sparad i dina favoriter ❤️');
          else toast('Borttagen från favoriter');
        },
        onError: (err: any) => toast.error('Kunde inte uppdatera', { description: err?.message }),
      },
    );
  };


  const applySearch = () => setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
  const clearAll = () => {
    setFilters({ sort: 'newest', category: 'all', region: 'all' });
    setSearchInput('');
  };
  const hasFilters = !!(filters.search || (filters.category && filters.category !== 'all') || (filters.region && filters.region !== 'all') || filters.hasImage);
  const canSaveAlert = !!(filters.search || (filters.category && filters.category !== 'all') || (filters.region && filters.region !== 'all'));

  const saveAlert = async () => {
    if (!isAuthenticated || !user?.id) return;
    setSavingAlert(true);
    try {
      const payload = {
        user_id: user.id,
        category: filters.category && filters.category !== 'all' ? filters.category : null,
        region: filters.region && filters.region !== 'all' ? filters.region : null,
        search_term: filters.search?.trim() || null,
      };
      const { error } = await supabase.from('marketplace_alerts').insert(payload);
      if (error) throw error;
      toast.success('Bevakning skapad! Vi mejlar dig när nya annonser matchar.');
    } catch (e: any) {
      toast.error('Kunde inte skapa bevakning', { description: e?.message });
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <LandingNavbar />
      <main className="pt-24 pb-16 container max-w-6xl mx-auto px-5">
        <header className="mb-8">
          {categoryPage && (
            <nav className="mb-4 text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Hem</Link> / <Link to="/marknad" className="hover:text-foreground">Marknad</Link> / <span>{categoryPage.h1}</span>
            </nav>
          )}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-2">{categoryPage?.h1 ?? 'Marknad'}</h1>
              <p className="text-muted-foreground max-w-xl">
                {categoryPage?.intro ?? 'Köp och sälj höns, utrustning och allt annat för lantlivet. Helt gratis.'}
              </p>
            </div>
            <Button asChild size="lg" className="rounded-2xl gap-2">
              <Link to={isAuthenticated ? '/marknad/ny' : '/login?redirect=/marknad/ny'}>
                <Plus className="h-4 w-4" /> Lägg in annons
              </Link>
            </Button>
          </div>


          {/* Sök + filter */}
          <Card className="border-border/60">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                    placeholder="Sök efter höns, hönshus, foder…"
                    className="pl-10"
                  />
                </div>
                <Button onClick={applySearch}>Sök</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={filters.category ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, category: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Kategori" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla kategorier</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.region ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, region: v }))}>
                  <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Hela Sverige</SelectItem>
                    {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.sort ?? 'newest'} onValueChange={(v) => setFilters((f) => ({ ...f, sort: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Nyast först</SelectItem>
                    <SelectItem value="price_asc">Billigast först</SelectItem>
                    <SelectItem value="price_desc">Dyrast först</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={filters.hasImage ? 'default' : 'outline'}
                  onClick={() => setFilters((f) => ({ ...f, hasImage: !f.hasImage }))}
                  className="gap-2"
                >
                  <ImageIcon className="h-4 w-4" /> Endast med bild
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={onlyFavorites ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate('/login?redirect=/marknad');
                      return;
                    }
                    setOnlyFavorites((v) => !v);
                  }}
                  className="gap-1.5"
                >
                  <Heart className={`h-3.5 w-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
                  ❤️ Sparade
                  {favoriteIds.size > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{favoriteIds.size}</Badge>
                  )}
                </Button>
              </div>
              {(hasFilters || canSaveAlert) && (
                <div className="flex flex-wrap items-center gap-2">
                  {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-muted-foreground">
                      <X className="h-3 w-3" /> Rensa filter
                    </Button>
                  )}
                  {canSaveAlert && (
                    isAuthenticated ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveAlert}
                        disabled={savingAlert}
                        className="gap-1.5"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        {savingAlert ? 'Sparar…' : '🔔 Bevaka denna sökning'}
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link to="/login?redirect=/marknad">
                          <Bell className="h-3.5 w-3.5" /> 🔔 Logga in för att bevaka
                        </Link>
                      </Button>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </header>

        {/* Resultat */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-12">Laddar annonser…</p>
        ) : listings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">Inga annonser matchar din sökning.</p>
            {hasFilters && <Button variant="outline" onClick={clearAll}>Rensa filter</Button>}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{listings.length} annonser</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((l) => {
                const isFav = favoriteIds.has(l.id);
                return (
                <Link to={`/marknad/${l.slug}`} key={l.id} className="group">
                  <Card className="overflow-hidden h-full hover:shadow-md transition-shadow border-border/60">
                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                      {l.image_urls?.[0] ? (
                        <img
                          src={l.image_urls[0]}
                          alt={l.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">{categoryEmoji(l.category)}</div>
                      )}
                      <Badge variant="secondary" className="absolute top-2 left-2 bg-background/90 backdrop-blur">
                        {categoryEmoji(l.category)} {categoryLabel(l.category)}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, l.id)}
                        aria-label={isFav ? 'Ta bort från sparade' : 'Spara annons'}
                        aria-pressed={isFav}
                        className="absolute top-2 right-2 h-9 w-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center shadow-sm hover:bg-background transition"
                      >
                        <Heart
                          className={`h-4 w-4 transition ${isFav ? 'fill-destructive text-destructive' : 'text-foreground'}`}
                        />
                      </button>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">{l.title}</h3>
                      <p className="font-serif text-lg text-primary mb-2">{formatPrice(l.price as any, l.is_giveaway)}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {l.city || l.region ? <><MapPin className="h-3 w-3" /> {l.city || l.region}</> : null}
                        </span>
                        <span>{timeAgo(l.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          </>
        )}

        {categoryPage && (
          <section className="mt-16 border-t border-border/40 pt-10 max-w-3xl">
            <h2 className="font-serif text-2xl text-foreground mb-4">Vanliga frågor</h2>
            <div className="space-y-4">
              {categoryPage.faq.map((f) => (
                <div key={f.q}>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{f.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-xs text-muted-foreground">
              <Link to="/marknad" className="underline hover:text-foreground">← Tillbaka till hela marknaden</Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

