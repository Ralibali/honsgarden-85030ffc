import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Plus, Download, RefreshCw, Trash2, Loader2, AlertCircle } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { PremiumGate } from '@/components/PremiumGate';
import { toast } from '@/hooks/use-toast';

type ReportType = 'manad' | 'kvartal' | 'ar' | 'avel';

interface ReportRow {
  id: string;
  user_id: string;
  farm_id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  title: string;
  file_path: string | null;
  file_size_bytes: number | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message: string | null;
  download_count: number;
  generated_at: string | null;
  created_at: string;
}

const SV_DATE = (d: string) =>
  new Date(d).toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' });

const SV_DATETIME = (d: string) =>
  new Date(d).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusBadge(status: ReportRow['status']) {
  switch (status) {
    case 'generating':
    case 'pending':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Genererar
        </Badge>
      );
    case 'completed':
      return <Badge className="bg-primary text-primary-foreground">Klar</Badge>;
    case 'failed':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Misslyckades
        </Badge>
      );
  }
}

// ---- Period helpers ----
function lastNMonths(n: number) {
  const now = new Date();
  const list: { value: string; label: string; start: string; end: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const value = `${start.toISOString().slice(0, 10)}|${end.toISOString().slice(0, 10)}`;
    const label = start.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
    list.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1), start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
  }
  return list;
}
function lastNQuarters(n: number) {
  const now = new Date();
  const currentQ = Math.floor(now.getMonth() / 3);
  const list: { value: string; label: string; start: string; end: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const totalQ = currentQ - i;
    const year = now.getFullYear() + Math.floor(totalQ / 4);
    const q = ((totalQ % 4) + 4) % 4;
    const start = new Date(year, q * 3, 1);
    const end = new Date(year, q * 3 + 3, 0);
    const value = `${start.toISOString().slice(0, 10)}|${end.toISOString().slice(0, 10)}`;
    list.push({
      value, label: `Q${q + 1} ${year}`,
      start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10),
    });
  }
  return list;
}
function lastNYears(n: number) {
  const now = new Date();
  const list: { value: string; label: string; start: string; end: string }[] = [];
  for (let i = 0; i < n; i++) {
    const y = now.getFullYear() - i - (i === 0 && now.getMonth() === 0 && now.getDate() === 1 ? 1 : 0);
    if (i === 0 && y === now.getFullYear()) continue;
    const start = `${y}-01-01`;
    const end = `${y}-12-31`;
    list.push({ value: `${start}|${end}`, label: String(y), start, end });
  }
  // Also include current year-to-date
  const ytdStart = `${now.getFullYear()}-01-01`;
  const ytdEnd = now.toISOString().slice(0, 10);
  list.unshift({
    value: `${ytdStart}|${ytdEnd}`,
    label: `${now.getFullYear()} (hittills)`,
    start: ytdStart,
    end: ytdEnd,
  });
  return list;
}

