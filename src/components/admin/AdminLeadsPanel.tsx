import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2, Search, Save, ExternalLink, Mail, Phone, Copy, Trash2, Download,
  ShieldAlert, AlertCircle, PenLine, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LEAD_STATUSES, leadsToCsv, generatePersonalDraft, statusLabel,
  type SalesLead, type LeadStatus,
} from '@/lib/salesLeads';

interface SearchResult {
  name: string;
  business_type: string;
  website: string | null;
  website_domain: string | null;
  public_email: string | null;
  public_phone: string | null;
  city: string | null;
  region: string | null;
  social_urls: Record<string, string>;
  source_url: string;
  source_title: string;
  source_description: string;
  relevance_score: number;
  found_at: string;
  already_saved?: boolean;
}

const LEAD_TYPES = [
  { value: 'generisk', label: 'Alla typer' },
  { value: 'hönsgård', label: 'Hönsgård' },
  { value: 'gårdsbutik', label: 'Gårdsbutik' },
  { value: 'äggproducent', label: 'Äggproducent' },
  { value: 'reko', label: 'REKO-ring' },
] as const;

const LIMIT_OPTIONS = [5, 10, 20] as const;

function copyToClipboard(text: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return Promise.reject(new Error('no clipboard'));
  return navigator.clipboard.writeText(text);
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminLeadsPanel() {
  const qc = useQueryClient();

  // Sökpanel
  const [city, setCity] = useState('');
  const [leadType, setLeadType] = useState<string>('generisk');
  const [customQuery, setCustomQuery] = useState('');
  const [limit, setLimit] = useState<number>(10);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [configError, setConfigError] = useState(false);

  // Filter/sort på sparade
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [textFilter, setTextFilter] = useState('');
  const [sortKey, setSortKey] = useState<'created_at' | 'relevance_score' | 'name'>('created_at');

  // Utkast-dialog
  const [draftLead, setDraftLead] = useState<SalesLead | null>(null);
  const [draftText, setDraftText] = useState('');

  const { data: savedLeads = [], isLoading: loadingSaved } = useQuery({
    queryKey: ['sales-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SalesLead[];
    },
  });

  const filteredSorted = useMemo(() => {
    const q = textFilter.trim().toLowerCase();
    const filtered = savedLeads.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return [l.name, l.city, l.public_email, l.website_domain, l.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'relevance_score') return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'sv');
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
    });
    return sorted;
  }, [savedLeads, statusFilter, textFilter, sortKey]);

  const runSearch = async () => {
    setSearching(true);
    setResults([]);
    setConfigError(false);
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-lead-search', {
        body: {
          city: city.trim() || undefined,
          lead_type: leadType,
          custom_query: customQuery.trim() || undefined,
          limit,
        },
      });
      if (error) {
        // Läs riktigt fel från edge function
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          const text = await ctx.text().catch(() => '');
          if (ctx.status === 503 || text.includes('config_missing')) {
            setConfigError(true);
            return;
          }
        }
        throw error;
      }
      if (data?.error === 'config_missing') {
        setConfigError(true);
        return;
      }
      const leads = (data?.leads ?? []) as SearchResult[];
      setResults(leads);
      toast({
        title: `Hittade ${leads.length} leads`,
        description: leads.length === 0 ? 'Prova en annan stad, typ eller sökfras.' : undefined,
      });
    } catch (e) {
      toast({
        title: 'Sökning misslyckades',
        description: e instanceof Error ? e.message : 'Okänt fel',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const saveLead = async (lead: SearchResult, idx: number) => {
    setSavingIdx(idx);
    try {
      const { error } = await supabase.from('sales_leads').insert({
        name: lead.name,
        business_type: lead.business_type,
        website: lead.website,
        website_domain: lead.website_domain,
        public_email: lead.public_email,
        public_phone: lead.public_phone,
        city: lead.city,
        region: lead.region,
        social_urls: lead.social_urls,
        source_url: lead.source_url,
        source_title: lead.source_title,
        source_description: lead.source_description,
        relevance_score: lead.relevance_score,
        status: 'new',
      });
      if (error) throw error;
      setResults((prev) => prev.map((l, i) => (i === idx ? { ...l, already_saved: true } : l)));
      qc.invalidateQueries({ queryKey: ['sales-leads'] });
      toast({ title: 'Lead sparad' });
    } catch (e) {
      toast({
        title: 'Kunde inte spara',
        description: e instanceof Error ? e.message : 'Okänt fel',
        variant: 'destructive',
      });
    } finally {
      setSavingIdx(null);
    }
  };

  const updateLead = async (id: string, patch: Partial<SalesLead>) => {
    const { error } = await supabase.from('sales_leads').update(patch as never).eq('id', id);
    if (error) {
      toast({ title: 'Kunde inte spara', description: error.message, variant: 'destructive' });
      return;
    }
    qc.invalidateQueries({ queryKey: ['sales-leads'] });
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from('sales_leads').delete().eq('id', id);
    if (error) {
      toast({ title: 'Kunde inte radera', description: error.message, variant: 'destructive' });
      return;
    }
    qc.invalidateQueries({ queryKey: ['sales-leads'] });
    toast({ title: 'Lead raderad' });
  };

  const openDraft = (lead: SalesLead) => {
    setDraftLead(lead);
    setDraftText(generatePersonalDraft(lead, { productName: 'Hönsgården', productUrl: 'https://honsgarden.se' }));
  };

  return (
    <div className="space-y-4">
      {/* Integritetsnotis */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-start gap-2 text-xs">
          <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground m-0">Integritet & GDPR</p>
            <p className="text-muted-foreground m-0 mt-0.5">
              Endast <strong>publikt tillgängliga</strong> uppgifter från verksamheters webbplatser sparas – aldrig gissade
              e-postadresser. Ingen massmail skickas. Utkast genereras lokalt och måste skickas manuellt.
              Respektera "Kontakta inte"-flaggan och radera leads på begäran.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sökpanel */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Stad (t.ex. Uppsala)" value={city} onChange={(e) => setCity(e.target.value)} />
            <Select value={leadType} onValueChange={setLeadType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n} träffar</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={runSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Sök leads
            </Button>
          </div>
          <Input
            placeholder="Egen sökfras (valfritt) – t.ex. 'säljer ägg småland'"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {configError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium m-0">Konfigurationsfel</p>
              <p className="m-0 mt-0.5">
                FIRECRAWL_API_KEY saknas i backend. Lägg till nyckeln i Project Settings → Secrets innan sökning kan köras.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sökresultat */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Nya träffar ({results.length})</h3>
          {results.map((lead, idx) => (
            <Card key={idx} className="border-border/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.website_domain}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">Score {lead.relevance_score}</Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{lead.source_description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {lead.public_email && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Mail className="h-3 w-3" />{lead.public_email}
                    </span>
                  )}
                  {lead.public_phone && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Phone className="h-3 w-3" />{lead.public_phone}
                    </span>
                  )}
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                      <ExternalLink className="h-3 w-3" />Öppna
                    </a>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant={lead.already_saved ? 'secondary' : 'default'}
                    disabled={lead.already_saved || savingIdx === idx}
                    onClick={() => saveLead(lead, idx)}
                  >
                    {savingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                    {lead.already_saved ? 'Sparad' : 'Spara'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sparade leads */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium m-0">Sparade leads ({filteredSorted.length})</h3>
            <Button
              variant="outline"
              size="sm"
              disabled={filteredSorted.length === 0}
              onClick={() => downloadCsv(`sales_leads_${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(filteredSorted))}
            >
              <Download className="h-3 w-3 mr-1" /> Exportera CSV
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Sök namn / e-post / stad" value={textFilter} onChange={(e) => setTextFilter(e.target.value)} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Nyast först</SelectItem>
                <SelectItem value="relevance_score">Högst score först</SelectItem>
                <SelectItem value="name">Namn A–Ö</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingSaved ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filteredSorted.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Inga sparade leads matchar filtret.</p>
          ) : (
            <div className="space-y-2">
              {filteredSorted.map((lead) => (
                <Card key={lead.id} className={`border-border/50 ${lead.do_not_contact ? 'opacity-70' : ''}`}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate m-0">{lead.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate m-0">
                          {[lead.city, lead.website_domain].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{statusLabel(lead.status)}</Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {lead.public_email && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          onClick={() => copyToClipboard(lead.public_email!).then(
                            () => toast({ title: 'E-post kopierad' }),
                            () => toast({ title: 'Kunde inte kopiera', variant: 'destructive' }),
                          )}
                          title="Kopiera e-post"
                        >
                          <Copy className="h-3 w-3" /> {lead.public_email}
                        </button>
                      )}
                      {lead.public_phone && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />{lead.public_phone}
                        </span>
                      )}
                      {lead.source_url && (
                        <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-3 w-3" /> Källa
                        </a>
                      )}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select value={lead.status} onValueChange={(v) => updateLead(lead.id, { status: v as LeadStatus })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={lead.do_not_contact}
                          onCheckedChange={(v) => updateLead(lead.id, { do_not_contact: !!v })}
                        />
                        Kontakta inte
                      </label>
                    </div>

                    <Textarea
                      placeholder="Anteckningar…"
                      defaultValue={lead.notes ?? ''}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (lead.notes ?? '')) updateLead(lead.id, { notes: val || null });
                      }}
                      className="text-xs min-h-16"
                    />

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={lead.do_not_contact} onClick={() => openDraft(lead)}>
                        <PenLine className="h-3 w-3 mr-1" /> Skapa personligt utkast
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3 mr-1" /> Radera
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Radera lead?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tar bort <strong>{lead.name}</strong> permanent. Detta kan inte ångras.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteLead(lead.id)}>Radera</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Utkast-dialog */}
      <Dialog open={!!draftLead} onOpenChange={(open) => { if (!open) setDraftLead(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Personligt utkast</DialogTitle>
            <DialogDescription className="flex items-start gap-2 text-xs">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Redigera texten och skicka manuellt via din vanliga e-postklient.
                Inget skickas automatiskt härifrån.
              </span>
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="min-h-64 font-mono text-xs"
          />
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(draftText).then(
                () => toast({ title: 'Kopierat till urklipp' }),
                () => toast({ title: 'Kunde inte kopiera', variant: 'destructive' }),
              )}
            >
              <Copy className="h-3 w-3 mr-1" /> Kopiera
            </Button>
            {draftLead?.public_email && (
              <Button
                onClick={() => {
                  const subjectMatch = draftText.match(/^Ämne:\s*(.+)$/m);
                  const subject = subjectMatch?.[1] ?? '';
                  const body = draftText.replace(/^Ämne:.*\n?/m, '').trim();
                  window.location.href = `mailto:${draftLead.public_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }}
              >
                <Mail className="h-3 w-3 mr-1" /> Öppna i e-postklient
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
