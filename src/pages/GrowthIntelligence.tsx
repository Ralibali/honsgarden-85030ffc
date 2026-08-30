import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Bird,
  BrainCircuit,
  CalendarDays,
  Egg,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  UserMinus,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import {
  buildGrowthIntelligence,
  type GrowthChangeMarker,
  type GrowthIntelligenceResult,
  type RetentionSummary,
} from '@/lib/growthIntelligence';
import { usePageTitle } from '@/hooks/usePageTitle';

const OBSERVATION_DAYS = 365;
const MAX_ROWS_PER_SOURCE = 5000;

function retentionLabel(value: RetentionSummary): string {
  return value.pct == null ? '—' : `${value.pct}%`;
}

function correlationTone(status: string): string {
  if (status === 'positive') return 'bg-green-500/10 text-green-700 border-green-500/20';
  if (status === 'negative') return 'bg-red-500/10 text-red-700 border-red-500/20';
  if (status === 'flat') return 'bg-muted text-muted-foreground border-border';
  return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
}

async function fetchGrowthData() {
  const since = new Date(Date.now() - OBSERVATION_DAYS * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [profiles, eggs, hens, chores, pageViews] = await Promise.all([
    supabase.from('profiles').select('user_id, created_at, subscription_status'),
    supabase
      .from('egg_logs')
      .select('user_id, date, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(MAX_ROWS_PER_SOURCE),
    supabase
      .from('hens')
      .select('user_id, created_at')
      .order('created_at', { ascending: true })
      .limit(MAX_ROWS_PER_SOURCE),
    supabase
      .from('chore_completions')
      .select('user_id, completed_date')
      .gte('completed_date', sinceDate)
      .order('completed_date', { ascending: true })
      .limit(MAX_ROWS_PER_SOURCE),
    supabase
      .from('page_views')
      .select('user_id, path, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .limit(MAX_ROWS_PER_SOURCE),
  ]);

  const error = profiles.error ?? eggs.error ?? hens.error ?? chores.error ?? pageViews.error;
  if (error) throw new Error(error.message);

  return {
    since: sinceIso,
    profiles: profiles.data ?? [],
    eggLogs: eggs.data ?? [],
    hens: hens.data ?? [],
    choreCompletions: chores.data ?? [],
    pageViews: pageViews.data ?? [],
  };
}

async function fetchGithubChangeMarkers(): Promise<GrowthChangeMarker[]> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/Ralibali/honsgarden-85030ffc/commits?sha=main&per_page=50',
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!response.ok) return [];

    const commits = (await response.json()) as Array<{
      sha?: string;
      html_url?: string;
      commit?: {
        message?: string;
        committer?: { date?: string | null };
        author?: { date?: string | null };
      };
    }>;

    const markers: GrowthChangeMarker[] = [];
    for (const row of commits) {
      const occurredAt = row.commit?.committer?.date ?? row.commit?.author?.date ?? null;
      const label = row.commit?.message?.split('\n')[0]?.trim() ?? '';
      if (!row.sha || !occurredAt || !label) continue;
      if (!/^(feat|fix|perf|refactor|merge|release|chore\(deps\)|chore\(release\))/i.test(label)) continue;
      markers.push({
        id: row.sha,
        label,
        occurred_at: occurredAt,
        source: 'github',
        url: row.html_url,
      });
      if (markers.length >= 20) break;
    }
    return markers;
  } catch {
    return [];
  }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  note: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{note}</p>
      </CardContent>
    </Card>
  );
}

