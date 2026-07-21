import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Globe, Loader2, Building2, Truck, ShieldCheck, AlertTriangle } from 'lucide-react';

interface Settings {
  publicEnabled: boolean;
  shippingOre: number;
  freeShippingThresholdOre: number;
  supportEmail: string;
  deliveryText: string;
  companyName: string;
  companyOrgNumber: string;
  companyAddress: string;
  returnAddress: string;
  deliveryMethod: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  termsReviewedAt: string | null;
}

const DEFAULTS: Settings = {
  publicEnabled: false,
  shippingOre: 5900,
  freeShippingThresholdOre: 49900,
  supportEmail: 'info@auroramedia.se',
  deliveryText: 'Vi packar din order inom 1–3 arbetsdagar och skickar med Postnord.',
  companyName: '',
  companyOrgNumber: '',
  companyAddress: '',
  returnAddress: '',
  deliveryMethod: 'Postnord',
  deliveryDaysMin: 1,
  deliveryDaysMax: 3,
  termsReviewedAt: null,
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

const KEYS = [
  'shop_public_enabled', 'shop_shipping_ore', 'shop_free_shipping_threshold_ore',
  'shop_support_email', 'shop_delivery_text',
  'shop_company_name', 'shop_company_org_number', 'shop_company_address',
  'shop_return_address', 'shop_delivery_method',
  'shop_delivery_days_min', 'shop_delivery_days_max', 'shop_terms_reviewed_at',
];

export default function ShopAdminSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('system_settings').select('key,value').in('key', KEYS);
      const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
      const termsRaw = map.get('shop_terms_reviewed_at');
      const termsReviewedAt = typeof termsRaw === 'string'
        ? (termsRaw.replace(/^"|"$/g, '') || null)
        : (termsRaw ? String(termsRaw) : null);
      setS({
        publicEnabled: read(map.get('shop_public_enabled'), DEFAULTS.publicEnabled),
        shippingOre: read(map.get('shop_shipping_ore'), DEFAULTS.shippingOre),
        freeShippingThresholdOre: read(map.get('shop_free_shipping_threshold_ore'), DEFAULTS.freeShippingThresholdOre),
        supportEmail: read(map.get('shop_support_email'), DEFAULTS.supportEmail),
        deliveryText: read(map.get('shop_delivery_text'), DEFAULTS.deliveryText),
        companyName: read(map.get('shop_company_name'), DEFAULTS.companyName),
        companyOrgNumber: read(map.get('shop_company_org_number'), DEFAULTS.companyOrgNumber),
        companyAddress: read(map.get('shop_company_address'), DEFAULTS.companyAddress),
        returnAddress: read(map.get('shop_return_address'), DEFAULTS.returnAddress),
        deliveryMethod: read(map.get('shop_delivery_method'), DEFAULTS.deliveryMethod),
        deliveryDaysMin: read(map.get('shop_delivery_days_min'), DEFAULTS.deliveryDaysMin),
        deliveryDaysMax: read(map.get('shop_delivery_days_max'), DEFAULTS.deliveryDaysMax),
        termsReviewedAt,
      });
      setLoading(false);
    })();
  }, []);

  const missingCompanyInfo = !s.companyName.trim() || !s.companyOrgNumber.trim() || !s.companyAddress.trim();
  const termsOk = !!s.termsReviewedAt;
  const canGoPublic = !missingCompanyInfo && termsOk;

  const save = async (overrides?: Partial<Settings>) => {
    setSaving(true);
    try {
      const next = { ...s, ...overrides };
      // Blockera publicEnabled=true om företagsinfo eller villkor saknas
      if (next.publicEnabled && (!next.companyName.trim() || !next.companyOrgNumber.trim() || !next.companyAddress.trim() || !next.termsReviewedAt)) {
        toast({
          title: 'Kan inte öppna butiken publikt',
          description: 'Fyll i företagsuppgifter och markera att köpvillkoren är granskade först.',
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }
      const entries: [string, unknown][] = [
        ['shop_public_enabled', next.publicEnabled],
        ['shop_shipping_ore', next.shippingOre],
        ['shop_free_shipping_threshold_ore', next.freeShippingThresholdOre],
        ['shop_support_email', next.supportEmail],
        ['shop_delivery_text', next.deliveryText],
        ['shop_company_name', next.companyName],
        ['shop_company_org_number', next.companyOrgNumber],
        ['shop_company_address', next.companyAddress],
        ['shop_return_address', next.returnAddress],
        ['shop_delivery_method', next.deliveryMethod],
        ['shop_delivery_days_min', next.deliveryDaysMin],
        ['shop_delivery_days_max', next.deliveryDaysMax],
        ['shop_terms_reviewed_at', next.termsReviewedAt],
      ];
      for (const [key, value] of entries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('system_settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
        if (error) throw error;
      }
      setS(next);
      toast({ title: 'Butiksinställningar sparade' });
    } catch (e) {
      toast({ title: 'Kunde inte spara', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const markTermsReviewed = (checked: boolean) => {
    setS((prev) => ({ ...prev, termsReviewedAt: checked ? new Date().toISOString() : null }));
  };

  if (loading) return <Card className="p-6 rounded-3xl">Laddar inställningar…</Card>;

  return (
    <div className="space-y-5">
      {!canGoPublic && (
        <Card className="p-4 rounded-2xl border-amber-300 bg-amber-50 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5" aria-hidden />
          <div className="text-sm text-amber-900">
            <strong>Innan du kan öppna butiken publikt</strong> måste företagsnamn, organisationsnummer och adress fyllas i,
            samt att du markerat köpvillkoren som granskade.
          </div>
        </Card>
      )}

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
            disabled={!canGoPublic && !s.publicEnabled}
            aria-label="Slå på publik butik"
          />
        </div>
      </Card>

      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Företagsuppgifter</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cname">Företagsnamn *</Label>
            <Input id="cname" value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="corg">Organisationsnummer *</Label>
            <Input id="corg" value={s.companyOrgNumber} onChange={(e) => setS({ ...s, companyOrgNumber: e.target.value })} placeholder="XXXXXX-XXXX" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="caddr">Postadress *</Label>
            <Input id="caddr" value={s.companyAddress} onChange={(e) => setS({ ...s, companyAddress: e.target.value })} placeholder="Gatan 1, 123 45 Ort" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="raddr">Returadress (om annan än postadress)</Label>
            <Input id="raddr" value={s.returnAddress} onChange={(e) => setS({ ...s, returnAddress: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="support">Support-e-post</Label>
            <Input id="support" type="email" value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Leverans & frakt</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dmethod">Fraktbolag</Label>
            <Input id="dmethod" value={s.deliveryMethod} onChange={(e) => setS({ ...s, deliveryMethod: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="dmin">Snabbast (dagar)</Label>
              <Input id="dmin" type="number" min={0} value={s.deliveryDaysMin} onChange={(e) => setS({ ...s, deliveryDaysMin: Math.max(0, Number(e.target.value || 0)) })} />
            </div>
            <div>
              <Label htmlFor="dmax">Långsammast (dagar)</Label>
              <Input id="dmax" type="number" min={0} value={s.deliveryDaysMax} onChange={(e) => setS({ ...s, deliveryDaysMax: Math.max(0, Number(e.target.value || 0)) })} />
            </div>
          </div>
          <div>
            <Label htmlFor="shipping">Fraktpris (kr)</Label>
            <Input id="shipping" type="number" min={0}
              value={(s.shippingOre / 100).toString()}
              onChange={(e) => setS({ ...s, shippingOre: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })} />
          </div>
          <div>
            <Label htmlFor="free">Fri frakt från (kr)</Label>
            <Input id="free" type="number" min={0}
              value={(s.freeShippingThresholdOre / 100).toString()}
              onChange={(e) => setS({ ...s, freeShippingThresholdOre: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="delivery">Leveranstext (visas på produktsida & kassa)</Label>
            <Textarea id="delivery" rows={2} value={s.deliveryText} onChange={(e) => setS({ ...s, deliveryText: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card className="p-6 rounded-3xl space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Köpvillkor granskade</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Bocka i när du har läst igenom <a className="underline" href="/butik/villkor" target="_blank" rel="noreferrer">/butik/villkor</a> och verifierat att alla uppgifter stämmer.
          Krävs innan butiken kan öppnas publikt.
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <Switch checked={termsOk} onCheckedChange={markTermsReviewed} aria-label="Markera köpvillkor granskade" />
          <span className="text-sm">
            {termsOk
              ? <>Granskat {s.termsReviewedAt ? new Date(s.termsReviewedAt).toLocaleDateString('sv-SE') : ''}</>
              : 'Ej granskat ännu'}
          </span>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save()} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
          Spara inställningar
        </Button>
      </div>
    </div>
  );
}
