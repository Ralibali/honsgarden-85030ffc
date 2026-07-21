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
import { Globe, Loader2, CheckCircle2, AlertTriangle, Building2, Truck, ShieldCheck, Undo2 } from 'lucide-react';
import {
  computeLaunchChecklist, isLaunchReady, isValidEmail, validateShippingDays,
} from '@/lib/shop/validation';

interface Settings {
  publicEnabled: boolean;
  shippingOre: number;
  freeShippingThresholdOre: number;
  supportEmail: string;
  deliveryText: string;
  deliveryMethod: string;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  companyName: string;
  companyOrgNumber: string;
  companyAddress: string;
  returnAddress: string;
  termsReviewedAt: string | null;
  withdrawalEnabled: boolean;
}

// Delivery days: null = "inte beslutat". Aldrig 1/3 som förval.
const DEFAULTS: Settings = {
  publicEnabled: false,
  shippingOre: 5900,
  freeShippingThresholdOre: 49900,
  supportEmail: '',
  deliveryText: '',
  deliveryMethod: '',
  deliveryDaysMin: null,
  deliveryDaysMax: null,
  companyName: '',
  companyOrgNumber: '',
  companyAddress: '',
  returnAddress: '',
  termsReviewedAt: null,
  withdrawalEnabled: true,
};

const KEY_MAP: Record<keyof Settings, string> = {
  publicEnabled: 'shop_public_enabled',
  shippingOre: 'shop_shipping_ore',
  freeShippingThresholdOre: 'shop_free_shipping_threshold_ore',
  supportEmail: 'shop_support_email',
  deliveryText: 'shop_delivery_text',
  deliveryMethod: 'shop_delivery_method',
  deliveryDaysMin: 'shop_delivery_days_min',
  deliveryDaysMax: 'shop_delivery_days_max',
  companyName: 'shop_company_name',
  companyOrgNumber: 'shop_company_org_number',
  companyAddress: 'shop_company_address',
  returnAddress: 'shop_return_address',
  termsReviewedAt: 'shop_terms_reviewed_at',
  withdrawalEnabled: 'shop_withdrawal_function_enabled',
};

