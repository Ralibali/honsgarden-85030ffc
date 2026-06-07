import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import PlusFeatureGate from '@/components/PlusFeatureGate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ACCENT_PRESETS, BG_CLASS, DEFAULT_THEME, SECTION_LABELS,
  newSection, normalizeSections, normalizeTheme,
  type SaleSection, type SaleSectionType, type SaleTheme, type ThemeBackground, type ThemeHeader,
} from '@/lib/eggSaleTheme';
import { ArrowLeft, ArrowUp, ArrowDown, ExternalLink, Eye, Image as ImageIcon, Loader2, Palette, Plus, Save, Trash2, Upload, X } from 'lucide-react';

type Listing = any;

async function uploadImage(file: File, prefix = 'theme'): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Bilden får vara max 5 MB.');
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('Du måste vara inloggad.');
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${uid}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from('egg-sale-images').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('egg-sale-images').getPublicUrl(path);
  return pub.publicUrl;
}

export default function EggSaleCustomize() {
  return (
    <PlusFeatureGate
      title="Designa din säljsida"
      description="Plus-medlemmar kan färgsätta sin Agda-säljsida, byta header och lägga till egna sektioner som 'Om gården', galleri och FAQ."
      featureName="Säljsidans designstudio"
      benefits={[
        'Egen accentfärg, bakgrund och logo',
        'Hero-bild eller minimalistisk header',
        'Sektioner: Om mig, galleri, FAQ, höns, video',
        'Sparas direkt – syns publikt på /s/[länk]',
      ]}
    >
      <Editor />
    </PlusFeatureGate>
  );
}

