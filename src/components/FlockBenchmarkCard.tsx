import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flag, Egg, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type BenchmarkRow = {
  user_eggs_per_hen: number | null;
  national_avg_eggs_per_hen: number | null;
  sample_flocks: number | null;
  user_percentile: number | null;
};

function fmt(n: number | null | undefined, digits = 2) {
  if (n === null || n === undefined) return '–';
  return Number(n).toFixed(digits).replace('.', ',');
}

function BenchmarkInner() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['flock-benchmark'],
    queryFn: async (): Promise<BenchmarkRow | null> => {
      const { data, error } = await supabase.rpc('get_flock_benchmark' as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as BenchmarkRow) ?? null;
    },
    staleTime: 1000 * 60 * 10,
  });

  return (
    <Card className="bg-card border-border/50 rounded-xl shadow-sm">
      <CardHeader className="px-4 sm:px-6 pb-2">
        <CardTitle className="font-serif text-base sm:text-lg flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" /> Din flock vs. Sverige
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : !data || (data.sample_flocks ?? 0) < 5 ? (
          <div className="rounded-2xl bg-muted/30 border border-border/50 p-4">
            <p className="text-sm text-foreground font-medium">Vi samlar fortfarande in data</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              Det behövs lite fler svenska flockar för att en jämförelse ska bli rättvis. Kom tillbaka snart!
            </p>
          </div>
        ) : data.user_eggs_per_hen === null ? (
          <div className="rounded-2xl bg-muted/30 border border-border/50 p-4">
            <p className="text-sm text-foreground font-medium">Logga ägg för att se din benchmark</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-3">
              Vi behöver ägglogg från senaste 30 dagarna för att kunna jämföra din flock med snittet.
            </p>
            <Button size="sm" className="rounded-xl gap-1.5" onClick={() => navigate('/app/eggs')}>
              <Egg className="h-3.5 w-3.5" /> Logga ägg <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          (() => {
            const user = Number(data.user_eggs_per_hen);
            const nat = Number(data.national_avg_eggs_per_hen ?? 0);
            const diff = user - nat;
            const above = diff > 0.001;
            const max = Math.max(user, nat, 0.5);
            const userPct = Math.min(100, (user / max) * 100);
            const natPct = Math.min(100, (nat / max) * 100);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4">
                    <p className="data-label text-[10px] mb-1">Din flock</p>
                    <p className="stat-number text-2xl sm:text-3xl text-foreground">{fmt(user)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">ägg/höna/dag</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 border border-border/50 p-4">
                    <p className="data-label text-[10px] mb-1">Sverige-snitt</p>
                    <p className="stat-number text-2xl sm:text-3xl text-foreground">{fmt(nat)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">ägg/höna/dag</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Du</span><span>{fmt(user)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${userPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Snitt</span><span>{fmt(nat)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full bg-muted-foreground/40 transition-all" style={{ width: `${natPct}%` }} />
                    </div>
                  </div>
                </div>

                <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  above ? 'bg-success/10 text-success border border-success/20'
                        : 'bg-muted/40 text-muted-foreground border border-border/50'
                }`}>
                  <TrendingUp className="h-3 w-3" />
                  {above ? `+${fmt(diff)} över snittet` : diff < -0.001 ? `${fmt(diff)} under snittet` : 'På snittet'}
                </div>

                {data.user_percentile !== null && (
                  <p className="text-sm text-foreground leading-relaxed">
                    Din flock värper bättre än <strong>{data.user_percentile}%</strong> av liknande svenska flockar.
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Baserat på {data.sample_flocks} svenska flockar · senaste 30 dagarna
                </p>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

function BenchmarkPreviewLocked() {
  const navigate = useNavigate();
  return (
    <Card className="bg-card border-border/50 rounded-xl shadow-sm">
      <CardHeader className="px-4 sm:px-6 pb-2">
        <CardTitle className="font-serif text-base sm:text-lg flex items-center gap-2">
          <Flag className="h-4 w-4 text-primary" /> Din flock vs. Sverige
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-5 text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Se hur din flock står sig mot Sverige
        </p>
        <Button className="rounded-xl gap-1.5" onClick={() => navigate('/app/premium')}>
          Lås upp med Premium <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FlockBenchmarkCard() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === 'premium';
  if (!isPremium) return <BenchmarkPreviewLocked />;
  return <BenchmarkInner />;
}

