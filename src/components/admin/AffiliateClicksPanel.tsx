import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MousePointerClick, TrendingUp, Package, Layout, Globe, Calendar } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Range = '24h' | '7d' | '30d' | '90d';

const RANGE_HOURS: Record<Range, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
};

interface ClickRow {
  id: string;
  created_at: string;
  product_id: string | null;
  banner_id: string | null;
  advertiser: string;
  source: string;
  slug: string | null;
  path: string | null;
  href: string;
}

function aggregate<T extends string | null>(
  rows: ClickRow[],
  key: (r: ClickRow) => T,
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function StatCard({ icon: Icon, label, value }: { icon: typeof MousePointerClick; label: string; value: string | number }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-lg font-serif text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TopList({ title, icon: Icon, rows, limit = 10 }: { title: string; icon: typeof Package; rows: { key: string; count: number }[]; limit?: number }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-serif text-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Ingen data ännu.</p>
        ) : (
          rows.slice(0, limit).map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <div key={r.key} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-foreground truncate">{r.key}</span>
                    <span className="text-xs font-medium text-muted-foreground shrink-0">{r.count} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function AffiliateClicksPanel() {
  const [range, setRange] = useState<Range>('7d');

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['affiliate-clicks', range],
    queryFn: async (): Promise<ClickRow[]> => {
      const since = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from('affiliate_clicks')
        .select('id, created_at, product_id, banner_id, advertiser, source, slug, path, href')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byAdvertiser = aggregate(rows, (r) => r.advertiser);
  const bySource = aggregate(rows, (r) => r.source);
  const byProduct = aggregate(rows, (r) => r.product_id);
  const byBanner = aggregate(rows, (r) => r.banner_id);
  const bySlug = aggregate(rows, (r) => r.slug);

  const uniqueSlugs = new Set(rows.map((r) => r.slug).filter(Boolean)).size;
  const uniqueProducts = byProduct.length;

  return (
    <div className="space-y-4">
      {/* Range-selector */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex gap-1">
            {(['24h', '7d', '30d', '90d'] as Range[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={range === r ? 'default' : 'outline'}
                className="h-7 px-2.5 text-xs rounded-lg"
                onClick={() => setRange(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs rounded-lg" onClick={() => refetch()}>
          Uppdatera
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Översikt */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={MousePointerClick} label="Totalt klick" value={rows.length} />
            <StatCard icon={Package} label="Unika produkter" value={uniqueProducts} />
            <StatCard icon={Layout} label="Unika artiklar" value={uniqueSlugs} />
            <StatCard icon={TrendingUp} label="Annonsörer" value={byAdvertiser.length} />
          </div>

          {rows.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <MousePointerClick className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Inga klick registrerade i denna tidsperiod ännu.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">När någon klickar på en affiliate-länk i bloggen dyker det upp här.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <TopList title="Per annonsör" icon={Globe} rows={byAdvertiser} />
                <TopList title="Per källa (box/banner/glossary)" icon={Layout} rows={bySource} />
                <TopList title="Toppprodukter" icon={Package} rows={byProduct} />
                <TopList title="Toppbannrar" icon={TrendingUp} rows={byBanner} />
              </div>

              <TopList title="Toppartiklar (slug)" icon={Globe} rows={bySlug} limit={15} />

              {/* Senaste klick */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif text-foreground">Senaste klick</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {rows.slice(0, 20).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {r.product_id || r.banner_id || '—'} <span className="text-muted-foreground font-normal">· {r.advertiser} · {r.source}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.slug || r.path || '—'}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(r.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