function ReportsInner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('manad');
  const [period, setPeriod] = useState<string>(() => lastNMonths(1)[0]?.value ?? '');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [farmId, setFarmId] = useState<string>('');

  // Farm(s) the user owns
  const { data: farms = [] } = useQuery({
    queryKey: ['my-owned-farms', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_members')
        .select('farm_id, role, coop_settings:farm_id(id, coop_name)')
        .eq('user_id', user!.id)
        .eq('role', 'owner');
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.farm_id,
        name: m.coop_settings?.coop_name ?? 'Min gård',
      }));
    },
  });

  React.useEffect(() => {
    if (!farmId && farms.length > 0) setFarmId(farms[0].id);
  }, [farms, farmId]);

  // Reports list (RLS filters to farms the user is a member of)
  const { data: reports = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ['generated-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as ReportRow[] | undefined;
      const pending = data?.some((r) => r.status === 'generating' || r.status === 'pending');
      return pending ? 3000 : false;
    },
  });

  // Period values
  const monthOptions = useMemo(() => lastNMonths(24), []);
  const quarterOptions = useMemo(() => lastNQuarters(8), []);
  const yearOptions = useMemo(() => lastNYears(5), []);

  React.useEffect(() => {
    if (type === 'manad') setPeriod(monthOptions[0]?.value ?? '');
    else if (type === 'kvartal') setPeriod(quarterOptions[0]?.value ?? '');
    else if (type === 'ar') setPeriod(yearOptions[0]?.value ?? '');
  }, [type, monthOptions, quarterOptions, yearOptions]);

  const resolvePeriod = (): { start: string; end: string } | null => {
    if (type === 'avel') {
      if (!customStart || !customEnd) return null;
      return { start: customStart, end: customEnd };
    }
    if (!period) return null;
    const [s, e] = period.split('|');
    return { start: s, end: e };
  };

  // Live preview counts
  const periodResolved = resolvePeriod();
  const { data: preview } = useQuery({
    queryKey: ['report-preview', farmId, periodResolved?.start, periodResolved?.end],
    enabled: open && !!periodResolved && !!farmId,
    queryFn: async () => {
      if (!periodResolved) return null;
      const [{ count: eggs }, { count: health }, { count: hatch }] = await Promise.all([
        supabase
          .from('egg_logs')
          .select('id', { count: 'exact', head: true })
          .gte('date', periodResolved.start)
          .lte('date', periodResolved.end),
        supabase
          .from('health_events')
          .select('id', { count: 'exact', head: true })
          .gte('event_date', periodResolved.start)
          .lte('event_date', periodResolved.end),
        supabase
          .from('hatch_sessions')
          .select('id', { count: 'exact', head: true })
          .gte('set_date', periodResolved.start)
          .lte('set_date', periodResolved.end),
      ]);
      return { eggs: eggs ?? 0, health: health ?? 0, hatch: hatch ?? 0 };
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const p = resolvePeriod();
      if (!p) throw new Error('Välj en period');
      if (!farmId) throw new Error('Välj en gård');
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          farm_id: farmId,
          report_type: type,
          period_start: p.start,
          period_end: p.end,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Rapport startad', description: 'Den dyker upp i listan när den är klar.' });
      qc.invalidateQueries({ queryKey: ['generated-reports'] });
      setOpen(false);
    },
    onError: (e: any) =>
      toast({ title: 'Kunde inte skapa rapport', description: e.message, variant: 'destructive' }),
  });

  const retry = useMutation({
    mutationFn: async (r: ReportRow) => {
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          farm_id: r.farm_id,
          report_type: r.report_type,
          period_start: r.period_start,
          period_end: r.period_end,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generated-reports'] }),
    onError: (e: any) =>
      toast({ title: 'Kunde inte starta om', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (r: ReportRow) => {
      // Delete file (best-effort) and row
      if (r.file_path) {
        await supabase.storage.from('reports').remove([r.file_path]);
      }
      const { error } = await supabase.from('generated_reports').delete().eq('id', r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Rapport raderad' });
      qc.invalidateQueries({ queryKey: ['generated-reports'] });
    },
    onError: (e: any) =>
      toast({ title: 'Kunde inte radera', description: e.message, variant: 'destructive' }),
  });

  const download = async (r: ReportRow) => {
    try {
      const { data, error } = await supabase.functions.invoke('get-report-url', {
        body: { report_id: r.id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error('Saknar nedladdningslänk');
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      toast({ title: 'Kunde inte ladda ner', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif text-foreground">Rapporter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generera PDF-rapporter med din gårds data – för bokföring, översikt eller delning.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Skapa ny rapport
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Skapa rapport</DialogTitle>
              <DialogDescription>
                Välj typ och period. Rapporten genereras i bakgrunden.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Typ</Label>
                <RadioGroup
                  value={type}
                  onValueChange={(v) => setType(v as ReportType)}
                  className="grid grid-cols-2 gap-2"
                >
                  {[
                    { v: 'manad', l: 'Månad' },
                    { v: 'kvartal', l: 'Kvartal' },
                    { v: 'ar', l: 'År' },
                    { v: 'avel', l: 'Avel' },
                  ].map((o) => (
                    <Label
                      key={o.v}
                      htmlFor={`rt-${o.v}`}
                      className="flex items-center gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-muted"
                    >
                      <RadioGroupItem value={o.v} id={`rt-${o.v}`} />
                      <span>{o.l}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {type === 'manad' && (
                <div>
                  <Label className="mb-2 block">Månad</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === 'kvartal' && (
                <div>
                  <Label className="mb-2 block">Kvartal</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {quarterOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === 'ar' && (
                <div>
                  <Label className="mb-2 block">År</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {type === 'avel' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ps">Från</Label>
                    <Input id="ps" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pe">Till</Label>
                    <Input id="pe" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                  </div>
                </div>
              )}

              {farms.length > 1 && (
                <div>
                  <Label className="mb-2 block">Gård</Label>
                  <Select value={farmId} onValueChange={setFarmId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {farms.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {periodResolved && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
                  <p className="text-muted-foreground">
                    Period: <span className="text-foreground font-medium">
                      {SV_DATE(periodResolved.start)} – {SV_DATE(periodResolved.end)}
                    </span>
                  </p>
                  {preview && (
                    <p className="text-muted-foreground">
                      Innehåll: {preview.eggs} ägglogg-rader · {preview.health} hälsohändelser · {preview.hatch} kläckomgångar
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
              <Button
                onClick={() => generate.mutate()}
                disabled={generate.isPending || !periodResolved || !farmId}
                className="gap-2"
              >
                {generate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Generera
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Inga rapporter ännu"
          description="Skapa din första rapport för att få en sammanställning av månaden, kvartalet eller året."
        />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">{r.title}</p>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {SV_DATE(r.period_start)} – {SV_DATE(r.period_end)}
                    {r.generated_at && ` · genererad ${SV_DATETIME(r.generated_at)}`}
                    {r.file_size_bytes ? ` · ${formatSize(r.file_size_bytes)}` : ''}
                  </p>
                  {r.status === 'failed' && r.error_message && (
                    <p className="text-xs text-destructive mt-1">{r.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.status === 'completed' && (
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => download(r)}>
                      <Download className="h-4 w-4" /> Ladda ner
                    </Button>
                  )}
                  {r.status === 'failed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate(r)}
                    >
                      <RefreshCw className="h-4 w-4" /> Försök igen
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Radera rapport">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Radera rapport?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{r.title}" tas bort permanent, inklusive PDF-filen.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Avbryt</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(r)}>
                          Radera
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  return (
    <PremiumGate feature="Rapporter" blur={false}>
      <ReportsInner />
    </PremiumGate>
  );
}
