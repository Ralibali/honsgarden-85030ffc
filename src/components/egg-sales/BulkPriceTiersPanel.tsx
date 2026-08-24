import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Copy as CopyIcon,
  Download,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  formatTierRange,
  normalizeTiers,
  type PriceTier,
} from '@/lib/eggSalePricing';

type Listing = {
  id: string;
  slug: string | null;
  title: string | null;
  price_per_pack: number | string | null;
  price_tiers: unknown;
};

type DraftTier = { min_qty: string; max_qty: string; price_per_pack: string };

const blankDraft = (afterMin = 0): DraftTier => ({
  min_qty: String(afterMin ? afterMin + 1 : 1),
  max_qty: '',
  price_per_pack: '',
});

const draftFromTier = (t: PriceTier): DraftTier => ({
  min_qty: String(t.min_qty),
  max_qty: t.max_qty === null ? '' : String(t.max_qty),
  price_per_pack: String(t.price_per_pack),
});

const tierFromDraft = (d: DraftTier): PriceTier | null => {
  const min = Math.max(1, Math.floor(Number(d.min_qty) || 0));
  const price = Number(String(d.price_per_pack).replace(',', '.'));
  if (!min || !Number.isFinite(price) || price <= 0) return null;
  const maxRaw = d.max_qty.trim();
  const max = maxRaw === '' ? null : Math.max(min, Math.floor(Number(maxRaw)));
  return { min_qty: min, max_qty: max, price_per_pack: Math.round(price * 100) / 100 };
};

const tiersSummary = (tiers: PriceTier[], fallback: number) =>
  tiers.length
    ? tiers.map((t) => `${formatTierRange(t)} → ${t.price_per_pack} kr`).join(' · ')
    : `Grundpris ${fallback || '—'} kr/karta`;

