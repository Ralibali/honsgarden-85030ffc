import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, ExternalLink, Search, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Row = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

async function callGsc(payload: any) {
  const { data, error } = await supabase.functions.invoke('search-console', { body: payload });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

const fmt = (n: number) => n?.toLocaleString('sv-SE') ?? '0';
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pos = (n: number) => n?.toFixed(1) ?? '–';

export default function SearchConsoleReports() {
  const [days, setDays] = useState('28');
  const [site, setSite] = useState('https://www.honsgarden.se/');

  const overview = useQuery({
    queryKey: ['gsc-overview', days, site],
    queryFn: () => callGsc({ action: 'overview', days: Number(days), site }),
    retry: false,
  });

  const submitSitemap = useMutation({
    mutationFn: () => callGsc({ action: 'submit-sitemap', site }),
    onSuccess: () => {
      toast({ title: 'Sitemap skickad till Google ✅' });
      overview.refetch();
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const data = overview.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" /> Google Search Console
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Visar sökprestanda från Google för {site}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={site} onValueChange={setSite}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="https://www.honsgarden.se/">www.honsgarden.se</SelectItem>
                <SelectItem value="https://honsgarden.se/">honsgarden.se</SelectItem>
              </SelectContent>
            </Select>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dagar</SelectItem>
                <SelectItem value="28">28 dagar</SelectItem>
                <SelectItem value="90">90 dagar</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()} disabled={overview.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${overview.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overview.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Hämtar data från Google...</div>}
          {overview.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" /> Kunde inte hämta data</div>
              <div className="mt-1 text-xs opacity-80">{(overview.error as Error).message}</div>
            </div>
          )}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Klick" value={fmt(data.totals?.clicks ?? 0)} />
              <Stat label="Visningar" value={fmt(data.totals?.impressions ?? 0)} />
              <Stat label="CTR" value={pct(data.totals?.ctr ?? 0)} />
              <Stat label="Genomsn. pos." value={pos(data.totals?.position ?? 0)} />
            </div>
          )}
        </CardContent>
      </Card>

      {data && (
        <Tabs defaultValue="queries">
          <TabsList>
            <TabsTrigger value="queries">Sökord</TabsTrigger>
            <TabsTrigger value="pages">Sidor</TabsTrigger>
            <TabsTrigger value="sitemaps">Sitemaps</TabsTrigger>
            <TabsTrigger value="opportunities">Möjligheter</TabsTrigger>
          </TabsList>

          <TabsContent value="queries">
            <RowsTable rows={data.queries} keyLabel="Sökord" />
          </TabsContent>

          <TabsContent value="pages">
            <RowsTable rows={data.pages} keyLabel="Sida" isUrl />
          </TabsContent>

          <TabsContent value="sitemaps">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Sitemaps</CardTitle>
                <Button size="sm" onClick={() => submitSitemap.mutate()} disabled={submitSitemap.isPending}>
                  {submitSitemap.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Skicka sitemap.xml igen'}
                </Button>
              </CardHeader>
              <CardContent>
                {(!data.sitemaps || data.sitemaps.length === 0) ? (
                  <p className="text-sm text-muted-foreground">Inga sitemaps registrerade. Klicka på "Skicka sitemap.xml igen".</p>
                ) : (
                  <div className="space-y-2">
                    {data.sitemaps.map((sm: any) => (
                      <div key={sm.path} className="rounded-lg border p-3 text-sm flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs truncate">{sm.path}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                            <Badge variant="outline">Senast laddad: {sm.lastSubmitted?.slice(0, 10) ?? '–'}</Badge>
                            {sm.errors > 0 ? (
                              <Badge variant="destructive">{sm.errors} fel</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>
                            )}
                            {sm.warnings > 0 && <Badge variant="outline">{sm.warnings} varningar</Badge>}
                            <Badge variant="outline">{sm.contents?.[0]?.submitted ?? 0} URL:er</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opportunities">
            <OpportunityList queries={data.queries} pages={data.pages} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function RowsTable({ rows, keyLabel, isUrl }: { rows: Row[]; keyLabel: string; isUrl?: boolean }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-muted-foreground p-4">Ingen data för perioden.</p>;
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase">
            <tr>
              <th className="text-left p-2 font-medium">{keyLabel}</th>
              <th className="text-right p-2 font-medium">Klick</th>
              <th className="text-right p-2 font-medium">Visn.</th>
              <th className="text-right p-2 font-medium">CTR</th>
              <th className="text-right p-2 font-medium">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const k = r.keys?.[0] ?? '';
              return (
                <tr key={i} className="border-t hover:bg-muted/20">
                  <td className="p-2 max-w-[420px] truncate">
                    {isUrl ? (
                      <a href={k} target="_blank" rel="noopener" className="text-primary hover:underline inline-flex items-center gap-1">
                        <span className="truncate">{k.replace(/^https?:\/\/[^/]+/, '')}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : k}
                  </td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.clicks)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.impressions)}</td>
                  <td className="p-2 text-right tabular-nums">{pct(r.ctr)}</td>
                  <td className="p-2 text-right tabular-nums">{pos(r.position)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function OpportunityList({ queries, pages }: { queries: Row[]; pages: Row[] }) {
  // High impressions, low CTR (<2%) and position 4-20 = quick wins
  const lowCtr = queries.filter((q) => q.impressions >= 50 && q.ctr < 0.02 && q.position >= 4 && q.position <= 20);
  // Position 11-20 with decent impressions = ranking opportunities
  const page2 = queries.filter((q) => q.position > 10 && q.position <= 20 && q.impressions >= 30);
  // Pages with high impressions, low CTR
  const weakPages = pages.filter((p) => p.impressions >= 100 && p.ctr < 0.03);

  return (
    <div className="space-y-3">
      <OppCard title="Sidor på Google sida 2 (pos 11–20)" desc="Förbättra innehåll/meta för att klättra till sida 1." rows={page2} keyLabel="Sökord" />
      <OppCard title="Låg CTR — uppdatera title/description" desc="Får visningar men få klick. Skriv mer säljande title och meta description." rows={lowCtr} keyLabel="Sökord" />
      <OppCard title="Sidor med svag CTR" desc="Sidor som visas mycket men klickas sällan." rows={weakPages} keyLabel="Sida" isUrl />
    </div>
  );
}

function OppCard({ title, desc, rows, keyLabel, isUrl }: { title: string; desc: string; rows: Row[]; keyLabel: string; isUrl?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title} <Badge variant="outline" className="ml-1">{rows.length}</Badge></CardTitle>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">Inga rader matchar.</p>
        ) : (
          <RowsTable rows={rows.slice(0, 15)} keyLabel={keyLabel} isUrl={isUrl} />
        )}
      </CardContent>
    </Card>
  );
}
