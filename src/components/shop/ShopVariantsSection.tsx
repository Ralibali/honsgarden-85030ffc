import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Loader2, Layers } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { findDuplicateSkus } from '@/lib/shop/validation';

interface Variant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  options: Record<string, string> | null;
  price_override_ore: number | null;
  stock: number | null;
  active: boolean;
  sort_order: number;
}

interface Props {
  productId: string | null;
  basePriceOre?: number | null;
}

export default function ShopVariantsSection({ productId, basePriceOre = null }: Props) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<
    { id: string; usageCount: number } | null
  >(null);

  useEffect(() => {
    if (!productId) { setVariants([]); return; }
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('shop_product_variants').select('*').eq('product_id', productId).order('sort_order');
      setVariants((data ?? []) as Variant[]);
      setLoading(false);
    })();
  }, [productId]);

  const duplicateSkus = useMemo(() => findDuplicateSkus(variants), [variants]);

  if (!productId) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground text-center">
        Spara produkten först för att lägga till varianter (t.ex. storlek eller färg).
      </div>
    );
  }

  const addRow = () => {
    setVariants((v) => [...v, {
      id: `new-${Math.random().toString(36).slice(2, 8)}`,
      product_id: productId,
      name: '',
      sku: null,
      options: null,
      price_override_ore: null,
      stock: null,
      active: true,
      sort_order: v.length,
    }]);
  };

  const update = (id: string, patch: Partial<Variant>) =>
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const requestRemove = async (id: string) => {
    if (id.startsWith('new-')) {
      setVariants((prev) => prev.filter((v) => v.id !== id));
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: usage } = await (supabase as any).rpc('shop_variant_order_usage', { p_variant_id: id });
    const usageCount = typeof usage === 'number' ? usage : Number(usage ?? 0);
    setConfirmState({ id, usageCount });
  };

  const confirmRemove = async () => {
    if (!confirmState) return;
    const id = confirmState.id;
    setConfirmState(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('shop_product_variants').delete().eq('id', id);
    if (error) { toast({ title: 'Kunde inte ta bort variant', description: error.message, variant: 'destructive' }); return; }
    setVariants((prev) => prev.filter((v) => v.id !== id));
    toast({ title: 'Variant borttagen' });
  };

  const saveAll = async () => {
    // Validering före save
    for (const v of variants) {
      if (!v.name.trim()) {
        toast({ title: 'Namn saknas', description: 'Alla varianter måste ha ett namn.', variant: 'destructive' });
        return;
      }
      if (v.price_override_ore !== null && v.price_override_ore < 0) {
        toast({ title: 'Ogiltigt pris', description: 'Prisöverskrivning får inte vara negativ.', variant: 'destructive' });
        return;
      }
      if (v.stock !== null && v.stock < 0) {
        toast({ title: 'Ogiltigt lager', description: 'Lager får inte vara negativt.', variant: 'destructive' });
        return;
      }
      if (v.options) {
        for (const [k, val] of Object.entries(v.options)) {
          if (!k.trim() || !String(val).trim()) {
            toast({ title: 'Ofullständigt alternativ', description: 'Både nyckel och värde krävs.', variant: 'destructive' });
            return;
          }
        }
      }
    }
    if (duplicateSkus.length > 0) {
      toast({ title: 'Dubbletter av SKU', description: `Följande används flera gånger: ${duplicateSkus.join(', ')}`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      for (const v of variants) {
        const payload = {
          product_id: productId,
          name: v.name.trim(),
          sku: v.sku?.trim() || null,
          options: v.options ?? {},
          price_override_ore: v.price_override_ore,
          stock: v.stock,
          active: v.active,
          sort_order: v.sort_order,
        };
        if (v.id.startsWith('new-')) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from('shop_product_variants').insert([payload]);
          if (error) throw error;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from('shop_product_variants').update(payload).eq('id', v.id);
          if (error) throw error;
        }
      }
      toast({ title: 'Varianter sparade' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('shop_product_variants').select('*').eq('product_id', productId).order('sort_order');
      setVariants((data ?? []) as Variant[]);
    } catch (e) {
      toast({ title: 'Kunde inte spara varianter', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const effectivePrice = (v: Variant): string => {
    const ore = v.price_override_ore ?? basePriceOre ?? null;
    if (ore == null) return '—';
    return `${(ore / 100).toFixed(2).replace('.', ',')} kr`;
  };

  return (
    <Card className="p-4 rounded-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <p className="font-medium">Varianter</p>
          <span className="text-xs text-muted-foreground">({variants.length})</span>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={addRow} aria-label="Lägg till ny variant">
          <Plus className="h-4 w-4 mr-1" /> Ny variant
        </Button>
      </div>

      {duplicateSkus.length > 0 && (
        <p className="text-xs text-destructive" role="alert">
          Dubbletter av SKU: {duplicateSkus.join(', ')}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Laddar…</p>
      ) : variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga varianter. Lämna tomt om produkten säljs som en enda variant.</p>
      ) : (
        <div className="space-y-3">
          {variants.map((v) => (
            <div key={v.id} className="rounded-xl border p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs" htmlFor={`v-name-${v.id}`}>Namn</Label>
                  <Input id={`v-name-${v.id}`} value={v.name} onChange={(e) => update(v.id, { name: e.target.value })} placeholder="T.ex. Storlek M" />
                </div>
                <div>
                  <Label className="text-xs" htmlFor={`v-sku-${v.id}`}>SKU</Label>
                  <Input id={`v-sku-${v.id}`} value={v.sku ?? ''} onChange={(e) => update(v.id, { sku: e.target.value })} placeholder="TSHIRT-M" />
                </div>
              </div>
              <div>
                <Label className="text-xs" htmlFor={`v-opts-${v.id}`}>Alternativ (nyckel=värde, kommaseparerat)</Label>
                <Input
                  id={`v-opts-${v.id}`}
                  value={v.options ? Object.entries(v.options).map(([k, val]) => `${k}=${val}`).join(', ') : ''}
                  onChange={(e) => {
                    const opts: Record<string, string> = {};
                    e.target.value.split(',').forEach((pair) => {
                      const [k, val] = pair.split('=').map((x) => x.trim());
                      if (k) opts[k] = val ?? '';
                    });
                    update(v.id, { options: Object.keys(opts).length ? opts : null });
                  }}
                  placeholder="storlek=M, färg=svart"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs" htmlFor={`v-price-${v.id}`}>Pris (kr, tomt = ärver)</Label>
                  <Input
                    id={`v-price-${v.id}`}
                    inputMode="decimal"
                    value={v.price_override_ore !== null ? (v.price_override_ore / 100).toString() : ''}
                    onChange={(e) => {
                      const t = e.target.value.trim();
                      const num = parseFloat(t.replace(',', '.'));
                      update(v.id, { price_override_ore: t === '' || !Number.isFinite(num) ? null : Math.round(num * 100) });
                    }}
                    placeholder="ärver"
                  />
                </div>
                <div>
                  <Label className="text-xs" htmlFor={`v-stock-${v.id}`}>Lager</Label>
                  <Input
                    id={`v-stock-${v.id}`}
                    inputMode="numeric"
                    value={v.stock === null ? '' : String(v.stock)}
                    onChange={(e) => {
                      const t = e.target.value.trim();
                      update(v.id, { stock: t === '' ? null : Math.max(0, parseInt(t, 10) || 0) });
                    }}
                    placeholder="∞"
                  />
                </div>
                <div>
                  <Label className="text-xs" htmlFor={`v-sort-${v.id}`}>Sortering</Label>
                  <Input
                    id={`v-sort-${v.id}`}
                    inputMode="numeric"
                    value={String(v.sort_order)}
                    onChange={(e) => update(v.id, { sort_order: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={v.active} onCheckedChange={(a) => update(v.id, { active: a })} />
                  Aktiv
                </label>
                <p className="text-xs text-muted-foreground">Effektivt pris: {effectivePrice(v)}</p>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => requestRemove(v.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Ta bort variant ${v.name || 'utan namn'}`}
                  title="Ta bort variant"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={saveAll} disabled={saving || variants.length === 0} className="rounded-xl">
          {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Spara varianter
        </Button>
      </div>

      <AlertDialog open={confirmState !== null} onOpenChange={(o) => !o && setConfirmState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort variant?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState && confirmState.usageCount > 0
                ? `Denna variant förekommer i ${confirmState.usageCount} tidigare ordrar (som ögonblicksbild). Vi rekommenderar att avaktivera varianten istället för att radera – ordrar och historik behålls då. Vill du fortsätta ta bort raden?`
                : 'Ta bort variant permanent?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive hover:bg-destructive/90">
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