// ---------- CSV helpers ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',' || ch === ';') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch === '\r') { /* skip */ }
    else cur += ch;
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function tiersToCsv(listings: Listing[]): string {
  const lines = ['slug,title,min_qty,max_qty,price_per_pack'];
  for (const l of listings) {
    const tiers = normalizeTiers(l.price_tiers);
    const slug = l.slug ?? '';
    const title = (l.title ?? '').replace(/"/g, '""');
    if (!tiers.length) {
      lines.push(`${slug},"${title}",,,`);
      continue;
    }
    for (const t of tiers) {
      lines.push(`${slug},"${title}",${t.min_qty},${t.max_qty ?? ''},${t.price_per_pack}`);
    }
  }
  return lines.join('\n');
}

// ---------- component ----------

export default function BulkPriceTiersPanel({ listings }: { listings: Listing[] }) {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<DraftTier[]>([
    { min_qty: '1', max_qty: '5', price_per_pack: '' },
    { min_qty: '6', max_qty: '10', price_per_pack: '' },
    { min_qty: '11', max_qty: '', price_per_pack: '' },
  ]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(
    () =>
      drafts
        .map(tierFromDraft)
        .filter((t): t is PriceTier => t !== null)
        .sort((a, b) => a.min_qty - b.min_qty),
    [drafts],
  );

  const overlap = useMemo(() => {
    for (let i = 1; i < parsed.length; i++) {
      const prevMax = parsed[i - 1].max_qty === null ? Infinity : parsed[i - 1].max_qty!;
      if (parsed[i].min_qty <= prevMax) return true;
    }
    return false;
  }, [parsed]);

  const allSelected = listings.length > 0 && selectedIds.size === listings.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(listings.map((l) => l.id)));
  const toggleOne = (id: string) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const apply = useMutation({
    mutationFn: async ({ ids, tiers }: { ids: string[]; tiers: PriceTier[] }) => {
      if (!ids.length) throw new Error('Välj minst en säljlista.');
      const { error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .update({ price_tiers: tiers })
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast({
        title: 'Prisstegen är uppdaterade',
        description: `${count} säljlist${count === 1 ? 'a' : 'or'} har fått de nya prisstegen.`,
      });
      qc.invalidateQueries({ queryKey: ['dashboard-listings'] });
    },
    onError: (e: Error) =>
      toast({ title: 'Kunde inte uppdatera', description: e.message, variant: 'destructive' }),
  });

  const handleApply = () => {
    if (overlap) {
      toast({ title: 'Prisstegen överlappar', variant: 'destructive' });
      return;
    }
    apply.mutate({ ids: Array.from(selectedIds), tiers: parsed });
  };

  const handleClearSelected = () => {
    apply.mutate({ ids: Array.from(selectedIds), tiers: [] });
  };

  const copyFromListing = (id: string) => {
    const src = listings.find((l) => l.id === id);
    if (!src) return;
    const tiers = normalizeTiers(src.price_tiers);
    if (!tiers.length) {
      toast({ title: 'Listan har inga prissteg ännu' });
      return;
    }
    setDrafts(tiers.map(draftFromTier));
    toast({ title: 'Prisstegen är kopierade till mallen' });
  };

  const exportCsv = () => {
    const csv = tiersToCsv(listings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prissteg-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importMutation = useMutation({
    mutationFn: async (text: string) => {
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('CSV-filen är tom eller saknar rader.');
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const idx = {
        slug: headers.indexOf('slug'),
        min: headers.indexOf('min_qty'),
        max: headers.indexOf('max_qty'),
        price: headers.indexOf('price_per_pack'),
      };
      if (idx.slug < 0 || idx.min < 0 || idx.price < 0) {
        throw new Error('CSV måste innehålla kolumnerna slug, min_qty och price_per_pack.');
      }
      const bySlug = new Map<string, PriceTier[]>();
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const slug = (row[idx.slug] || '').trim();
        if (!slug) continue;
        const priceStr = (row[idx.price] || '').trim();
        if (!priceStr) {
          // Empty price row = explicit "no tiers" for this slug
          if (!bySlug.has(slug)) bySlug.set(slug, []);
          continue;
        }
        const tier = tierFromDraft({
          min_qty: (row[idx.min] || '').trim(),
          max_qty: idx.max >= 0 ? (row[idx.max] || '').trim() : '',
          price_per_pack: priceStr,
        });
        if (!tier) throw new Error(`Ogiltig rad ${r + 1} för ${slug}.`);
        const list = bySlug.get(slug) ?? [];
        list.push(tier);
        bySlug.set(slug, list);
      }

      const slugToId = new Map(listings.filter((l) => l.slug).map((l) => [l.slug!, l.id]));
      const unknown: string[] = [];
      const updates: { id: string; tiers: PriceTier[] }[] = [];
      for (const [slug, tiers] of bySlug.entries()) {
        const id = slugToId.get(slug);
        if (!id) { unknown.push(slug); continue; }
        const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
        for (let i = 1; i < sorted.length; i++) {
          const prevMax = sorted[i - 1].max_qty === null ? Infinity : sorted[i - 1].max_qty!;
          if (sorted[i].min_qty <= prevMax) {
            throw new Error(`Prisstegen för ${slug} överlappar.`);
          }
        }
        updates.push({ id, tiers: sorted });
      }

      for (const u of updates) {
        const { error } = await (supabase as any)
          .from('public_egg_sale_listings')
          .update({ price_tiers: u.tiers })
          .eq('id', u.id);
        if (error) throw error;
      }

      return { applied: updates.length, unknown };
    },
    onSuccess: ({ applied, unknown }) => {
      qc.invalidateQueries({ queryKey: ['dashboard-listings'] });
      toast({
        title: `Importerat: ${applied} säljlist${applied === 1 ? 'a' : 'or'}`,
        description: unknown.length
          ? `Hittade inte slug: ${unknown.join(', ')}`
          : 'Alla rader matchades mot dina säljlistor.',
      });
    },
    onError: (e: Error) =>
      toast({ title: 'Kunde inte importera', description: e.message, variant: 'destructive' }),
  });

  const onFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importMutation.mutate(String(reader.result || ''));
    reader.onerror = () =>
      toast({ title: 'Kunde inte läsa filen', variant: 'destructive' });
    reader.readAsText(file, 'utf-8');
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">Bulkredigera prissteg</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exportera CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => fileRef.current?.click()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importera CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Bygg en mall med prissteg och tillämpa den på flera säljlistor på en gång. CSV-formatet är{' '}
          <code className="rounded bg-muted px-1 text-xs">slug,title,min_qty,max_qty,price_per_pack</code>.
          Lämna <em>max_qty</em> tomt för översta steget (t.ex. 11+) och lämna <em>price_per_pack</em> tomt
          för att rensa prisstegen för en slug.
        </p>

        {/* Tier template */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mall – prissteg</Label>
          {drafts.map((d, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl border bg-card p-3">
              <div className="col-span-4 sm:col-span-3">
                <Label className="text-xs">Min</Label>
                <Input
                  inputMode="numeric"
                  value={d.min_qty}
                  onChange={(e) =>
                    setDrafts((arr) => arr.map((x, j) => (j === i ? { ...x, min_qty: e.target.value.replace(/[^\d]/g, '') } : x)))
                  }
                />
              </div>
              <div className="col-span-4 sm:col-span-3">
                <Label className="text-xs">Max (tomt = ∞)</Label>
                <Input
                  inputMode="numeric"
                  value={d.max_qty}
                  onChange={(e) =>
                    setDrafts((arr) => arr.map((x, j) => (j === i ? { ...x, max_qty: e.target.value.replace(/[^\d]/g, '') } : x)))
                  }
                />
              </div>
              <div className="col-span-3 sm:col-span-4">
                <Label className="text-xs">Pris/karta (kr)</Label>
                <Input
                  inputMode="decimal"
                  value={d.price_per_pack}
                  onChange={(e) =>
                    setDrafts((arr) => arr.map((x, j) => (j === i ? { ...x, price_per_pack: e.target.value.replace(/[^\d.,]/g, '') } : x)))
                  }
                />
              </div>
              <div className="col-span-1 sm:col-span-2 flex justify-end">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDrafts((arr) => arr.filter((_, j) => j !== i))}
                  aria-label="Ta bort rad"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                const lastMin = drafts.length ? Number(drafts[drafts.length - 1].min_qty) || 0 : 0;
                setDrafts((arr) => [...arr, blankDraft(lastMin)]);
              }}
            >
              <Plus className="h-4 w-4" /> Lägg till rad
            </Button>
            {overlap && (
              <p className="text-xs text-destructive">
                Prisstegen överlappar varandra – justera Min/Max.
              </p>
            )}
          </div>
        </div>

        {/* Listings selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Säljlistor ({listings.length})
            </Label>
            <Button size="sm" variant="ghost" onClick={toggleAll}>
              {allSelected ? 'Avmarkera alla' : 'Markera alla'}
            </Button>
          </div>
          <div className="space-y-2">
            {listings.map((l) => {
              const tiers = normalizeTiers(l.price_tiers);
              const fallback = Number(l.price_per_pack || 0);
              return (
                <div
                  key={l.id}
                  className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="flex flex-1 cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(l.id)}
                      onCheckedChange={() => toggleOne(l.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {l.title || 'Säljsida'}{' '}
                        {l.slug && <span className="font-mono text-xs text-muted-foreground">/s/{l.slug}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{tiersSummary(tiers, fallback)}</p>
                    </div>
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1"
                    onClick={() => copyFromListing(l.id)}
                  >
                    <CopyIcon className="h-3.5 w-3.5" /> Kopiera till mall
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Badge variant="secondary">{selectedIds.size} valda</Badge>
          <Button
            onClick={handleApply}
            disabled={apply.isPending || !selectedIds.size || !parsed.length || overlap}
            className="gap-1"
          >
            {apply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Tillämpa mall på valda
          </Button>
          <Button
            variant="outline"
            onClick={handleClearSelected}
            disabled={apply.isPending || !selectedIds.size}
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" /> Rensa prissteg på valda
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
