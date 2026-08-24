import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Gift, Users, CheckCircle2, Clock, TrendingUp, Trophy } from 'lucide-react';
import { Loader2 } from 'lucide-react';

type Row = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  rewarded: boolean;
  created_at: string;
  redeemed_at: string | null;
  rewarded_at: string | null;
};

export default function ReferralsAdminPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-referrals-all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('referrals')
        .select('id, referrer_user_id, referred_user_id, rewarded, created_at, redeemed_at, rewarded_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  const rows = data ?? [];
  const now = Date.now();
  const days = (n: number) => now - n * 86_400_000;

  const total = rows.length;
  const rewarded = rows.filter(r => r.rewarded).length;
  const pending = total - rewarded;
  const last30 = rows.filter(r => new Date(r.created_at).getTime() > days(30)).length;
  const rewarded30 = rows.filter(r => r.rewarded_at && new Date(r.rewarded_at).getTime() > days(30)).length;
  const conversion = total > 0 ? Math.round((rewarded / total) * 100) : 0;

  // Top referrers
  const byReferrer = new Map<string, { total: number; rewarded: number }>();
  rows.forEach(r => {
    const cur = byReferrer.get(r.referrer_user_id) ?? { total: 0, rewarded: 0 };
    cur.total += 1;
    if (r.rewarded) cur.rewarded += 1;
    byReferrer.set(r.referrer_user_id, cur);
  });
  const top = Array.from(byReferrer.entries())
    .sort((a, b) => b[1].rewarded - a[1].rewarded || b[1].total - a[1].total)
    .slice(0, 10);

  const stats = [
    { label: 'Totalt värvade', value: total, icon: Users, color: 'text-primary' },
    { label: 'Belönade (fullföljda)', value: rewarded, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Väntar på första ägg', value: pending, icon: Clock, color: 'text-orange-500' },
    { label: 'Konvertering', value: `${conversion}%`, icon: TrendingUp, color: 'text-primary' },
    { label: 'Nya senaste 30 dagar', value: last30, icon: Gift, color: 'text-primary' },
    { label: 'Belönade senaste 30 dagar', value: rewarded30, icon: Trophy, color: 'text-green-600' },
  ];

  if (isLoading) {
    return (
      <Card><CardContent className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border/50 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span>{s.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-serif">Topp-värvare (max 12 belönade/år per person)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {top.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Inga värvningar registrerade än.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {top.map(([uid, c], i) => (
                <div key={uid} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-6 text-muted-foreground tabular-nums">#{i + 1}</span>
                  <span className="flex-1 font-mono text-xs text-muted-foreground truncate">{uid}</span>
                  <span className="tabular-nums text-foreground"><span className="font-semibold">{c.rewarded}</span> <span className="text-muted-foreground">/ {c.total}</span></span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-serif">Senaste värvningarna</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Skapad</th>
                  <th className="text-left px-3 py-2">Värvare</th>
                  <th className="text-left px-3 py-2">Värvad</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Belönad</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map(r => (
                  <tr key={r.id} className="border-t border-border/30">
                    <td className="px-3 py-2 tabular-nums">{new Date(r.created_at).toLocaleDateString('sv-SE')}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.referrer_user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.referred_user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">
                      {r.rewarded
                        ? <span className="text-green-600">✓ Belönad</span>
                        : <span className="text-orange-500">Väntar</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">
                      {r.rewarded_at ? new Date(r.rewarded_at).toLocaleDateString('sv-SE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