function readStr(v: unknown, fb: string): string {
  if (v === null || v === undefined) return fb;
  if (typeof v === 'string') { const s = v.replace(/^"|"$/g, ''); return s === 'null' ? fb : s; }
  return String(v);
}
function readNum(v: unknown, fb: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = readStr(v, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : fb;
}
function readNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = readStr(v, '');
  if (s === '' || s === 'null') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function readBool(v: unknown, fb: boolean): boolean {
  if (typeof v === 'boolean') return v;
  const s = readStr(v, '').toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fb;
}

export default function ShopAdminSettings() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [dMinText, setDMinText] = useState('');
  const [dMaxText, setDMaxText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('system_settings').select('key,value').in('key', Object.values(KEY_MAP));
      const map = new Map<string, unknown>((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
      const next: Settings = {
        publicEnabled: readBool(map.get(KEY_MAP.publicEnabled), DEFAULTS.publicEnabled),
        shippingOre: readNum(map.get(KEY_MAP.shippingOre), DEFAULTS.shippingOre),
        freeShippingThresholdOre: readNum(map.get(KEY_MAP.freeShippingThresholdOre), DEFAULTS.freeShippingThresholdOre),
        supportEmail: readStr(map.get(KEY_MAP.supportEmail), ''),
        deliveryText: readStr(map.get(KEY_MAP.deliveryText), ''),
        deliveryMethod: readStr(map.get(KEY_MAP.deliveryMethod), ''),
        deliveryDaysMin: readNumOrNull(map.get(KEY_MAP.deliveryDaysMin)),
        deliveryDaysMax: readNumOrNull(map.get(KEY_MAP.deliveryDaysMax)),
        companyName: readStr(map.get(KEY_MAP.companyName), ''),
        companyOrgNumber: readStr(map.get(KEY_MAP.companyOrgNumber), ''),
        companyAddress: readStr(map.get(KEY_MAP.companyAddress), ''),
        returnAddress: readStr(map.get(KEY_MAP.returnAddress), ''),
        termsReviewedAt: (() => {
          const raw = map.get(KEY_MAP.termsReviewedAt);
          const t = readStr(raw, '');
          return t === '' || t === 'null' ? null : t;
        })(),
        withdrawalEnabled: readBool(map.get(KEY_MAP.withdrawalEnabled), true),
      };
      setS(next);
      setDMinText(next.deliveryDaysMin === null ? '' : String(next.deliveryDaysMin));
      setDMaxText(next.deliveryDaysMax === null ? '' : String(next.deliveryDaysMax));
      setLoading(false);
    })();
  }, []);

  const shipDaysCheck = validateShippingDays(dMinText, dMaxText);
  const check = computeLaunchChecklist(s);
  const readyToLaunch = isLaunchReady(s);

  const save = async () => {
    if (shipDaysCheck.ok !== true) {
      toast({ title: 'Ogiltiga leveransdagar', description: shipDaysCheck.error, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const entries: [string, unknown][] = [
        [KEY_MAP.shippingOre, s.shippingOre],
        [KEY_MAP.freeShippingThresholdOre, s.freeShippingThresholdOre],
        [KEY_MAP.supportEmail, s.supportEmail],
        [KEY_MAP.deliveryText, s.deliveryText],
        [KEY_MAP.deliveryMethod, s.deliveryMethod],
        [KEY_MAP.deliveryDaysMin, shipDaysCheck.min],
        [KEY_MAP.deliveryDaysMax, shipDaysCheck.max],
        [KEY_MAP.companyName, s.companyName],
        [KEY_MAP.companyOrgNumber, s.companyOrgNumber],
        [KEY_MAP.companyAddress, s.companyAddress],
        [KEY_MAP.returnAddress, s.returnAddress],
        [KEY_MAP.termsReviewedAt, s.termsReviewedAt],
        [KEY_MAP.withdrawalEnabled, s.withdrawalEnabled],
        [KEY_MAP.publicEnabled, s.publicEnabled],
      ];
      for (const [key, value] of entries) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('system_settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
        if (error) throw error;
      }
      setS({ ...s, deliveryDaysMin: shipDaysCheck.min, deliveryDaysMax: shipDaysCheck.max });
      toast({ title: 'Butiksinställningar sparade' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('launch_gate_incomplete')) {
        toast({
          title: 'Butiken kan inte öppnas ännu',
          description: 'Servern kräver komplett företagsinfo, leveransmetod, granskade köpvillkor och aktiv ångerfunktion.',
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
            ['support_email', 'Support-e-post ifylld och giltig'],
            ['delivery_text', 'Leveranstext ifylld'],
            ['delivery_method', 'Leveransmetod ifylld'],
            ['terms_reviewed', 'Köpvillkor granskade'],
            ['withdrawal_enabled', 'Ångerfunktion (/butik/angra) aktiverad'],
          ].map(([k, label]) => (
            <li key={k} className="flex items-center gap-2">
              {check[k as keyof typeof check] ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
              ) : (
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
              )}
              <span className={check[k as keyof typeof check] ? '' : 'text-muted-foreground'}>{label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Företagsuppgifter</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label htmlFor="company_name">Företagsnamn</Label>
            <Input id="company_name" value={s.companyName}
              onChange={(e) => setS({ ...s, companyName: e.target.value })} /></div>
          <div><Label htmlFor="org">Organisationsnummer</Label>
            <Input id="org" value={s.companyOrgNumber}
              onChange={(e) => setS({ ...s, companyOrgNumber: e.target.value })} /></div>
        </div>
        <div><Label htmlFor="addr">Postadress</Label>
          <Textarea id="addr" rows={2} value={s.companyAddress}
            onChange={(e) => setS({ ...s, companyAddress: e.target.value })} /></div>
        <div><Label htmlFor="ret">Returadress (om annan än postadress)</Label>
          <Textarea id="ret" rows={2} value={s.returnAddress}
            onChange={(e) => setS({ ...s, returnAddress: e.target.value })}
            placeholder="Lämna tomt = samma som postadress" /></div>
      </Card>

      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Leverans</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label htmlFor="shipping">Fraktpris (kr)</Label>
            <Input id="shipping" type="number" min={0}
              value={(s.shippingOre / 100).toString()}
              onChange={(e) => setS({ ...s, shippingOre: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })} /></div>
          <div><Label htmlFor="free">Fri frakt från (kr)</Label>
            <Input id="free" type="number" min={0}
              value={(s.freeShippingThresholdOre / 100).toString()}
              onChange={(e) => setS({ ...s, freeShippingThresholdOre: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })} /></div>
          <div><Label htmlFor="dmin">Leveranstid min (dagar, tomt = ej beslutat)</Label>
            <Input id="dmin" inputMode="numeric" value={dMinText} placeholder="ej beslutat"
              onChange={(e) => setDMinText(e.target.value)} /></div>
          <div><Label htmlFor="dmax">Leveranstid max (dagar, tomt = ej beslutat)</Label>
            <Input id="dmax" inputMode="numeric" value={dMaxText} placeholder="ej beslutat"
              onChange={(e) => setDMaxText(e.target.value)} /></div>
        </div>
        {!shipDaysCheck.ok && <p className="text-xs text-destructive">{shipDaysCheck.error}</p>}
        <div><Label htmlFor="method">Leveransmetod</Label>
          <Input id="method" value={s.deliveryMethod}
            onChange={(e) => setS({ ...s, deliveryMethod: e.target.value })}
            placeholder="Beskriv hur du skickar (valfritt fraktbolag, upphämtning)" /></div>
        <div><Label htmlFor="delivery">Leveranstext (visas i butiken)</Label>
          <Textarea id="delivery" rows={2} value={s.deliveryText}
            onChange={(e) => setS({ ...s, deliveryText: e.target.value })}
            placeholder="Beskriv leveransen med dina egna ord." /></div>
        <div><Label htmlFor="support">Support-e-post</Label>
          <Input id="support" type="email" value={s.supportEmail}
            onChange={(e) => setS({ ...s, supportEmail: e.target.value })} />
          {s.supportEmail && !isValidEmail(s.supportEmail) && (
            <p className="text-xs text-destructive mt-1">Ogiltig e-postadress.</p>
          )}
        </div>
      </Card>

      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Undo2 className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Ångerrätt (lagkrav)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Digital ångerfunktion på <a className="underline text-primary" href="/butik/angra" target="_blank" rel="noreferrer">/butik/angra</a>{' '}
          krävs för publik butik och ska finnas kvar även om butiken stängs för nya köp –
          gamla kunders ångerfrist kan fortfarande löpa.
        </p>
        <div className="flex items-center justify-between rounded-xl border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Ångerfunktion aktiverad</p>
            <p className="text-xs text-muted-foreground">
              Formuläret på /butik/angra tar emot begäran. Ingen automatisk återbetalning.
            </p>
          </div>
          <Switch checked={s.withdrawalEnabled}
            onCheckedChange={(v) => setS({ ...s, withdrawalEnabled: v })}
            aria-label="Aktivera ångerfunktion" />
        </div>
      </Card>

      <Card className="p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="font-serif text-xl">Köpvillkor</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Öppna <a className="underline text-primary" href="/butik/villkor" target="_blank" rel="noreferrer">/butik/villkor</a>{' '}
          och kontrollera företagsuppgifter, ångerrätt och leveransuppgifter.
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
