import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  MousePointerClick,
  TrendingUp,
  Package,
  Layout,
  Globe,
  Calendar,
  Eye,
  Percent,
  ListTree,
} from 'lucide-react';
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
  section_title: string | null;
  href: string;
}

interface ImpressionRow {
  id: string;
  created_at: string;
  product_id: string | null;
  advertiser: string;
  source: string;
  slug: string | null;
  path: string | null;
  section_title: string | null;
}

function aggregate<R, T extends string | null>(
  rows: R[],
  key: (r: R) => T,
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

function TopList({
  title,
  icon: Icon,
  rows,
  limit = 10,
  suffix,
}: {
  title: string;
  icon: typeof Package;
  rows: { key: string; count: number; suffix?: string }[];
  limit?: number;
  suffix?: string;
}) {
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
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      {r.count}
                      {suffix ? ` ${suffix}` : ''} · {r.suffix ?? `${pct}%`}
                    </span>
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

function combineForCtr(
  impressions: ImpressionRow[],
  clicks: ClickRow[],
  keyFn: (r: ImpressionRow | ClickRow) => string | null,
  limit = 15,
): { key: string; count: number; suffix: string }[] {
  const imp = new Map<string, number>();
  const clk = new Map<string, number>();
  for (const r of impressions) {
    const k = keyFn(r);
    if (!k) continue;
    imp.set(k, (imp.get(k) ?? 0) + 1);
  }
  for (const r of clicks) {
    const k = keyFn(r);
    if (!k) continue;
    clk.set(k, (clk.get(k) ?? 0) + 1);
  }
  const keys = new Set<string>([...imp.keys(), ...clk.keys()]);
  return Array.from(keys)
    .map((key) => {
      const impressions = imp.get(key) ?? 0;
      const clicks = clk.get(key) ?? 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      return {
        key,
        count: impressions,
        suffix: `${clicks} klick · CTR ${ctr.toFixed(1)}%`,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default function AffiliateClicksPanel() {
  const [range, setRange] = useState<Range>('7d');

  const since = new Date(Date.now() - RANGE_HOURS[range] * 3600 * 1000).toISOString();

  const { data: clicks = [], isLoading: clicksLoading, refetch: refetchClicks } = useQuery({
    queryKey: ['affiliate-clicks', range],
    queryFn: async (): Promise<ClickRow[]> => {
      const { data, error } = await supabase
        .from('affiliate_clicks')
        .select('id, created_at, product_id, banner_id, advertiser, source, slug, path, section_title, href')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ClickRow[];
    },
  });

  const { data: impressions = [], isLoading: impressionsLoading, refetch: refetchImpressions } = useQuery({
    queryKey: ['affiliate-impressions', range],
    queryFn: async (): Promise<ImpressionRow[]> => {
      const { data, error } = await supabase
        .from('affiliate_impressions')
        .select('id, created_at, product_id, advertiser, source, slug, path, section_title')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as ImpressionRow[];
    },
  });

  const isLoading = clicksLoading || impressionsLoading;

  const byAdvertiser = aggregate(clicks, (r) => r.advertiser);
  const bySource = aggregate(clicks, (r) => r.source);
  const byBanner = aggregate(clicks, (r) => r.banner_id);
  const bySlugClicks = aggregate(clicks, (r) => r.slug);

  const uniqueProducts = new Set(
    [...clicks, ...impressions].map((r) => r.product_id).filter(Boolean),
  ).size;
  const uniqueSlugs = new Set(
    [...clicks, ...impressions].map((r) => r.slug).filter(Boolean),
  ).size;

  const overallCtr = impressions.length > 0
    ? (clicks.length / impressions.length) * 100
    : 0;

  // Kombinerade vyer: visningar + klick + CTR
  const productCtr = combineForCtr(impressions, clicks, (r) => r.product_id, 20);
  const sectionCtr = combineForCtr(impressions, clicks, (r) => r.section_title, 20);
  const slugCtr = combineForCtr(impressions, clicks, (r) => r.slug, 20);

  // Per artikel × sektion (vilka produkter visas i vilken sektion)
  const sectionProductMap = new Map<string, Map<string, { impressions: number; clicks: number }>>();
  for (const r of impressions) {
    if (!r.slug || !r.section_title || !r.product_id) continue;
    const sectionKey = `${r.slug} · ${r.section_title}`;
    if (!sectionProductMap.has(sectionKey)) sectionProductMap.set(sectionKey, new Map());
    const inner = sectionProductMap.get(sectionKey)!;
    const cur = inner.get(r.product_id) ?? { impressions: 0, clicks: 0 };
    cur.impressions += 1;
    inner.set(r.product_id, cur);
  }
  for (const r of clicks) {
    if (!r.slug || !r.section_title || !r.product_id) continue;
    const sectionKey = `${r.slug} · ${r.section_title}`;
    if (!sectionProductMap.has(sectionKey)) sectionProductMap.set(sectionKey, new Map());
    const inner = sectionProductMap.get(sectionKey)!;
    const cur = inner.get(r.product_id) ?? { impressions: 0, clicks: 0 };
    cur.clicks += 1;
    inner.set(r.product_id, cur);
  }
  const sectionProductRows = Array.from(sectionProductMap.entries())
    .flatMap(([sectionKey, products]) =>
      Array.from(products.entries()).map(([productId, stats]) => ({
        sectionKey,
        productId,
        impressions: stats.impressions,
        clicks: stats.clicks,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0,
      })),
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 40);

  return (
    <div className="space-y-4">
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
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-xs rounded-lg"
          onClick={() => {
            refetchClicks();
            refetchImpressions();
          }}
        >
          Uppdatera
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Eye} label="Visningar" value={impressions.length.toLocaleString('sv-SE')} />
            <StatCard icon={MousePointerClick} label="Klick" value={clicks.length.toLocaleString('sv-SE')} />
            <StatCard icon={Percent} label="CTR" value={`${overallCtr.toFixed(1)}%`} />
            <StatCard icon={Package} label="Unika produkter" value={uniqueProducts} />
            <StatCard icon={Layout} label="Unika artiklar" value={uniqueSlugs} />
            <StatCard icon={TrendingUp} label="Annonsörer" value={byAdvertiser.length} />
          </div>

          {impressions.length === 0 && clicks.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <MousePointerClick className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Ingen affiliate-aktivitet i denna tidsperiod ännu.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  När någon ser eller klickar på en affiliate-länk i bloggen dyker det upp här.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <TopList
                  title="Toppprodukter (visningar + klick + CTR)"
                  icon={Package}
                  rows={productCtr}
                  suffix="vis."
                />
                <TopList
                  title="Per sektion i artiklarna"
                  icon={ListTree}
                  rows={sectionCtr}
                  suffix="vis."
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <TopList title="Per annonsör (klick)" icon={Globe} rows={byAdvertiser} />
                <TopList title="Per källa" icon={Layout} rows={bySource} />
              </div>

              <TopList
                title="Toppartiklar (visningar + CTR)"
                icon={Globe}
                rows={slugCtr}
                limit={20}
                suffix="vis."
              />

              {byBanner.length > 0 && (
                <TopList title="Toppbannrar" icon={TrendingUp} rows={byBanner} />
              )}

              {bySlugClicks.length > 0 && (
                <TopList title="Toppartiklar (klick)" icon={Globe} rows={bySlugClicks} limit={15} />
              )}

              {/* Detaljvy: produkter per sektion per artikel */}
              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif text-foreground flex items-center gap-2">
                    <ListTree className="h-4 w-4 text-primary" /> Produkter per artikel × sektion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sectionProductRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Ingen data per sektion ännu. När bloggar laddas och affiliate-kort blir synliga registreras visningar här.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/40 text-left text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">Artikel · sektion</th>
                            <th className="py-2 pr-3 font-medium">Produkt</th>
                            <th className="py-2 pr-3 font-medium text-right">Visningar</th>
                            <th className="py-2 pr-3 font-medium text-right">Klick</th>
                            <th className="py-2 font-medium text-right">CTR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionProductRows.map((row) => (
                            <tr
                              key={`${row.sectionKey}-${row.productId}`}
                              className="border-b border-border/20 last:border-0"
                            >
                              <td className="py-2 pr-3 text-foreground truncate max-w-[260px]" title={row.sectionKey}>
                                {row.sectionKey}
                              </td>
                              <td className="py-2 pr-3 text-foreground truncate max-w-[200px]" title={row.productId}>
                                {row.productId}
                              </td>
                              <td className="py-2 pr-3 text-right text-foreground">{row.impressions}</td>
                              <td className="py-2 pr-3 text-right text-foreground">{row.clicks}</td>
                              <td className="py-2 text-right text-foreground">{row.ctr.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-serif text-foreground">Senaste klick</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {clicks.slice(0, 20).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {r.product_id || r.banner_id || '—'}{' '}
                          <span className="text-muted-foreground font-normal">
                            · {r.advertiser} · {r.source}
                            {r.section_title ? ` · ${r.section_title}` : ''}
                          </span>
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
