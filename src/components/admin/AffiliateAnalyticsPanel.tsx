import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Row {
  slug: string;
  views: number;
  impressions: number;
  clicks: number;
  ctr: number;
  clicks_by_source: Record<string, number>;
  top_product: { id: string; clicks: number } | null;
  top_advertiser: { name: string; clicks: number } | null;
}

export default function AffiliateAnalyticsPanel() {
  const [days, setDays] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-analytics', days],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-affiliate-analytics', {
        method: 'POST',
        body: { days: Number(days) },
      });
      if (error) throw error;
      return data as { rows: Row[]; low_ctr: Row[] };
    },
  });

  const rows = data?.rows ?? [];
  const lowCtr = data?.low_ctr ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Affiliate-prestanda per artikel</h3>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dagar</SelectItem>
            <SelectItem value="30">30 dagar</SelectItem>
            <SelectItem value="90">90 dagar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card>
            <CardContent className="p-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-3">Artikel</th>
                    <th className="py-2 pr-3 text-right">Visningar</th>
                    <th className="py-2 pr-3 text-right">Impr.</th>
                    <th className="py-2 pr-3 text-right">Klick</th>
                    <th className="py-2 pr-3 text-right">CTR</th>
                    <th className="py-2 pr-3">Top produkt</th>
                    <th className="py-2 pr-3">Top annonsör</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.slug} className="border-b border-border/40">
                      <td className="py-1.5 pr-3 font-medium truncate max-w-[200px]">{r.slug}</td>
                      <td className="py-1.5 pr-3 text-right">{r.views}</td>
                      <td className="py-1.5 pr-3 text-right">{r.impressions}</td>
                      <td className="py-1.5 pr-3 text-right stat-number text-primary">{r.clicks}</td>
                      <td className="py-1.5 pr-3 text-right">{(r.ctr * 100).toFixed(2)}%</td>
                      <td className="py-1.5 pr-3 truncate max-w-[140px]">{r.top_product?.id ?? '—'}</td>
                      <td className="py-1.5 pr-3 truncate max-w-[100px]">{r.top_advertiser?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Ingen data för perioden.</p>}
            </CardContent>
          </Card>

          {lowCtr.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <h4 className="text-sm font-medium mb-2">Hög trafik, låg CTR – kandidater för optimering</h4>
                <ul className="text-xs space-y-1">
                  {lowCtr.map((r) => (
                    <li key={r.slug} className="flex justify-between border-b border-border/40 py-1">
                      <span className="truncate">{r.slug}</span>
                      <span className="text-muted-foreground">{r.views} vy • {(r.ctr * 100).toFixed(2)}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
