import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Users, CreditCard, ArrowDownRight, DollarSign, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface RevenueData {
  mrr: number;
  arr: number;
  active_subscribers: number;
  monthly_subscribers: number;
  yearly_subscribers: number;
  churn_30d: number;
  revenue_30d: number;
  recent_payments: Array<{
    email: string;
    amount: number;
    currency: string;
    date: string;
    plan: string;
    status: string;
  }>;
  revenue_trend: Array<{ month: string; total: number }>;
  new_customers_trend?: Array<{ month: string; count: number }>;
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'Maj', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Dec',
};

function formatMonth(ym: string) {
  const [, m] = ym.split('-');
  return MONTH_NAMES[m] ?? m;
}

export default function RevenueDashboard() {
  const { data, isLoading, error } = useQuery<RevenueData>({
    queryKey: ['admin-revenue'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-revenue');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-4 text-center text-sm text-destructive">
          Kunde inte hämta intäktsdata: {(error as Error)?.message ?? 'Okänt fel'}
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    { icon: TrendingUp, label: 'MRR', value: `${data.mrr} kr`, color: 'text-success', bg: 'bg-success/8' },
    { icon: DollarSign, label: 'ARR', value: `${data.arr} kr`, color: 'text-primary', bg: 'bg-primary/8' },
    { icon: Users, label: 'Aktiva prenumeranter', value: data.active_subscribers, color: 'text-warning', bg: 'bg-warning/8' },
    { icon: CreditCard, label: 'Intäkter 30d', value: `${data.revenue_30d} kr`, color: 'text-accent', bg: 'bg-accent/8' },
    { icon: ArrowDownRight, label: 'Churn 30d', value: data.churn_30d, color: 'text-destructive', bg: 'bg-destructive/8' },
  ];

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpis.map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="stat-number text-xl text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Planfördelning</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Månadsplan (19 kr)</span>
                <Badge variant="secondary" className="text-xs">{data.monthly_subscribers}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Årsplan (149 kr)</span>
                <Badge variant="secondary" className="text-xs">{data.yearly_subscribers}</Badge>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="text-sm font-medium text-foreground">Totalt</span>
                <Badge className="text-xs">{data.active_subscribers}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue trend chart */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Intäktstrend (6 mån)</h3>
            {data.revenue_trend.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Ingen data ännu</p>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data.revenue_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(value: number) => [`${value} kr`, 'Intäkter']}
                    labelFormatter={formatMonth}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent payments */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Senaste betalningar (30 dagar)</h3>
          {data.recent_payments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Inga betalningar senaste 30 dagarna</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {data.recent_payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(p.date).toLocaleDateString('sv-SE')}
                    </span>
                    <span className="text-xs text-foreground truncate">{p.email}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">
                    {p.amount} {p.currency}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}