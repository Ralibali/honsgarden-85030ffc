import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Globe, Loader2, CheckCircle2, AlertTriangle, Building2, Truck, ShieldCheck } from 'lucide-react';

interface Settings {
  publicEnabled: boolean;
  shippingOre: number;
  freeShippingThresholdOre: number;
  supportEmail: string;
  deliveryText: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  companyName: string;
  companyOrgNumber: string;
  companyAddress: string;
  returnAddress: string;
  termsReviewedAt: string | null;
}

const DEFAULTS: Settings = {
  publicEnabled: false,
  shippingOre: 5900,
  freeShippingThresholdOre: 49900,
  supportEmail: 'info@auroramedia.se',
  deliveryText: '',
  deliveryDaysMin: 1,
  deliveryDaysMax: 3,
  companyName: '',
  companyOrgNumber: '',
  companyAddress: '',
  returnAddress: '',
  termsReviewedAt: null,
};

const KEY_MAP: Record<keyof Settings, string> = {
  publicEnabled: 'shop_public_enabled',
  shippingOre: 'shop_shipping_ore',
  freeShippingThresholdOre: 'shop_free_shipping_threshold_ore',
  supportEmail: 'shop_support_email',
  deliveryText: 'shop_delivery_text',
  deliveryDaysMin: 'shop_delivery_days_min',
  deliveryDaysMax: 'shop_delivery_days_max',
  companyName: 'shop_company_name',
  companyOrgNumber: 'shop_company_org_number',
  companyAddress: 'shop_company_address',
  returnAddress: 'shop_return_address',
  termsReviewedAt: 'shop_terms_reviewed_at',
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
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('system_settings')
        .select('key,value')
        .in('key', Object.values(KEY_MAP));
      const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
      setS({
        publicEnabled: read(map.get(KEY_MAP.publicEnabled), DEFAULTS.publicEnabled),
        shippingOre: read(map.get(KEY_MAP.shippingOre), DEFAULTS.shippingOre),
        freeShippingThresholdOre: read(map.get(KEY_MAP.freeShippingThresholdOre), DEFAULTS.freeShippingThresholdOre),
        supportEmail: read(map.get(KEY_MAP.supportEmail), DEFAULTS.supportEmail),
        deliveryText: read(map.get(KEY_MAP.deliveryText), DEFAULTS.deliveryText),
        deliveryDaysMin: read(map.get(KEY_MAP.deliveryDaysMin), DEFAULTS.deliveryDaysMin),
        deliveryDaysMax: read(map.get(KEY_MAP.deliveryDaysMax), DEFAULTS.deliveryDaysMax),
        companyName: read(map.get(KEY_MAP.companyName), DEFAULTS.companyName),
        companyOrgNumber: read(map.get(KEY_MAP.companyOrgNumber), DEFAULTS.companyOrgNumber),
        companyAddress: read(map.get(KEY_MAP.companyAddress), DEFAULTS.companyAddress),
        returnAddress: read(map.get(KEY_MAP.returnAddress), DEFAULTS.returnAddress),
        termsReviewedAt: (() => {
          const v = map.get(KEY_MAP.termsReviewedAt);
          if (v === null || v === undefined) return null;
          const str = typeof v === 'string' ? v.replace(/^"|"$/g, '') : String(v);
          return str === '' || str === 'null' ? null : str;
        })(),
      });
      setLoading(false);
    })();
  }, []);

  const check = {
    company_name: s.companyName.trim() !== '',
    org_number: s.companyOrgNumber.trim() !== '',
    address: s.companyAddress.trim() !== '',
    support_email: s.supportEmail.trim() !== '',
    delivery_text: s.deliveryText.trim() !== '',
    terms_reviewed: !!s.termsReviewedAt,
  };
  const readyToLaunch = Object.values(check).every(Boolean);

  const save = async () => {
    setSaving(true);
    try {
      const entries: [string, unknown][] = [
        [KEY_MAP.shippingOre, s.shippingOre],
        [KEY_MAP.freeShippingThresholdOre, s.freeShippingThresholdOre],
        [KEY_MAP.supportEmail, s.supportEmail],
        [KEY_MAP.deliveryText, s.deliveryText],
        [KEY_MAP.deliveryDaysMin, s.deliveryDaysMin],
        [KEY_MAP.deliveryDaysMax, s.deliveryDaysMax],
        [KEY_MAP.companyName, s.companyName],
        [KEY_MAP.companyOrgNumber, s.companyOrgNumber],
        [KEY_MAP.companyAddress, s.companyAddress],
        [KEY_MAP.returnAddress, s.returnAddress],
        [KEY_MAP.termsReviewedAt, s.termsReviewedAt],
        // publicEnabled sist så launch-gaten kan validera övriga fält
        [KEY_MAP.publicEnabled, s.publicEnabled],
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
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('launch_gate_incomplete')) {
        toast({
          title: 'Butiken kan inte öppnas ännu',
          description: 'Fyll i företagsuppgifter, leveranstext och markera köpvillkoren som granskade.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Kunde inte spara', description: msg, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="p-6 rounded-3xl">Laddar inställningar…</Card>;

  return (
    <div className="space-y-5">
      {/* Launch gate */}
      <Card className="p-6 rounded-3xl space-y-4 border-primary/20">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-primary mt-1" aria-hidden />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-xl">Publik butik</h3>
              {readyToLaunch ? (
                <Badge className="bg-success/10 text-success border-success/20">Klar att lanseras</Badge>
              ) : (
                <Badge variant="outline" className="text-warning border-warning/40 gap-1">
                  <AlertTriangle className="h-3 w-3" /> Checklistan är inte klar
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              När denna är av visas en "öppnar snart"-sida på /butik för alla utom admin.
              Servern blockerar aktivering tills alla punkter i checklistan är avklarade.
            </p>
          </div>
          <Switch
            checked={s.publicEnabled}
            disabled={!readyToLaunch && !s.publicEnabled}
            onCheckedChange={(v) => setS({ ...s, publicEnabled: v })}
            aria-label="Slå på publik butik"
          />
        </div>

        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {[
            ['company_name', 'Företagsnamn ifyllt'],
            ['org_number', 'Organisationsnummer ifyllt'],
            ['address', 'Postadress ifylld'],
            ['support_email', 'Support-e-post ifylld'],
            ['delivery_text', 'Leveranstext ifylld'],
            ['terms_reviewed', 'Köpvillkor granskade'],
          ].map(([k, label]) => (
            <li key={k} className="flex items-center gap-2">
              {check[k as keyof typeof check] ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" />
              )}
              <span className={check[k as keyof typeof check] ? '' : 'text-muted-foreground'}>{label}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Företagsuppgifter */}
      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Företagsuppgifter</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company_name">Företagsnamn</Label>
            <Input id="company_name" value={s.companyName}
              onChange={(e) => setS({ ...s, companyName: e.target.value })} placeholder="AB Höns & Ägg" />
          </div>
          <div>
            <Label htmlFor="org">Organisationsnummer</Label>
            <Input id="org" value={s.companyOrgNumber}
              onChange={(e) => setS({ ...s, companyOrgNumber: e.target.value })} placeholder="556677-8899" />
          </div>
        </div>
        <div>
          <Label htmlFor="addr">Postadress</Label>
          <Textarea id="addr" rows={2} value={s.companyAddress}
            onChange={(e) => setS({ ...s, companyAddress: e.target.value })} placeholder="Gatunamn 1, 123 45 Ort" />
        </div>
        <div>
          <Label htmlFor="ret">Returadress (om annan än postadress)</Label>
          <Textarea id="ret" rows={2} value={s.returnAddress}
            onChange={(e) => setS({ ...s, returnAddress: e.target.value })} placeholder="Lämna tomt = samma som postadress" />
        </div>
      </Card>

      {/* Leverans & priser */}
      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Leverans</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <Label htmlFor="dmin">Leveranstid min (dagar)</Label>
            <Input id="dmin" type="number" min={0}
              value={s.deliveryDaysMin}
              onChange={(e) => setS({ ...s, deliveryDaysMin: Math.max(0, Number(e.target.value || 0)) })} />
          </div>
          <div>
            <Label htmlFor="dmax">Leveranstid max (dagar)</Label>
            <Input id="dmax" type="number" min={0}
              value={s.deliveryDaysMax}
              onChange={(e) => setS({ ...s, deliveryDaysMax: Math.max(0, Number(e.target.value || 0)) })} />
          </div>
        </div>
        <div>
          <Label htmlFor="delivery">Leveranstext (visas i butiken)</Label>
          <Textarea id="delivery" rows={2} value={s.deliveryText}
            onChange={(e) => setS({ ...s, deliveryText: e.target.value })}
            placeholder="Beskriv leveranstid och frakt utan att låsa dig vid ett specifikt fraktbolag." />
          <p className="text-xs text-muted-foreground mt-1">
            Tips: nämn inte ett specifikt fraktbolag om du kan byta – skriv t.ex. "Skickas inom 1–3 arbetsdagar".
          </p>
        </div>
        <div>
          <Label htmlFor="support">Support-e-post</Label>
          <Input id="support" type="email" value={s.supportEmail}
            onChange={(e) => setS({ ...s, supportEmail: e.target.value })} />
        </div>
      </Card>

      {/* Köpvillkor */}
      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Köpvillkor</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Öppna <a className="underline text-primary" href="/butik/villkor" target="_blank" rel="noreferrer">/butik/villkor</a>{' '}
          och läs igenom att företagsuppgifter, ångerrätt och leveransuppgifter stämmer.
          Bekräfta här när du är klar – det krävs innan butiken kan öppnas.
        </p>
        <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Jag har granskat köpvillkoren</p>
            {s.termsReviewedAt && (
              <p className="text-xs text-muted-foreground">
                Senast granskad: {new Date(s.termsReviewedAt).toLocaleString('sv-SE')}
              </p>
            )}
          </div>
          <Switch
            checked={!!s.termsReviewedAt}
            onCheckedChange={(v) => setS({ ...s, termsReviewedAt: v ? new Date().toISOString() : null })}
            aria-label="Markera villkor som granskade"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="rounded-xl">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden />}
          Spara inställningar
        </Button>
      </div>
    </div>
  );
}
