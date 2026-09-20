import { useEffect, useMemo, useState } from 'react';
import { Database, Loader2, RefreshCw, Save, Search, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RiskClass =
  | 'unknown'
  | 'fri_zon'
  | 'biocid_registrering_kravs'
  | 'apoteksvara'
  | 'veterinar_hanvisning';

type Profile = {
  id: string;
  source_type: 'affiliate' | 'own';
  product_id: string;
  risk_class: RiskClass;
  biocide_registration_verified: boolean;
  regulatory_note: string | null;
  capacity_hens_min: number | null;
  capacity_hens_max: number | null;
  package_size_kg: number | null;
  capacity_liters: number | null;
  floor_area_m2: number | null;
  material: string | null;
  power_source: string | null;
  control_modes: string[];
  winter_rated: boolean | null;
  frost_resistant: boolean | null;
  predator_protection_level: string | null;
  life_stages: string[];
  use_cases: string[];
  season_months: number[];
  recommendation_priority: number;
  test_status: string;
  evidence_source: string | null;
  last_verified_at: string | null;
};

type ProductLabel = {
  id: string;
  name: string;
  category: string | null;
};

const inputClass =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary/50';

const splitList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const numberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export default function CommerceProfileManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [labels, setLabels] = useState<Map<string, ProductLabel>>(new Map());
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskClass>('unknown');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'affiliate' | 'own'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<Profile | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage('');
    const db = supabase as any;
    const [profileRes, affiliateRes, ownRes] = await Promise.all([
      db.from('product_commerce_profiles').select('*').order('updated_at', { ascending: false }),
      db.from('affiliate_products').select('id,name,category').limit(1000),
      db.from('shop_products').select('id,name,category').limit(250),
    ]);

    const error = profileRes.error || affiliateRes.error || ownRes.error;
    if (error) {
      setMessage(error.message || 'Kunde inte läsa Commerce-profiler.');
      setLoading(false);
      return;
    }

    const nextProfiles = (profileRes.data ?? []) as Profile[];
    const nextLabels = new Map<string, ProductLabel>();
    for (const product of affiliateRes.data ?? []) {
      nextLabels.set('affiliate:' + product.id, product);
    }
    for (const product of ownRes.data ?? []) {
      nextLabels.set('own:' + product.id, product);
    }

    setProfiles(nextProfiles);
    setLabels(nextLabels);
    setSelectedId((current) => current || nextProfiles[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
  }, [selected]);

  const counts = useMemo(() => {
    const result = {
      total: profiles.length,
      unknown: 0,
      free: 0,
      biocide: 0,
      blocked: 0,
    };
    for (const profile of profiles) {
      if (profile.risk_class === 'unknown') result.unknown++;
      else if (profile.risk_class === 'fri_zon') result.free++;
      else if (profile.risk_class === 'biocid_registrering_kravs') result.biocide++;
      else result.blocked++;
    }
    return result;
  }, [profiles]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('sv-SE');
    return profiles.filter((profile) => {
      if (riskFilter !== 'all' && profile.risk_class !== riskFilter) return false;
      if (sourceFilter !== 'all' && profile.source_type !== sourceFilter) return false;
      if (!needle) return true;
      const product = labels.get(profile.source_type + ':' + profile.product_id);
      return [product?.name ?? '', product?.category ?? '', profile.evidence_source ?? '']
        .join(' ')
        .toLocaleLowerCase('sv-SE')
        .includes(needle);
    });
  }, [profiles, labels, search, riskFilter, sourceFilter]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setMessage('');
    const db = supabase as any;
    const { error } = await db
      .from('product_commerce_profiles')
      .update({
        risk_class: draft.risk_class,
        biocide_registration_verified: draft.biocide_registration_verified,
        regulatory_note: draft.regulatory_note || null,
        capacity_hens_min: draft.capacity_hens_min,
        capacity_hens_max: draft.capacity_hens_max,
        package_size_kg: draft.package_size_kg,
        capacity_liters: draft.capacity_liters,
        floor_area_m2: draft.floor_area_m2,
        material: draft.material || null,
        power_source: draft.power_source || null,
        control_modes: draft.control_modes,
        winter_rated: draft.winter_rated,
        frost_resistant: draft.frost_resistant,
        predator_protection_level: draft.predator_protection_level || null,
        life_stages: draft.life_stages,
        use_cases: draft.use_cases,
        season_months: draft.season_months,
        recommendation_priority: draft.recommendation_priority,
        test_status: draft.test_status,
        evidence_source: draft.evidence_source || null,
        last_verified_at: new Date().toISOString(),
      })
      .eq('id', draft.id);

    if (error) {
      setMessage(error.message || 'Kunde inte spara.');
      setSaving(false);
      return;
    }

    setMessage('Sparat och verifieringsdatum uppdaterat.');
    setProfiles((current) =>
      current.map((profile) =>
        profile.id === draft.id
          ? { ...draft, last_verified_at: new Date().toISOString() }
          : profile,
      ),
    );
    setSaving(false);
  };

  const selectedLabel = draft
    ? labels.get(draft.source_type + ':' + draft.product_id)
    : null;

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="font-serif text-xl">Commerce Schema v2</CardTitle>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Granska riskklass och fyll domänfält som flockkapacitet, vintertålighet,
              styrning och säsong. Commerce Agent använder bara policygodkända profiler.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} />
            Uppdatera
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="Totalt" value={counts.total} />
          <Metric label="Fri zon" value={counts.free} />
          <Metric label="Okända" value={counts.unknown} attention={counts.unknown > 0} />
          <Metric label="Biocid" value={counts.biocide} />
          <Metric label="Blockerade" value={counts.blocked} />
        </div>

        {message ? (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {message}
          </p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Sök produkt eller kategori"
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                className={inputClass}
                value={riskFilter}
                onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}
              >
                <option value="all">Alla riskklasser</option>
                <option value="unknown">Okänd</option>
                <option value="fri_zon">Fri zon</option>
                <option value="biocid_registrering_kravs">Biocidkontroll</option>
                <option value="apoteksvara">Apoteksvara</option>
                <option value="veterinar_hanvisning">Veterinär</option>
              </select>
              <select
                className={inputClass}
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
              >
                <option value="all">Alla källor</option>
                <option value="affiliate">Affiliate</option>
                <option value="own">Egen butik</option>
              </select>
            </div>

            <div className="max-h-[580px] space-y-1.5 overflow-auto rounded-xl border border-border p-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Läser profiler
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-10 text-center text-xs text-muted-foreground">Inga träffar.</p>
              ) : (
                filtered.map((profile) => {
                  const label = labels.get(profile.source_type + ':' + profile.product_id);
                  return (
                    <button
                      type="button"
                      key={profile.id}
                      onClick={() => setSelectedId(profile.id)}
                      className={
                        'w-full rounded-lg border px-3 py-2 text-left transition ' +
                        (selectedId === profile.id
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-transparent hover:bg-muted/40')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold">{label?.name ?? profile.product_id}</span>
                        <RiskBadge risk={profile.risk_class} />
                      </div>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        {profile.source_type === 'own' ? 'Egen butik' : 'Affiliate'}
                        {label?.category ? ' · ' + label.category : ''}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {!draft ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Välj en produktprofil.</p>
            </div>
          ) : (
            <div className="space-y-5 rounded-xl border border-border p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-serif text-lg">{selectedLabel?.name ?? draft.product_id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {draft.source_type} · {selectedLabel?.category ?? 'okänd kategori'} · {draft.product_id}
                  </p>
                </div>
                <RiskBadge risk={draft.risk_class} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Riskklass">
                  <select
                    className={inputClass}
                    value={draft.risk_class}
                    onChange={(event) =>
                      setDraft({ ...draft, risk_class: event.target.value as RiskClass })
                    }
                  >
                    <option value="unknown">Okänd – blockera</option>
                    <option value="fri_zon">Fri zon</option>
                    <option value="biocid_registrering_kravs">Biocid – verifiering krävs</option>
                    <option value="apoteksvara">Apoteksvara – ingen affiliate</option>
                    <option value="veterinar_hanvisning">Veterinärhänvisning</option>
                  </select>
                </Field>

                <NumberField
                  label="Min höns"
                  value={draft.capacity_hens_min}
                  onChange={(value) => setDraft({ ...draft, capacity_hens_min: value })}
                />
                <NumberField
                  label="Max höns"
                  value={draft.capacity_hens_max}
                  onChange={(value) => setDraft({ ...draft, capacity_hens_max: value })}
                />
                <NumberField
                  label="Förpackning kg"
                  value={draft.package_size_kg}
                  step="0.1"
                  onChange={(value) => setDraft({ ...draft, package_size_kg: value })}
                />
                <NumberField
                  label="Kapacitet liter"
                  value={draft.capacity_liters}
                  step="0.1"
                  onChange={(value) => setDraft({ ...draft, capacity_liters: value })}
                />
                <NumberField
                  label="Golvarea m²"
                  value={draft.floor_area_m2}
                  step="0.01"
                  onChange={(value) => setDraft({ ...draft, floor_area_m2: value })}
                />

                <Field label="Strömkälla">
                  <select
                    className={inputClass}
                    value={draft.power_source ?? ''}
                    onChange={(event) => setDraft({ ...draft, power_source: event.target.value || null })}
                  >
                    <option value="">Okänd / ej relevant</option>
                    <option value="battery">Batteri</option>
                    <option value="mains_230v">230 V</option>
                    <option value="solar">Solcell</option>
                    <option value="manual">Manuell</option>
                    <option value="other">Annan</option>
                  </select>
                </Field>

                <Field label="Rovdjursskydd">
                  <select
                    className={inputClass}
                    value={draft.predator_protection_level ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, predator_protection_level: event.target.value || null })
                    }
                  >
                    <option value="">Okänt / ej relevant</option>
                    <option value="none">Ingen</option>
                    <option value="partial">Delvis</option>
                    <option value="high">Hög</option>
                  </select>
                </Field>

                <Field label="Teststatus">
                  <select
                    className={inputClass}
                    value={draft.test_status}
                    onChange={(event) => setDraft({ ...draft, test_status: event.target.value })}
                  >
                    <option value="unverified">Ej verifierad</option>
                    <option value="partner_data">Partnerdata</option>
                    <option value="forum_consensus">Forumkonsensus</option>
                    <option value="tested_by_us">Testad av oss</option>
                  </select>
                </Field>

                <Field label="Prioritet 1–5">
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={draft.recommendation_priority}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        recommendation_priority: Math.min(5, Math.max(1, Number(event.target.value) || 1)),
                      })
                    }
                    className="h-9 text-xs"
                  />
                </Field>

                <Field label="Material">
                  <Input
                    value={draft.material ?? ''}
                    onChange={(event) => setDraft({ ...draft, material: event.target.value || null })}
                    className="h-9 text-xs"
                  />
                </Field>

                <Field label="Styrning, kommaseparerat">
                  <Input
                    value={draft.control_modes.join(', ')}
                    onChange={(event) =>
                      setDraft({ ...draft, control_modes: splitList(event.target.value) })
                    }
                    placeholder="timer, light_sensor"
                    className="h-9 text-xs"
                  />
                </Field>

                <Field label="Use cases">
                  <Input
                    value={draft.use_cases.join(', ')}
                    onChange={(event) => setDraft({ ...draft, use_cases: splitList(event.target.value) })}
                    placeholder="housing, feeding"
                    className="h-9 text-xs"
                  />
                </Field>

                <Field label="Livsfaser">
                  <Input
                    value={draft.life_stages.join(', ')}
                    onChange={(event) => setDraft({ ...draft, life_stages: splitList(event.target.value) })}
                    placeholder="chick, pullet, laying"
                    className="h-9 text-xs"
                  />
                </Field>

                <Field label="Säsongsmånader 1–12">
                  <Input
                    value={draft.season_months.join(', ')}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        season_months: splitList(event.target.value)
                          .map(Number)
                          .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
                      })
                    }
                    placeholder="3, 4, 5"
                    className="h-9 text-xs"
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Toggle
                  label="Vinterklassad"
                  value={draft.winter_rated}
                  onChange={(value) => setDraft({ ...draft, winter_rated: value })}
                />
                <Toggle
                  label="Frosttålig"
                  value={draft.frost_resistant}
                  onChange={(value) => setDraft({ ...draft, frost_resistant: value })}
                />
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.biocide_registration_verified}
                    onChange={(event) =>
                      setDraft({ ...draft, biocide_registration_verified: event.target.checked })
                    }
                  />
                  Biocidregistrering verifierad
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Evidenskälla">
                  <Input
                    value={draft.evidence_source ?? ''}
                    onChange={(event) => setDraft({ ...draft, evidence_source: event.target.value || null })}
                    placeholder="Tillverkardata, egen test..."
                    className="h-9 text-xs"
                  />
                </Field>
                <Field label="Regulatorisk notering">
                  <Input
                    value={draft.regulatory_note ?? ''}
                    onChange={(event) => setDraft({ ...draft, regulatory_note: event.target.value || null })}
                    className="h-9 text-xs"
                  />
                </Field>
              </div>

              {draft.risk_class !== 'fri_zon' ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Den här riskklassen är fail-closed i Commerce Agent. Biocidklassen öppnas bara
                    när verifieringsrutan ovan är markerad.
                  </span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button className="gap-2" onClick={() => void save()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Spara profil
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Senast verifierad:{' '}
                  {draft.last_verified_at
                    ? new Date(draft.last_verified_at).toLocaleString('sv-SE')
                    : 'aldrig'}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className={'rounded-xl border p-3 ' + (attention ? 'border-amber-200 bg-amber-50' : 'border-border bg-muted/20')}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskClass }) {
  const meta: Record<RiskClass, { label: string; cls: string }> = {
    unknown: { label: 'Okänd', cls: 'bg-amber-100 text-amber-800' },
    fri_zon: { label: 'Fri zon', cls: 'bg-emerald-100 text-emerald-800' },
    biocid_registrering_kravs: { label: 'Biocid', cls: 'bg-orange-100 text-orange-800' },
    apoteksvara: { label: 'Apotek', cls: 'bg-rose-100 text-rose-800' },
    veterinar_hanvisning: { label: 'Veterinär', cls: 'bg-red-100 text-red-800' },
  };
  const item = meta[risk];
  return (
    <span className={'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ' + item.cls}>
      {item.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = '1',
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        step={step}
        value={value ?? ''}
        onChange={(event) => onChange(numberOrNull(event.target.value))}
        className="h-9 text-xs"
      />
    </Field>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <label className="rounded-lg border border-border px-3 py-2 text-xs">
      <span className="block text-[10px] text-muted-foreground">{label}</span>
      <select
        className="mt-1 w-full bg-transparent text-xs outline-none"
        value={value == null ? '' : value ? 'true' : 'false'}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : event.target.value === 'true')
        }
      >
        <option value="">Okänt</option>
        <option value="true">Ja</option>
        <option value="false">Nej</option>
      </select>
    </label>
  );
}
