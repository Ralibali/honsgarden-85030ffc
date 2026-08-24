import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Shield, Pin, Trash2, CheckCircle2, RotateCcw, Edit3 } from 'lucide-react';

interface LogEntry {
  id: string;
  moderator_id: string;
  moderator_name: string | null;
  action: string;
  target_type: string;
  target_id: string;
  target_user_id: string | null;
  target_user_name: string | null;
  snapshot: any;
  reason: string | null;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; icon: any; tone: string }> = {
  delete_post: { label: 'Tog bort inlägg', icon: Trash2, tone: 'bg-destructive/10 text-destructive border-destructive/20' },
  delete_comment: { label: 'Tog bort kommentar', icon: Trash2, tone: 'bg-destructive/10 text-destructive border-destructive/20' },
  pin: { label: 'Fäste inlägg', icon: Pin, tone: 'bg-primary/10 text-primary border-primary/20' },
  unpin: { label: 'Lossade fäst', icon: Pin, tone: 'bg-muted text-muted-foreground border-border' },
  mark_sold: { label: 'Markerade såld', icon: CheckCircle2, tone: 'bg-success/10 text-success border-success/20' },
  unmark_sold: { label: 'Öppnade igen', icon: RotateCcw, tone: 'bg-muted text-muted-foreground border-border' },
  edit_post: { label: 'Ändrade inlägg', icon: Edit3, tone: 'bg-warning/10 text-warning border-warning/20' },
  edit_comment: { label: 'Ändrade kommentar', icon: Edit3, tone: 'bg-warning/10 text-warning border-warning/20' },
};

export default function CommunityModerationLog() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['community-moderation-log'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('community_moderation_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LogEntry[];
    },
  });

  const filtered = entries.filter((e) => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.moderator_name?.toLowerCase().includes(q) ?? false) ||
      (e.target_user_name?.toLowerCase().includes(q) ?? false) ||
      (e.snapshot?.title?.toLowerCase().includes(q) ?? false) ||
      (e.snapshot?.content?.toLowerCase().includes(q) ?? false) ||
      e.target_id.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        <h2 className="font-serif text-lg text-foreground">Moderationslogg</h2>
        <Badge variant="secondary" className="ml-auto">{filtered.length} händelser</Badge>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök på moderator, författare, titel eller innehåll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-[200px] rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla åtgärder</SelectItem>
            {Object.entries(ACTION_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()}>Uppdatera</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="p-8 text-center">
            <Shield className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Inga moderationshändelser hittades.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const meta = ACTION_META[entry.action] ?? { label: entry.action, icon: Shield, tone: 'bg-muted text-muted-foreground border-border' };
            const Icon = meta.icon;
            const isOpen = expanded.has(entry.id);
            const date = new Date(entry.created_at);
            return (
              <Card key={entry.id} className="border-border/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-foreground">{entry.moderator_name ?? 'Okänd admin'}</span>
                        <span className="text-xs text-muted-foreground">{meta.label}</span>
                        {entry.target_user_name && (
                          <span className="text-xs text-muted-foreground">
                            från <span className="text-foreground/80">{entry.target_user_name}</span>
                          </span>
                        )}
                      </div>
                      {entry.snapshot?.title && (
                        <p className="text-sm text-foreground/90 mt-1 truncate">"{entry.snapshot.title}"</p>
                      )}
                      {!entry.snapshot?.title && entry.snapshot?.content && (
                        <p className="text-sm text-foreground/90 mt-1 line-clamp-2">{entry.snapshot.content}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-muted-foreground">
                          {date.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">{entry.target_type}</Badge>
                        {entry.snapshot && (
                          <button onClick={() => toggle(entry.id)} className="text-[11px] text-primary hover:underline ml-auto">
                            {isOpen ? 'Dölj detaljer' : 'Visa detaljer'}
                          </button>
                        )}
                      </div>
                      {isOpen && entry.snapshot && (
                        <pre className="mt-2 p-2 rounded-lg bg-muted/50 text-[11px] text-foreground/80 overflow-auto max-h-60 whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.snapshot, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