function Editor() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<SaleTheme>(DEFAULT_THEME);
  const [sections, setSections] = useState<SaleSection[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ['agda-customize-listings'],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Inte inloggad');
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('*')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Välj första listan automatiskt
  useEffect(() => {
    if (!selectedId && listings.length > 0) setSelectedId(listings[0].id);
  }, [listings, selectedId]);

  const current = useMemo(() => listings.find((l) => l.id === selectedId) || null, [listings, selectedId]);

  // Ladda tema/sektioner när listing byts
  useEffect(() => {
    if (!current) return;
    setTheme(normalizeTheme(current.theme));
    setSections(normalizeSections(current.sections));
  }, [current?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error('Ingen säljsida vald');
      const { error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .update({ theme, sections })
        .eq('id', current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sparat ✨', description: 'Din säljsida är uppdaterad.' });
      qc.invalidateQueries({ queryKey: ['agda-customize-listings'] });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const handleUpload = async (file: File | null, target: 'cover' | 'logo' | `section-${number}-image` | `section-${number}-gallery`) => {
    if (!file) return;
    setUploadingKey(target);
    try {
      const url = await uploadImage(file, target);
      if (target === 'cover') setTheme((t) => ({ ...t, coverUrl: url }));
      else if (target === 'logo') setTheme((t) => ({ ...t, logoUrl: url }));
      else if (target.startsWith('section-')) {
        const [, idxStr, kind] = target.split('-');
        const idx = Number(idxStr);
        setSections((arr) => arr.map((s, i) => {
          if (i !== idx) return s;
          if (kind === 'image' && (s.type === 'about' || s.type === 'hens')) return { ...s, image: url };
          if (kind === 'gallery' && s.type === 'gallery') return { ...s, images: [...(s.images || []), url] };
          return s;
        }));
      }
    } catch (e: any) {
      toast({ title: 'Kunde inte ladda upp', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingKey(null);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (listings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card><CardContent className="p-6 text-center space-y-3">
          <Palette className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="font-serif text-2xl">Inga säljsidor att designa ännu</h1>
          <p className="text-sm text-muted-foreground">Skapa en säljsida i Agdas bod, så kan du anpassa den här.</p>
          <Button onClick={() => navigate('/app/egg-sales')}>Till Agdas bod</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button variant="ghost" size="sm" className="gap-1 mb-1" onClick={() => navigate('/app/egg-sales')}><ArrowLeft className="h-4 w-4" /> Tillbaka</Button>
          <h1 className="font-serif text-3xl">Designa säljsidan</h1>
          <p className="text-sm text-muted-foreground">Anpassa färg, header och egna sektioner. Ändringar syns direkt på den publika sidan när du sparar.</p>
        </div>
        <div className="flex gap-2">
          {current?.slug && (
            <Button variant="outline" className="gap-2" onClick={() => window.open(`/s/${current.slug}`, '_blank')}>
              <Eye className="h-4 w-4" /> Förhandsgranska
            </Button>
          )}
          <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !current}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara
          </Button>
        </div>
      </div>

      {listings.length > 1 && (
        <Card><CardContent className="p-3 flex flex-wrap gap-2">
          {listings.map((l) => (
            <Button key={l.id} size="sm" variant={l.id === selectedId ? 'default' : 'outline'} onClick={() => setSelectedId(l.id)}>{l.title || 'Säljsida'}</Button>
          ))}
        </CardContent></Card>
      )}

      {/* TEMA */}
      <Card>
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl">Tema</h2>
          </div>

          {/* Färg */}
          <div className="space-y-2">
            <Label>Accentfärg</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((p) => (
                <button key={p.hex} type="button" onClick={() => setTheme((t) => ({ ...t, accent: p.hex }))}
                  className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${theme.accent === p.hex ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}
                  style={{ backgroundColor: p.hex, borderColor: p.hex }} title={p.label} />
              ))}
              <label className="h-9 w-9 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer">
                <input type="color" value={theme.accent || '#3A6B35'} onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))} className="opacity-0 absolute w-9 h-9" />
                <Plus className="h-4 w-4 text-muted-foreground" />
              </label>
            </div>
          </div>

          {/* Bakgrund */}
          <div className="space-y-2">
            <Label>Bakgrund</Label>
            <div className="grid grid-cols-5 gap-2">
              {(['cream','light','warm','forest','dark'] as ThemeBackground[]).map((b) => (
                <button key={b} type="button" onClick={() => setTheme((t) => ({ ...t, bg: b }))}
                  className={`h-16 rounded-xl border-2 ${theme.bg === b ? 'ring-2 ring-offset-2 ring-foreground' : ''} ${BG_CLASS[b]}`}>
                  <span className={`text-xs font-medium ${b === 'dark' ? 'text-white' : 'text-foreground'}`}>{b}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Header-stil */}
          <div className="space-y-2">
            <Label>Header</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['classic','hero','minimal'] as ThemeHeader[]).map((h) => (
                <button key={h} type="button" onClick={() => setTheme((t) => ({ ...t, headerStyle: h }))}
                  className={`p-3 rounded-xl border-2 text-left ${theme.headerStyle === h ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <p className="text-sm font-medium capitalize">{h === 'classic' ? 'Klassisk' : h === 'hero' ? 'Hero-bild' : 'Minimal'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{h === 'classic' ? 'Bild + badges centrerat' : h === 'hero' ? 'Stor bild med text över' : 'Bara rubrik + text'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Texter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Egen rubrik (valfritt)</Label>
              <Input value={theme.headline || ''} onChange={(e) => setTheme((t) => ({ ...t, headline: e.target.value }))} placeholder={current?.title || 'Färska ägg till salu'} />
            </div>
            <div className="space-y-2">
              <Label>Tagline (valfritt)</Label>
              <Input value={theme.tagline || ''} onChange={(e) => setTheme((t) => ({ ...t, tagline: e.target.value }))} placeholder={current?.description?.slice(0, 60) || 'Färska ägg från lokal hönsgård'} />
            </div>
          </div>

          {/* Bilder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ImageField label="Omslagsbild (ersätter befintlig)" value={theme.coverUrl} onClear={() => setTheme((t) => ({ ...t, coverUrl: '' }))} onPick={(f) => handleUpload(f, 'cover')} loading={uploadingKey === 'cover'} aspect="aspect-video" />
            <ImageField label="Logo (valfritt)" value={theme.logoUrl} onClear={() => setTheme((t) => ({ ...t, logoUrl: '' }))} onPick={(f) => handleUpload(f, 'logo')} loading={uploadingKey === 'logo'} aspect="aspect-square max-w-[140px]" />
          </div>
        </CardContent>
      </Card>

      {/* SEKTIONER */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-serif text-xl">Sektioner</h2>
              <p className="text-sm text-muted-foreground">Lägg till valfria block som visas under prislista och bokning.</p>
            </div>
            <Badge variant="secondary">{sections.length} st</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(SECTION_LABELS) as SaleSectionType[]).map((t) => (
              <Button key={t} size="sm" variant="outline" className="gap-1" onClick={() => setSections((arr) => [...arr, newSection(t)])}>
                <Plus className="h-3.5 w-3.5" /> {SECTION_LABELS[t]}
              </Button>
            ))}
          </div>

          {sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Inga sektioner ännu. Klicka på knapparna ovan för att lägga till.
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((s, idx) => (
                <Card key={s.id} className="border-primary/15">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{SECTION_LABELS[s.type]}</Badge>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => setSections((a) => { const c = [...a]; [c[idx-1], c[idx]] = [c[idx], c[idx-1]]; return c; })}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={idx === sections.length-1} onClick={() => setSections((a) => { const c = [...a]; [c[idx+1], c[idx]] = [c[idx], c[idx+1]]; return c; })}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setSections((a) => a.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {/* Titel-fält gemensamt */}
                    {'title' in s && (
                      <Input placeholder="Rubrik (valfritt)" value={s.title || ''} onChange={(e) => setSections((a) => a.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))} />
                    )}

                    {(s.type === 'about' || s.type === 'hens' || s.type === 'rich_text') && (
                      <Textarea rows={4} placeholder="Skriv din text här..." value={(s as any).body} onChange={(e) => setSections((a) => a.map((x, i) => i === idx ? { ...(x as any), body: e.target.value } : x))} />
                    )}

                    {(s.type === 'about' || s.type === 'hens') && (
                      <ImageField label="Bild (valfritt)" value={(s as any).image} onClear={() => setSections((a) => a.map((x, i) => i === idx ? { ...(x as any), image: '' } : x))} onPick={(f) => handleUpload(f, `section-${idx}-image`)} loading={uploadingKey === `section-${idx}-image`} aspect="aspect-video" />
                    )}

                    {s.type === 'highlight' && (
                      <>
                        <Textarea rows={2} value={s.body} onChange={(e) => setSections((a) => a.map((x, i) => i === idx ? { ...(x as any), body: e.target.value } : x))} />
                        <div className="flex flex-wrap gap-2">
                          {(['sparkles','leaf','heart','sun','shield'] as const).map((ic) => (
                            <button key={ic} type="button" onClick={() => setSections((a) => a.map((x, i) => i === idx ? { ...(x as any), icon: ic } : x))}
                              className={`px-3 py-1.5 rounded-full text-xs border ${s.icon === ic ? 'bg-primary text-primary-foreground border-primary' : 'bg-card'}`}>
                              {ic}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {s.type === 'gallery' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {(s.images || []).map((src, i) => (
                            <div key={i} className="relative aspect-square rounded-xl border overflow-hidden bg-muted">
                              <img src={src} alt="" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setSections((a) => a.map((x, j) => j === idx ? { ...(x as any), images: (x as any).images.filter((_: any, k: number) => k !== i) } : x))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="h-3 w-3" /></button>
                            </div>
                          ))}
                          <label className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/50">
                            {uploadingKey === `section-${idx}-gallery` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mb-1" /> Lägg till</>}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0] || null, `section-${idx}-gallery`)} />
                          </label>
                        </div>
                      </div>
                    )}

                    {s.type === 'faq' && (
                      <div className="space-y-2">
                        {s.items.map((it, i) => (
                          <div key={i} className="rounded-xl border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-xs">Fråga {i+1}</Label>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setSections((a) => a.map((x, j) => j === idx ? { ...(x as any), items: (x as any).items.filter((_: any, k: number) => k !== i) } : x))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                            <Input placeholder="Frågan" value={it.q} onChange={(e) => setSections((a) => a.map((x, j) => j === idx ? { ...(x as any), items: (x as any).items.map((y: any, k: number) => k === i ? { ...y, q: e.target.value } : y) } : x))} />
                            <Textarea rows={2} placeholder="Svaret" value={it.a} onChange={(e) => setSections((a) => a.map((x, j) => j === idx ? { ...(x as any), items: (x as any).items.map((y: any, k: number) => k === i ? { ...y, a: e.target.value } : y) } : x))} />
                          </div>
                        ))}
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setSections((a) => a.map((x, j) => j === idx ? { ...(x as any), items: [...(x as any).items, { q: '', a: '' }] } : x))}>
                          <Plus className="h-3.5 w-3.5" /> Lägg till fråga
                        </Button>
                      </div>
                    )}

                    {s.type === 'video' && (
                      <Input placeholder="YouTube- eller Vimeo-länk" value={s.url} onChange={(e) => setSections((a) => a.map((x, j) => j === idx ? { ...(x as any), url: e.target.value } : x))} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <p className="text-xs text-muted-foreground">Glöm inte att spara dina ändringar.</p>
        <div className="flex gap-2">
          {current?.slug && (
            <Button variant="outline" className="gap-2" onClick={() => window.open(`/s/${current.slug}`, '_blank')}>
              <ExternalLink className="h-4 w-4" /> Öppna publik sida
            </Button>
          )}
          <Button className="gap-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !current}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara ändringar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageField({ label, value, onPick, onClear, loading, aspect = 'aspect-video' }: { label: string; value?: string; onPick: (f: File | null) => void; onClear: () => void; loading?: boolean; aspect?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className={`relative overflow-hidden rounded-xl border bg-muted ${aspect}`}>
          <img src={value} alt="" className="w-full h-full object-cover" />
          <Button size="icon" variant="secondary" className="absolute top-2 right-2 h-7 w-7" onClick={onClear}><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <label className={`block ${aspect} rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/30 text-sm text-muted-foreground`}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center gap-1"><ImageIcon className="h-5 w-5" /> Ladda upp bild</span>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
        </label>
      )}
    </div>
  );
}