function RetentionCard({ label, value, window }: { label: string; value: RetentionSummary; window: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <Badge variant="outline" className="text-[9px]">{window}</Badge>
        </div>
        <p className="text-2xl font-semibold text-foreground">{retentionLabel(value)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {value.eligible ? `${value.retained} av ${value.eligible} mogna konton återkom` : 'Inga mogna cohorts ännu'}
        </p>
      </CardContent>
    </Card>
  );
}

function GrowthDashboard({ intelligence }: { intelligence: GrowthIntelligenceResult }) {
  const { summary, retention, brief } = intelligence;

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/[0.025]">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" /> Veckans Growth Brief
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Deterministiska fakta först. AI får tolka, aldrig hitta på mätdata.</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{brief.confidence.toUpperCase()} CONFIDENCE</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base font-semibold text-foreground">{brief.headline}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Signaler</p>
              <div className="space-y-1.5">
                {brief.signals.length ? brief.signals.map((signal) => (
                  <p key={signal} className="text-xs text-foreground flex gap-2"><span className="text-primary">•</span>{signal}</p>
                )) : <p className="text-xs text-muted-foreground">Ingen materiell signal ännu.</p>}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Nästa åtgärd</p>
              <div className="space-y-1.5">
                {brief.actions.map((action, index) => (
                  <p key={action} className="text-xs text-foreground flex gap-2"><span className="font-semibold text-primary">{index + 1}.</span>{action}</p>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Activity} label="Aktiva" value={summary.active7d} note="produktaktivitet senaste 7 dagarna" />
        <SummaryCard icon={AlertTriangle} label="Risk" value={summary.atRisk8to30d} note="8–30 dagar utan aktivitet" />
        <SummaryCard icon={UserMinus} label="Dormant" value={summary.dormant30dPlus} note="30+ dagar utan aktivitet" />
        <SummaryCard icon={Users} label="Ej aktiverade" value={summary.neverActivated} note="ingen höna eller ägglogg ännu" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <RetentionCard label="D1-retention" value={retention.d1} window="dag 1–2" />
        <RetentionCard label="D7-retention" value={retention.d7} window="dag 6–8" />
        <RetentionCard label="D30-retention" value={retention.d30} window="dag 27–33" />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="font-serif text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" />Funnel & största läckan</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {intelligence.funnel.map((step) => (
            <div key={step.key} className="grid grid-cols-[120px_1fr_62px] gap-3 items-center">
              <div>
                <p className="text-xs font-medium text-foreground">{step.label}</p>
                {step.dropFromPreviousPct != null && <p className="text-[9px] text-muted-foreground">−{step.dropFromPreviousPct}% från föregående</p>}
              </div>
              <div className="h-6 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full bg-primary/35" style={{ width: `${Math.max(step.pctOfSignup, 2)}%` }} />
              </div>
              <p className="text-xs text-right font-semibold">{step.count} · {step.pctOfSignup}%</p>
            </div>
          ))}
          {intelligence.biggestLeak && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs">
              <strong>Största tapp:</strong> {intelligence.biggestLeak.label} ({intelligence.biggestLeak.dropFromPreviousPct ?? 0}% från föregående steg).
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="font-serif text-sm flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Cohorts – activation & retention</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead><tr className="border-b border-border text-muted-foreground text-left">
              <th className="py-2 pr-3">Signup-vecka</th><th className="py-2 px-2 text-right">N</th><th className="py-2 px-2 text-right">Höna ≤7d</th><th className="py-2 px-2 text-right">Ägg ≤7d</th><th className="py-2 px-2 text-right">D1</th><th className="py-2 px-2 text-right">D7</th><th className="py-2 pl-2 text-right">D30</th>
            </tr></thead>
            <tbody>{intelligence.cohorts.slice().reverse().map((cohort) => (
              <tr key={cohort.week} className="border-b border-border/40 last:border-0">
                <td className="py-2 pr-3 font-medium">{cohort.week}</td><td className="py-2 px-2 text-right">{cohort.signups}</td><td className="py-2 px-2 text-right">{cohort.firstHen7Pct ?? '—'}{cohort.firstHen7Pct != null ? '%' : ''}</td><td className="py-2 px-2 text-right">{cohort.firstEgg7Pct ?? '—'}{cohort.firstEgg7Pct != null ? '%' : ''}</td><td className="py-2 px-2 text-right">{retentionLabel(cohort.d1)}</td><td className="py-2 px-2 text-right">{retentionLabel(cohort.d7)}</td><td className="py-2 pl-2 text-right">{retentionLabel(cohort.d30)}</td>
              </tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-sm flex items-center gap-2">
            {intelligence.anomalies.some((a) => a.direction === 'down') ? <TrendingDown className="h-4 w-4 text-red-500" /> : <TrendingUp className="h-4 w-4 text-green-500" />}
            Automatisk anomalidetektion
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Jämför två avslutade kalenderveckor. Minst 25% och ≥2 användares skillnad krävs.</p>
        </CardHeader>
        <CardContent>
          {intelligence.anomalies.length ? <div className="space-y-2">{intelligence.anomalies.map((anomaly) => (
            <div key={anomaly.metric} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
              {anomaly.direction === 'up' ? <TrendingUp className="h-4 w-4 text-green-600 shrink-0" /> : <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />}
              <div className="flex-1"><p className="text-xs font-semibold">{anomaly.label}</p><p className="text-[10px] text-muted-foreground">{anomaly.before} → {anomaly.after}</p></div>
              <Badge variant="outline" className={anomaly.direction === 'up' ? 'text-green-700' : 'text-red-700'}>{anomaly.deltaPct > 0 ? '+' : ''}{anomaly.deltaPct}%</Badge>
            </div>
          ))}</div> : <p className="text-xs text-muted-foreground py-2">Ingen materiell vecka-mot-vecka-anomali. Tystnad är ett giltigt resultat.</p>}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2"><CardTitle className="font-serif text-sm flex items-center gap-2"><GitCommitHorizontal className="h-4 w-4 text-primary" />Change → Result</CardTitle><p className="text-[10px] text-muted-foreground">Kodändringar på main blir markörer. 7 dagar före/efter jämförs – korrelation ≠ kausalitet.</p></CardHeader>
        <CardContent>
          {intelligence.changeCorrelations.length ? <div className="space-y-2">{intelligence.changeCorrelations.slice(0, 8).map((change) => (
            <div key={change.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate">{change.label}</p><p className="text-[10px] text-muted-foreground mt-0.5">{change.occurredAt.slice(0, 10)} · {change.note}</p></div>
                <Badge variant="outline" className={`text-[9px] ${correlationTone(change.status)}`}>{change.status === 'insufficient_data' ? 'VÄNTAR DATA' : change.deltaPct != null ? `${change.deltaPct > 0 ? '+' : ''}${change.deltaPct}%` : '—'}</Badge>
                {change.url && <a href={change.url} target="_blank" rel="noreferrer" aria-label="Öppna commit"><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></a>}
              </div>
              {change.activeUsersBefore != null && change.activeUsersAfter != null && <p className="text-[10px] text-muted-foreground mt-2">Aktiva användare: {change.activeUsersBefore} före → {change.activeUsersAfter} efter{change.confounded ? ' · flera ändringar nära i tid' : ''}</p>}
            </div>
          ))}</div> : <p className="text-xs text-muted-foreground py-2">GitHub-markörer kunde inte hämtas. Produktanalysen fungerar ändå.</p>}
        </CardContent>
      </Card>

      <Card className="border-border/50"><CardHeader className="pb-2"><CardTitle className="font-serif text-sm">Datakvalitet & tolkning</CardTitle></CardHeader><CardContent className="space-y-1.5">{intelligence.warnings.map((warning) => <p key={warning} className="text-[11px] text-muted-foreground flex gap-2"><span>•</span>{warning}</p>)}</CardContent></Card>
    </div>
  );
}

export default function GrowthIntelligence() {
  usePageTitle('Growth Intelligence');
  const queryClient = useQueryClient();
  const adminCheck = useQuery({ queryKey: ['admin-check'], queryFn: () => api.adminCheck() });
  const growthData = useQuery({ queryKey: ['growth-intelligence-data'], queryFn: fetchGrowthData, enabled: adminCheck.data?.is_admin === true, staleTime: 5 * 60 * 1000 });
  const changeMarkers = useQuery({ queryKey: ['growth-change-markers'], queryFn: fetchGithubChangeMarkers, enabled: adminCheck.data?.is_admin === true, staleTime: 15 * 60 * 1000 });

  const intelligence = useMemo(() => {
    if (!growthData.data) return null;
    return buildGrowthIntelligence({ ...growthData.data, changes: changeMarkers.data ?? [], observationStart: growthData.data.since, now: new Date() });
  }, [growthData.data, changeMarkers.data]);

  if (adminCheck.isLoading) return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!adminCheck.data?.is_admin) return <div className="max-w-xl mx-auto py-16 text-center space-y-3"><Shield className="h-10 w-10 text-destructive/60 mx-auto" /><h1 className="font-serif text-xl">Åtkomst nekad</h1><p className="text-sm text-muted-foreground">Growth Intelligence är endast tillgängligt för administratörer.</p></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <Link to="/app/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="h-3.5 w-3.5" /> Admin</Link>
          <h1 className="font-serif text-2xl flex items-center gap-2"><BrainCircuit className="h-6 w-6 text-primary" /> Growth Intelligence</h1>
          <p className="text-xs text-muted-foreground mt-1">Retention cohorts, beteendemässig churn, funnel-läckor, anomalier och change→result i ett lager.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => { queryClient.invalidateQueries({ queryKey: ['growth-intelligence-data'] }); queryClient.invalidateQueries({ queryKey: ['growth-change-markers'] }); }}><RefreshCw className="h-3.5 w-3.5" /> Uppdatera</Button>
      </div>

      {growthData.isLoading ? <div className="flex items-center justify-center py-20 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Bygger growth-modellen…</div> : growthData.isError ? <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">Kunde inte läsa growth-data: {String(growthData.error)}</CardContent></Card> : intelligence ? <GrowthDashboard intelligence={intelligence} /> : null}

      <div className="grid sm:grid-cols-3 gap-3 text-[10px] text-muted-foreground">
        <div className="flex gap-2"><Egg className="h-4 w-4 shrink-0" /> Första äggloggen används som activation-signal.</div>
        <div className="flex gap-2"><Bird className="h-4 w-4 shrink-0" /> Första hönan visar föregående onboardingsteg.</div>
        <div className="flex gap-2"><Activity className="h-4 w-4 shrink-0" /> Appbesök + produktaktivitet används för retention.</div>
      </div>
    </div>
  );
}
