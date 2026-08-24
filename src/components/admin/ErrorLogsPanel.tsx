import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

interface ErrorRow {
  id: string;
  level: string;
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  user_id: string | null;
  context: any;
  created_at: string;
  notified: boolean;
}

export function ErrorLogsPanel() {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('client_error_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filter !== 'all') q = q.eq('level', filter);
    const { data, error } = await q;
    if (error) {
      toast({ title: 'Kunde inte ladda loggar', description: error.message, variant: 'destructive' });
    } else {
      setRows((data as any) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Realtime: ny rad → uppdatera
    const channel = supabase
      .channel('client_error_logs_admin')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'client_error_logs' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearAll = async () => {
    if (!confirm('Radera alla felloggar (visade)? Det går inte att ångra.')) return;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('client_error_logs' as any).delete().in('id', ids);
    if (error) toast({ title: 'Kunde inte radera', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Loggar rensade' });
      load();
    }
  };

  const counts = {
    error: rows.filter((r) => r.level === 'error').length,
    warning: rows.filter((r) => r.level === 'warning').length,
    info: rows.filter((r) => r.level === 'info').length,
  };

  const levelColor = (lvl: string) =>
    lvl === 'error'
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : lvl === 'warning'
        ? 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="font-medium">Klientfel</span>
          <Badge variant="outline" className="ml-2">{counts.error} fel</Badge>
          <Badge variant="outline">{counts.warning} varningar</Badge>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'error', 'warning', 'info'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Alla' : f}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll} disabled={rows.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      {rows.length === 0 && !loading && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          🎉 Inga loggade fel just nu.
        </Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => {
          const isOpen = expanded.has(r.id);
          return (
            <Card key={r.id} className="p-3">
              <button
                className="w-full text-left flex items-start gap-3"
                onClick={() => toggle(r.id)}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${levelColor(r.level)}`}>
                      {r.level}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: sv })}
                    </span>
                    {r.user_id && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        user: {r.user_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-medium mt-1 truncate">{r.message}</div>
                  {r.url && (
                    <div className="text-[11px] text-muted-foreground truncate">{r.url}</div>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 pl-7 space-y-2 text-xs">
                  {r.stack && (
                    <details open>
                      <summary className="cursor-pointer text-muted-foreground font-medium">Stack</summary>
                      <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto text-[11px] whitespace-pre-wrap">
                        {r.stack}
                      </pre>
                    </details>
                  )}
                  {r.context && (
                    <details>
                      <summary className="cursor-pointer text-muted-foreground font-medium">Kontext</summary>
                      <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto text-[11px]">
                        {JSON.stringify(r.context, null, 2)}
                      </pre>
                    </details>
                  )}
                  {r.user_agent && (
                    <div className="text-muted-foreground">
                      <span className="font-medium">UA:</span> {r.user_agent}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
