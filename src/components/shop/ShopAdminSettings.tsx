import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Globe, Loader2 } from 'lucide-react';

interface Settings {
  publicEnabled: boolean;
  shippingOre: number;
  freeShippingThresholdOre: number;
  supportEmail: string;
  deliveryText: string;
}

const DEFAULTS: Settings = {
  publicEnabled: false,
  shippingOre: 5900,
  freeShippingThresholdOre: 49900,
  supportEmail: 'info@auroramedia.se',
  deliveryText: 'Vi packar din order inom 1–3 arbetsdagar och skickar med Postnord.',
};

function read<T>(v: unknown, fb: T): T {
  if (v === null || v === undefined) return fb;
  if (typeof v === typeof fb) return v as T;
  if (typeof v === 'string') {
    const s = v.replace(/^"|"$/g, '');
    if (typeof fb === 'number') { const n = Number(s); return (Number.isFinite(n) ? n : fb) as unknown as T; }
    if (typeof fb === 'boolean') return (s === 'true') as unknown as T;
    return s as unknown as T;
  }
  return v as T;
}

export default function ShopAdminSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('get_shop_settings').then(({ data }: { data: Record<string, unknown> | null }) => {
      const raw = data ?? {};
      setS({
        publicEnabled: read(raw['shop_public_enabled'], DEFAULTS.publicEnabled),
        shippingOre: read(raw['shop_shipping_ore'], DEFAULTS.shippingOre),
        freeShippingThresholdOre: read(raw['shop_free_shipping_threshold_ore'], DEFAULTS.freeShippingThresholdOre),
        supportEmail: read(raw['shop_support_email'], DEFAULTS.supportEmail),
        deliveryText: read(raw['shop_delivery_text'], DEFAULTS.deliveryText),
      });
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const entries: [string, unknown][] = [
        ['shop_public_enabled', s.publicEnabled],
        ['shop_shipping_ore', s.shippingOre],
        ['shop_free_shipping_threshold_ore', s.freeShippingThresholdOre],
        ['shop_support_email', s.supportEmail],
        ['shop_delivery_text', s.deliveryText],
      ];
      for (const [key, value] of entries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('system_settings')
          .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
        if (error) throw error;
      }
      toast({ title: 'Butiksinställningar sparade' });
    } catch (e) {
      toast({ title: 'Kunde inte spara', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="p-6 rounded-3xl">Laddar inställningar…</Card>;

  return (
    <Card className="p-6 rounded-3xl space-y-5">
      <div className="flex items-start gap-3">
        <Globe className="h-5 w-5 text-primary mt-1" aria-hidden />
        <div className="flex-1">
          <h3 className="font-serif text-xl">Publik butik</h3>
          <p className="text-sm text-muted-foreground">
            När denna är av visas en "öppnar snart"-sida på /butik för alla utom admin. Du kan alltid förhandsvisa.
          </p>
        </div>
        <Switch
          checked={s.publicEnabled}
          onCheckedChange={(v) => setS({ ...s, publicEnabled: v })}
          aria-label="Slå på publik butik"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="shipping">Fraktpris (kr)</Label>
          <Input
            id="shipping" type="number" min={0}
            value={(s.shippingOre / 100).toString()}
            onChange={(e) => setS({ ...s, shippingOre: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
          />
        </div>
        <div>
          <Label htmlFor="free">Fri frakt från (kr)</Label>
          <Input
            id="free" type="number" min={0}
            value={(s.freeShippingThresholdOre / 100).toString()}
            onChange={(e) => setS({ ...s, freeShippingThresholdOre: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="support">Support-e-post</Label>
        <Input id="support" type="email" value={s.supportEmail}
          onChange={(e) => setS({ ...s, supportEmail: e.target.value })} />
      </div>

      <div>
        <Label htmlFor="delivery">Leveranstext</Label>
        <Textarea id="delivery" rows={2} value={s.deliveryText}
          onChange={(e) => setS({ ...s, deliveryText: e.target.value })} />
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
        <strong>Innan lansering:</strong> uppdatera företagsuppgifterna på <code>/butik/villkor</code>
        (företagsnamn, org.nr, adress) och kontrollera att produkter har riktiga bilder + priser.
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
          Spara inställningar
        </Button>
      </div>
    </Card>
  );
}
