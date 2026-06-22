import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Save, Tag, Trash2 } from 'lucide-react';
import {
  formatTierRange,
  getPricePerPack,
  normalizeTiers,
  type PriceTier,
} from '@/lib/eggSalePricing';

type DraftTier = {
  min_qty: string;
  max_qty: string; // empty string = unlimited
  price_per_pack: string;
};

const toDraft = (t: PriceTier): DraftTier => ({
  min_qty: String(t.min_qty),
  max_qty: t.max_qty === null ? '' : String(t.max_qty),
  price_per_pack: String(t.price_per_pack),
});

const fromDraft = (d: DraftTier): PriceTier | null => {
  const min = Math.max(1, Math.floor(Number(d.min_qty) || 0));
  const price = Number(String(d.price_per_pack).replace(',', '.'));
  if (!min || !Number.isFinite(price) || price <= 0) return null;
  const maxRaw = d.max_qty.trim();
  const max = maxRaw === '' ? null : Math.max(min, Math.floor(Number(maxRaw)));
  return { min_qty: min, max_qty: max, price_per_pack: Math.round(price * 100) / 100 };
};

const defaultDraft = (afterMin: number | null): DraftTier => ({
  min_qty: String(afterMin ? afterMin + 1 : 1),
  max_qty: '',
  price_per_pack: '',
});

export default function PriceTiersEditor({
  listing,
}: {
  listing: { id: string; price_per_pack: number | string | null; price_tiers?: unknown };
}) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<DraftTier[]>([]);

  // Hydrate from listing whenever it changes.
  useEffect(() => {
    const tiers = normalizeTiers(listing.price_tiers);
    setDrafts(tiers.length ? tiers.map(toDraft) : []);
  }, [listing.id, JSON.stringify(listing.price_tiers)]);

  const parsed: PriceTier[] = useMemo(() => {
    return drafts
      .map(fromDraft)
      .filter((t): t is PriceTier => t !== null)
      .sort((a, b) => a.min_qty - b.min_qty);
  }, [drafts]);

  // Validation: no overlapping ranges
  const overlap = useMemo(() => {
    for (let i = 1; i < parsed.length; i++) {
      const prev = parsed[i - 1];
      const cur = parsed[i];
      const prevMax = prev.max_qty === null ? Infinity : prev.max_qty;
      if (cur.min_qty <= prevMax) return true;
    }
    return false;
  }, [parsed]);

  const baseFallback = Number(listing.price_per_pack || 0) || 0;

  const save = useMutation({
    mutationFn: async () => {
      if (overlap) throw new Error('Prisstegen får inte överlappa varandra.');
      const payload = parsed; // already normalized
      const { error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .update({ price_tiers: payload })
        .eq('id', listing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Prisstegen är sparade' });
      qc.invalidateQueries({ queryKey: ['dashboard-listings'] });
    },
    onError: (e: Error) =>
      toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const addRow = () => {
    setDrafts((arr) => {
      const lastMin = arr.length ? Number(arr[arr.length - 1].min_qty) || 0 : 0;
      return [...arr, defaultDraft(lastMin || 0)];
    });
  };

  const removeRow = (i: number) =>
    setDrafts((arr) => arr.filter((_, idx) => idx !== i));

  const updateRow = (i: number, patch: Partial<DraftTier>) =>
    setDrafts((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">Prissteg per antal kartor</h2>
          </div>
          <Badge variant={parsed.length ? 'default' : 'secondary'}>
            {parsed.length ? `${parsed.length} steg` : 'Inga prissteg'}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Sätt ett rabatterat pris per karta när kunden köper större antal. Exempel: 1–5 kartor 60 kr, 6–10 kartor 55 kr, 11+ kartor 50 kr.
          Lämna fältet <em>Max</em> tomt för det översta steget (t.ex. 11+).
          Saknas prissteg används ditt vanliga grundpris ({baseFallback || '—'} kr) per karta.
        </p>

        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Inga prissteg ännu. Lägg till ett steg nedan för att börja erbjuda mängdrabatt.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-12 gap-2 px-1 text-xs text-muted-foreground sm:grid">
              <div className="col-span-3"><Label className="text-xs">Min antal</Label></div>
              <div className="col-span-3"><Label className="text-xs">Max antal (tomt = ingen gräns)</Label></div>
              <div className="col-span-4"><Label className="text-xs">Pris per karta (kr)</Label></div>
              <div className="col-span-2" />
            </div>
            {drafts.map((d, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-xl border bg-card p-3">
                <div className="col-span-4 sm:col-span-3">
                  <Label className="text-xs sm:hidden">Min</Label>
                  <Input
                    inputMode="numeric"
                    value={d.min_qty}
                    onChange={(e) => updateRow(i, { min_qty: e.target.value.replace(/[^\d]/g, '') })}
                    placeholder="1"
                  />
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <Label className="text-xs sm:hidden">Max</Label>
                  <Input
                    inputMode="numeric"
                    value={d.max_qty}
                    onChange={(e) => updateRow(i, { max_qty: e.target.value.replace(/[^\d]/g, '') })}
                    placeholder="∞"
                  />
                </div>
                <div className="col-span-3 sm:col-span-4">
                  <Label className="text-xs sm:hidden">Pris/karta</Label>
                  <Input
                    inputMode="decimal"
                    value={d.price_per_pack}
                    onChange={(e) => updateRow(i, { price_per_pack: e.target.value.replace(/[^\d.,]/g, '') })}
                    placeholder={`${baseFallback || 60}`}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeRow(i)}
                    aria-label="Ta bort steg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="h-4 w-4" /> Lägg till prissteg
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || overlap} className="gap-1">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara prissteg
          </Button>
          {overlap && (
            <p className="text-xs text-destructive">
              Prisstegen överlappar varandra – justera Min/Max så att intervallen inte krockar.
            </p>
          )}
        </div>

        {parsed.length > 0 && (
          <div className="rounded-2xl border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Förhandsvisning
            </p>
            <ul className="space-y-1 text-sm">
              {parsed.map((t, i) => (
                <li key={i} className="flex justify-between">
                  <span>{formatTierRange(t)}</span>
                  <strong>{t.price_per_pack} kr / karta</strong>
                </li>
              ))}
            </ul>
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Exempel: 8 kartor → {getPricePerPack(8, parsed, baseFallback)} kr/karta ·
              {' '}20 kartor → {getPricePerPack(20, parsed, baseFallback)} kr/karta
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
