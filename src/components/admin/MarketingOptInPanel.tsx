import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Mail, CheckCircle2, XCircle, Search, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Row = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  marketing_opt_in: boolean;
  weekly_report_email: boolean;
};

type Filter = 'all' | 'opted_in' | 'opted_out';

export function MarketingOptInPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, display_name, created_at, preferences')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        toast({ title: 'Kunde inte ladda kunder', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      const mapped: Row[] = (data ?? []).map((p: any) => {
        const prefs = (p.preferences && typeof p.preferences === 'object' ? p.preferences : {}) as Record<string, unknown>;
        return {
          user_id: p.user_id,
          email: p.email ?? null,
          display_name: p.display_name ?? null,
          created_at: p.created_at,
          marketing_opt_in: prefs.marketing_opt_in === true,
          weekly_report_email: prefs.weekly_report_email === true,
        };
      });
      setRows(mapped);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const optedIn = rows.filter((r) => r.marketing_opt_in).length;
    const withEmail = rows.filter((r) => !!r.email).length;
    return { total, optedIn, optedOut: total - optedIn, withEmail };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === 'opted_in') list = list.filter((r) => r.marketing_opt_in);
    if (filter === 'opted_out') list = list.filter((r) => !r.marketing_opt_in);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.display_name ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filter, search]);

  const exportCsv = () => {
    const optInRows = rows.filter((r) => r.marketing_opt_in && r.email);
    if (optInRows.length === 0) {
      toast({ title: 'Inga opt-in-kunder att exportera', variant: 'destructive' });
      return;
    }
    const header = 'email,display_name,opted_in_at\n';
    const body = optInRows.map((r) =>
      `"${r.email}","${(r.display_name ?? '').replace(/"/g, '""')}","${r.created_at}"`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-opt-in-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export klar', description: `${optInRows.length} adresser exporterade.` });
  };

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10">
        <CardContent className="p-3 sm:p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-foreground/90 leading-relaxed">
            <strong>GDPR-påminnelse:</strong> Endast användare med <em>marketing_opt_in</em> = true bör få marknadsföringsmejl via Brevo.
            Flaggan sätts via en checkbox i Inställningar (när den finns) eller manuellt här. Tomma värden räknas som ej opt-in.
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Totalt', value: stats.total, color: 'text-foreground' },
          { label: 'Opt-in', value: stats.optedIn, color: 'text-success' },
          { label: 'Ej opt-in', value: stats.optedOut, color: 'text-muted-foreground' },
          { label: 'Med e-post', value: stats.withEmail, color: 'text-foreground' },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Marknadsförings-opt-in
            </CardTitle>
            <Button size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportera opt-in (CSV för Brevo)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök e-post eller namn…"
                className="pl-8 h-9"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'opted_in', 'opted_out'] as Filter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'outline'}
                  onClick={() => setFilter(f)}
                  className="text-xs h-9"
                >
                  {f === 'all' ? 'Alla' : f === 'opted_in' ? 'Opt-in' : 'Ej opt-in'}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Inga kunder matchar.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">E-post</th>
                      <th className="px-3 py-2 font-medium hidden sm:table-cell">Namn</th>
                      <th className="px-3 py-2 font-medium text-center">Marknad</th>
                      <th className="px-3 py-2 font-medium text-center hidden md:table-cell">Veckorapp.</th>
                      <th className="px-3 py-2 font-medium hidden lg:table-cell">Registrerad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.user_id} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-[11px] truncate max-w-[200px]">
                          {r.email ?? <span className="text-muted-foreground italic">saknas</span>}
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell truncate max-w-[140px]">
                          {r.display_name ?? <span className="text-muted-foreground">–</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.marketing_opt_in ? (
                            <Badge className="bg-success/15 text-success border-success/30 gap-1 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Ja
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1 text-[10px]">
                              <XCircle className="h-2.5 w-2.5" /> Nej
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center hidden md:table-cell">
                          {r.weekly_report_email ? (
                            <span className="text-[10px] text-success">✓</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('sv-SE')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
