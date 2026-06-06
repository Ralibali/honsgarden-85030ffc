import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ExternalLink,
  Eye,
  LayoutGrid,
  List,
  Loader2,
  Package,
  PauseCircle,
  PlayCircle,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import CreateEggSaleListingDialog from './CreateEggSaleListingDialog';

const PUBLIC_BASE_URL = 'https://honsgarden.se';

type Listing = {
  id: string;
  slug: string;
  title: string | null;
  location: string | null;
  description: string | null;
  image_url: string | null;
  price_per_pack: number | null;
  packs_available: number | null;
  stock_packs: number | null;
  is_active: boolean | null;
  sold_out_manually: boolean | null;
  auto_publish: boolean | null;
  updated_at: string | null;
};

type StatusFilter = 'all' | 'active' | 'paused' | 'soldout';
type SortBy = 'recent' | 'title' | 'price_asc' | 'price_desc' | 'stock_desc' | 'stock_asc';
type ViewMode = 'grid' | 'list';

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

function statusOf(l: Listing): StatusFilter {
  if (l.sold_out_manually) return 'soldout';
  if (l.is_active === false) return 'paused';
  return 'active';
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function EggSalesListingsBrowser() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [view, setView] = useState<ViewMode>('grid');

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['egg-sales-browser-listings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select(
          'id, slug, title, location, description, image_url, price_per_pack, packs_available, stock_packs, is_active, sold_out_manually, auto_publish, updated_at',
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Listing[];
    },
    refetchInterval: 60_000,
  });

  const counts = useMemo(() => {
    const c = { all: listings.length, active: 0, paused: 0, soldout: 0 } as Record<StatusFilter, number>;
    listings.forEach((l) => {
      c[statusOf(l)] += 1;
    });
    return c;
  }, [listings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().slice(0, 80);
    let rows = listings.filter((l) => {
      if (status !== 'all' && statusOf(l) !== status) return false;
      if (!q) return true;
      const hay = `${l.title || ''} ${l.location || ''} ${l.slug || ''}`.toLowerCase();
      return hay.includes(q);
    });

    rows = [...rows].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '', 'sv');
        case 'price_asc':
          return Number(a.price_per_pack || 0) - Number(b.price_per_pack || 0);
        case 'price_desc':
          return Number(b.price_per_pack || 0) - Number(a.price_per_pack || 0);
        case 'stock_desc':
          return Number(b.stock_packs || 0) - Number(a.stock_packs || 0);
        case 'stock_asc':
          return Number(a.stock_packs || 0) - Number(b.stock_packs || 0);
        case 'recent':
        default:
          return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
      }
    });

    return rows;
  }, [listings, search, status, sortBy]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['egg-sales-browser-listings'] });
    queryClient.invalidateQueries({ queryKey: ['agda-pro-listings'] });
  };

  const togglePause = async (l: Listing) => {
    const { error } = await (supabase as any)
      .from('public_egg_sale_listings')
      .update({ is_active: !l.is_active })
      .eq('id', l.id);
    if (error) {
      toast({ title: 'Det gick inte att uppdatera', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: l.is_active ? 'Säljlistan är pausad' : 'Säljlistan är aktiv igen' });
    refetch();
  };

  const toggleSoldOut = async (l: Listing) => {
    const { error } = await (supabase as any)
      .from('public_egg_sale_listings')
      .update({ sold_out_manually: !l.sold_out_manually })
      .eq('id', l.id);
    if (error) {
      toast({ title: 'Det gick inte att uppdatera', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: l.sold_out_manually ? 'Säljlistan är inte längre slutsåld' : 'Säljlistan är markerad som slutsåld' });
    refetch();
  };

  const removeListing = async (l: Listing) => {
    if (!window.confirm(`Vill du verkligen ta bort "${l.title || 'säljlistan'}"? Detta går inte att ångra.`)) return;
    const { error } = await (supabase as any).from('public_egg_sale_listings').delete().eq('id', l.id);
    if (error) {
      toast({ title: 'Det gick inte att ta bort', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Säljlistan är borttagen' });
    refetch();
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setSortBy('recent');
  };

  const hasActiveFilter = search.trim().length > 0 || status !== 'all' || sortBy !== 'recent';

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-xl text-foreground flex items-center gap-2">
              <ShoppingBasket className="h-5 w-5 text-primary" /> Mina säljlistor
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sök, filtrera och hantera dina publicerade säljsidor.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CreateEggSaleListingDialog />
            <div className="flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
              <Button
                variant={view === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-lg h-8 gap-1.5"
                onClick={() => setView('grid')}
                aria-label="Visa som rutnät"
                aria-pressed={view === 'grid'}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Rutnät</span>
              </Button>
              <Button
                variant={view === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-lg h-8 gap-1.5"
                onClick={() => setView('list')}
                aria-label="Visa som lista"
                aria-pressed={view === 'list'}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Sök + sortering */}
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value.slice(0, 80))}
              maxLength={80}
              placeholder="Sök på titel, plats eller länk…"
              className="pl-9 pr-9 h-10 rounded-xl"
              aria-label="Sök säljlistor"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Rensa sökning"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-10 rounded-xl lg:w-[220px] gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Sortera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Senast uppdaterad</SelectItem>
              <SelectItem value="title">Titel (A–Ö)</SelectItem>
              <SelectItem value="price_asc">Pris (lågt→högt)</SelectItem>
              <SelectItem value="price_desc">Pris (högt→lågt)</SelectItem>
              <SelectItem value="stock_desc">Mest i lager</SelectItem>
              <SelectItem value="stock_asc">Minst i lager</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Statusfilter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { key: 'all', label: 'Alla' },
            { key: 'active', label: 'Aktiva' },
            { key: 'paused', label: 'Pausade' },
            { key: 'soldout', label: 'Slutsålda' },
          ] as { key: StatusFilter; label: string }[]).map((tab) => {
            const isActive = status === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatus(tab.key)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {tab.label}
                <span
                  className={`tabular-nums ${
                    isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                  }`}
                >
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              <X className="h-3 w-3" /> Rensa filter
            </button>
          )}
        </div>

        {/* Resultat */}
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <ShoppingBasket className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">Inga träffar</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilter
                ? 'Prova att rensa filter eller ändra sökorden.'
                : 'Skapa din första säljlista nedan så dyker den upp här.'}
            </p>
            {hasActiveFilter && (
              <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={clearFilters}>
                Rensa filter
              </Button>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                search={search}
                onTogglePause={togglePause}
                onToggleSoldOut={toggleSoldOut}
                onDelete={removeListing}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((l) => (
              <ListingRow
                key={l.id}
                listing={l}
                search={search}
                onTogglePause={togglePause}
                onToggleSoldOut={toggleSoldOut}
                onDelete={removeListing}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            Visar {filtered.length} av {listings.length} {listings.length === 1 ? 'säljlista' : 'säljlistor'}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadges({ listing }: { listing: Listing }) {
  const stockLeft = Number(listing.stock_packs ?? 0);
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={listing.is_active ? 'default' : 'secondary'}>
        {listing.is_active ? 'Aktiv' : 'Pausad'}
      </Badge>
      {listing.sold_out_manually && <Badge variant="destructive">Slutsåld</Badge>}
      <Badge
        variant="outline"
        className={
          stockLeft === 0
            ? 'border-destructive text-destructive'
            : stockLeft <= 3
            ? 'border-amber-500 text-amber-700'
            : 'border-emerald-500 text-emerald-700'
        }
      >
        <Package className="h-3 w-3 mr-1" />
        {stockLeft} i lager
      </Badge>
      {listing.auto_publish !== false && (
        <Badge variant="outline" className="text-xs">
          Auto
        </Badge>
      )}
    </div>
  );
}

function ListingActions({
  listing,
  onTogglePause,
  onToggleSoldOut,
  onDelete,
  compact,
}: {
  listing: Listing;
  onTogglePause: (l: Listing) => void;
  onToggleSoldOut: (l: Listing) => void;
  onDelete: (l: Listing) => void;
  compact?: boolean;
}) {
  const url = `${PUBLIC_BASE_URL}/s/${listing.slug}`;
  return (
    <div className={compact ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-2 sm:grid-cols-4 gap-2'}>
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl"
        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      >
        <Eye className="h-3.5 w-3.5 mr-1" /> Visa
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onTogglePause(listing)}>
        {listing.is_active ? (
          <>
            <PauseCircle className="h-3.5 w-3.5 mr-1" /> Pausa
          </>
        ) : (
          <>
            <PlayCircle className="h-3.5 w-3.5 mr-1" /> Aktivera
          </>
        )}
      </Button>
      <Button size="sm" variant="outline" className="rounded-xl" onClick={() => onToggleSoldOut(listing)}>
        {listing.sold_out_manually ? 'Öppna' : 'Slutsåld'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="rounded-xl text-destructive hover:text-destructive"
        onClick={() => onDelete(listing)}
      >
        <Trash2 className="h-3.5 w-3.5 mr-1" /> Ta bort
      </Button>
    </div>
  );
}

function ListingCard({
  listing,
  search,
  onTogglePause,
  onToggleSoldOut,
  onDelete,
}: {
  listing: Listing;
  search: string;
  onTogglePause: (l: Listing) => void;
  onToggleSoldOut: (l: Listing) => void;
  onDelete: (l: Listing) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden flex flex-col">
      <div className="relative h-32 bg-muted/30">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title || 'Säljlista'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Package className="h-6 w-6" />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-card/90 backdrop-blur rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
          {Math.round(Number(listing.price_per_pack || 0))} kr
        </div>
      </div>
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <div>
          <p className="font-medium text-sm leading-snug line-clamp-2">
            {highlight(listing.title || 'Utan titel', search)}
          </p>
          {listing.location && (
            <p className="text-xs text-muted-foreground truncate">{highlight(listing.location, search)}</p>
          )}
        </div>
        <StatusBadges listing={listing} />
        <div className="mt-auto pt-1">
          <ListingActions
            listing={listing}
            onTogglePause={onTogglePause}
            onToggleSoldOut={onToggleSoldOut}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function ListingRow({
  listing,
  search,
  onTogglePause,
  onToggleSoldOut,
  onDelete,
}: {
  listing: Listing;
  search: string;
  onTogglePause: (l: Listing) => void;
  onToggleSoldOut: (l: Listing) => void;
  onDelete: (l: Listing) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="h-14 w-14 rounded-xl bg-muted/30 overflow-hidden shrink-0 flex items-center justify-center">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title || 'Säljlista'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-medium text-sm truncate">{highlight(listing.title || 'Utan titel', search)}</p>
          <span className="text-sm font-semibold tabular-nums shrink-0">
            {Math.round(Number(listing.price_per_pack || 0))} kr
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          {listing.location ? <span>{highlight(listing.location, search)} · </span> : null}
          <a
            href={`${PUBLIC_BASE_URL}/s/${listing.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground inline-flex items-center gap-0.5"
          >
            /s/{listing.slug} <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="mt-2">
          <StatusBadges listing={listing} />
        </div>
      </div>
      <div className="sm:ml-auto">
        <ListingActions
          listing={listing}
          onTogglePause={onTogglePause}
          onToggleSoldOut={onToggleSoldOut}
          onDelete={onDelete}
          compact
        />
      </div>
    </div>
  );
}
