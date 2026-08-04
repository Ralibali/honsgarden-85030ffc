import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users, TrendingUp, TrendingDown, Activity, Egg, Bird, ClipboardCheck,
  AlertTriangle, Sparkles, Loader2, RefreshCw, UserCheck, UserX, Zap,
  ArrowRight, BarChart3, Target, Lightbulb, ShieldCheck
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--accent))',
  '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#f97316'
];

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
};

export default function UserInsightsDashboard() {
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [healthCheckResult, setHealthCheckResult] = useState<any>(null);

  // Fetch all users with profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['insights-profiles'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, created_at, subscription_status, premium_expires_at, is_lifetime_premium');
      return (data || []) as any[];
    },
  });

  // Fetch egg logs (all users - admin RLS)
  const { data: eggLogs = [], isLoading: eggsLoading } = useQuery({
    queryKey: ['insights-eggs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('egg_logs')
        .select('user_id, date, count, created_at')
        .order('date', { ascending: false })
        .limit(1000);
      return (data || []) as any[];
    },
  });

  // Fetch hens (all users)
  const { data: hens = [] } = useQuery({
    queryKey: ['insights-hens'],
    queryFn: async () => {
      const { data } = await supabase
        .from('hens')
        .select('user_id, created_at, is_active');
      return (data || []) as any[];
    },
  });

  // Fetch chore completions
  const { data: choreCompletions = [] } = useQuery({
    queryKey: ['insights-chores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('chore_completions')
        .select('user_id, completed_date')
        .order('completed_date', { ascending: false })
        .limit(1000);
      return (data || []) as any[];
    },
  });

  // Fetch page views for usage patterns
  const { data: pageViews = [] } = useQuery({
    queryKey: ['insights-pageviews'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('page_views')
        .select('path, user_id, created_at, session_id')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ['insights-transactions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('user_id, date, type')
        .limit(1000);
      return (data || []) as any[];
    },
  });

  // Fetch feed records
  const { data: feedRecords = [] } = useQuery({
    queryKey: ['insights-feed'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feed_records')
        .select('user_id, date')
        .limit(1000);
      return (data || []) as any[];
    },
  });

  const isLoading = profilesLoading || eggsLoading;

  // ==================== COMPUTED INSIGHTS ====================

  const insights = useMemo(() => {
    if (!profiles.length) return null;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // --- User Activity Overview ---
    const userActivity = profiles.map(p => {
      const userEggs = eggLogs.filter(e => e.user_id === p.user_id);
      const userChores = choreCompletions.filter(c => c.user_id === p.user_id);
      const lastEggDate = userEggs.length > 0 ? userEggs[0].date : null;
      const lastChoreDate = userChores.length > 0 ? userChores[0].completed_date : null;
      const lastActivity = [lastEggDate, lastChoreDate].filter(Boolean).sort().reverse()[0] || null;

      const recentEggDays = new Set(
        userEggs.filter(e => new Date(e.date) >= thirtyDaysAgo).map(e => e.date)
      ).size;
      const recentChoreDays = new Set(
        userChores.filter(c => new Date(c.completed_date) >= thirtyDaysAgo).map(c => c.completed_date)
      ).size;

      const totalEggs = userEggs.reduce((s, e) => s + (e.count || 0), 0);
      const userHens = hens.filter(h => h.user_id === p.user_id);
      const hasUsedFeatures = {
        eggs: userEggs.length > 0,
        hens: userHens.length > 0,
        chores: userChores.length > 0,
        finance: transactions.some(t => t.user_id === p.user_id),
        feed: feedRecords.some(f => f.user_id === p.user_id),
      };

      const daysSinceLastActivity = lastActivity
        ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      let status: 'active' | 'at_risk' | 'churned' | 'new';
      if (daysSinceLastActivity <= 7) status = 'active';
      else if (daysSinceLastActivity <= 30) status = 'at_risk';
      else if (totalEggs === 0 && userHens.length === 0) status = 'new';
      else status = 'churned';

      return {
        ...p,
        lastActivity,
        daysSinceLastActivity,
        recentEggDays,
        recentChoreDays,
        totalEggs,
        henCount: userHens.length,
        activeHens: userHens.filter(h => h.is_active).length,
        hasUsedFeatures,
        status,
        featureCount: Object.values(hasUsedFeatures).filter(Boolean).length,
      };
    });

    const activeUsers = userActivity.filter(u => u.status === 'active').length;
    const atRiskUsers = userActivity.filter(u => u.status === 'at_risk').length;
    const churnedUsers = userActivity.filter(u => u.status === 'churned').length;
    const newUsers = userActivity.filter(u => u.status === 'new').length;

    // --- Usage Patterns (feature adoption) ---
    const featureAdoption = {
      eggs: userActivity.filter(u => u.hasUsedFeatures.eggs).length,
      hens: userActivity.filter(u => u.hasUsedFeatures.hens).length,
      chores: userActivity.filter(u => u.hasUsedFeatures.chores).length,
      finance: userActivity.filter(u => u.hasUsedFeatures.finance).length,
      feed: userActivity.filter(u => u.hasUsedFeatures.feed).length,
    };

    // Most visited app pages
    const appPageCounts: Record<string, number> = {};
    pageViews
      .filter(pv => pv.path?.startsWith('/app'))
      .forEach(pv => {
        const page = pv.path.replace('/app/', '').split('/')[0] || 'dashboard';
        appPageCounts[page] = (appPageCounts[page] || 0) + 1;
      });
    const topAppPages = Object.entries(appPageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    // --- Engagement Over Time (weekly cohorts) ---
    const weeklyActivity: { week: string; activeUsers: number; eggLogs: number; chores: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (i + 1) * 7);
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekLabel = `V${Math.ceil((now.getDate() - i * 7) / 7)}`;

      const weekEggs = eggLogs.filter(e => {
        const d = new Date(e.date);
        return d >= weekStart && d < weekEnd;
      });
      const weekChores = choreCompletions.filter(c => {
        const d = new Date(c.completed_date);
        return d >= weekStart && d < weekEnd;
      });
      const activeInWeek = new Set([
        ...weekEggs.map(e => e.user_id),
        ...weekChores.map(c => c.user_id),
      ]).size;

      weeklyActivity.push({
        week: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
        activeUsers: activeInWeek,
        eggLogs: weekEggs.length,
        chores: weekChores.length,
      });
    }

    // --- Funnel Analysis ---
    const totalUsers = profiles.length;
    const usersWithHens = userActivity.filter(u => u.hasUsedFeatures.hens).length;
    const usersWithEggs = userActivity.filter(u => u.hasUsedFeatures.eggs).length;
    const usersWithMultipleFeatures = userActivity.filter(u => u.featureCount >= 3).length;
    const dailyActiveUsers = userActivity.filter(u => u.daysSinceLastActivity <= 1).length;

    const funnel = [
      { step: 'Registrerade', count: totalUsers, pct: 100 },
      { step: 'Lagt till höna', count: usersWithHens, pct: totalUsers ? Math.round((usersWithHens / totalUsers) * 100) : 0 },
      { step: 'Loggat ägg', count: usersWithEggs, pct: totalUsers ? Math.round((usersWithEggs / totalUsers) * 100) : 0 },
      { step: '3+ funktioner', count: usersWithMultipleFeatures, pct: totalUsers ? Math.round((usersWithMultipleFeatures / totalUsers) * 100) : 0 },
      { step: 'Dagligen aktiv', count: dailyActiveUsers, pct: totalUsers ? Math.round((dailyActiveUsers / totalUsers) * 100) : 0 },
    ];

    // Sort users by risk for the at-risk list
    const atRiskList = userActivity
      .filter(u => u.status === 'at_risk')
      .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);

    const churnedList = userActivity
      .filter(u => u.status === 'churned')
      .sort((a, b) => b.totalEggs - a.totalEggs)
      .slice(0, 10);

    return {
      userActivity,
      activeUsers,
      atRiskUsers,
      churnedUsers,
      newUsers,
      featureAdoption,
      topAppPages,
      weeklyActivity,
      funnel,
      atRiskList,
      churnedList,
      totalUsers,
    };
  }, [profiles, eggLogs, hens, choreCompletions, pageViews, transactions, feedRecords]);

  // Subscription Health Check mutation
  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('subscription-health-check');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setHealthCheckResult(data);
      if (data.totalIssues === 0) {
        toast.success('Hälsokontroll slutförd', { description: 'Inga problem hittades! 🎉' });
      } else {
        toast.warning(`${data.totalIssues} problem hittades`, {
          description: 'Kontrollera mejlet för detaljer.',
        });
      }
    },
    onError: (error) => {
      toast.error('Hälsokontroll misslyckades', { description: String(error) });
    },
  });

  // AI Tips generation
  const aiTipsMutation = useMutation({
    mutationFn: async () => {
      if (!insights) throw new Error('No data');

      const summary = {
        totalUsers: insights.totalUsers,
        activeUsers: insights.activeUsers,
        atRiskUsers: insights.atRiskUsers,
        churnedUsers: insights.churnedUsers,
        newUsers: insights.newUsers,
        featureAdoption: insights.featureAdoption,
        funnel: insights.funnel,
        topPages: insights.topAppPages.slice(0, 5),
        weeklyTrend: insights.weeklyActivity,
      };

      const { data, error } = await supabase.functions.invoke('admin-ai-insights', {
        body: { summary },
      });

      if (error) throw error;
      return data.tips as string;
    },
    onSuccess: (tips) => setAiTips(tips),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!insights) return null;

  const statusColors = {
    active: 'bg-green-500',
    at_risk: 'bg-yellow-500',
    churned: 'bg-red-500',
    new: 'bg-blue-500',
  };

  const statusLabels = {
    active: 'Aktiv',
    at_risk: 'Risk',
    churned: 'Churnad',
    new: 'Ny',
  };

  const featureLabels: Record<string, { label: string; icon: any }> = {
    eggs: { label: 'Äggloggning', icon: Egg },
    hens: { label: 'Hönor', icon: Bird },
    chores: { label: 'Uppgifter', icon: ClipboardCheck },
    finance: { label: 'Ekonomi', icon: BarChart3 },
    feed: { label: 'Foder', icon: Activity },
  };

  return (
    <div className="space-y-5">
      {/* Status overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: UserCheck, label: 'Aktiva (7d)', value: insights.activeUsers, color: 'text-green-500', bg: 'bg-green-500/8' },
          { icon: AlertTriangle, label: 'Risk (8–30d)', value: insights.atRiskUsers, color: 'text-yellow-500', bg: 'bg-yellow-500/8' },
          { icon: UserX, label: 'Churnade (30d+)', value: insights.churnedUsers, color: 'text-red-500', bg: 'bg-red-500/8' },
          { icon: Users, label: 'Nya (ej aktiva)', value: insights.newUsers, color: 'text-blue-500', bg: 'bg-blue-500/8' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-xl font-semibold text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement over time */}
      {insights.weeklyActivity.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Engagemang per vecka (senaste 4 veckorna)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={insights.weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="activeUsers" name="Aktiva användare" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="eggLogs" name="Äggloggar" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="chores" name="Sysslor" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Funnel Analysis */}
      <Card className="border-border/50">
        <CardHeader className="px-4 py-3">
          <CardTitle className="font-serif text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            Funnel – från registrering till daglig användning
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {insights.funnel.map((step, i) => (
              <div key={step.step} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{step.step}</span>
                <div className="flex-1 bg-muted/50 rounded-full h-7 relative overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(step.pct, 2)}%`,
                      background: `hsl(var(--primary) / ${1 - i * 0.15})`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
                    {step.count} ({step.pct}%)
                  </span>
                </div>
                {i < insights.funnel.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feature Adoption */}
      <Card className="border-border/50">
        <CardHeader className="px-4 py-3">
          <CardTitle className="font-serif text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Funktionsanvändning
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(insights.featureAdoption).map(([key, count]) => {
              const feature = featureLabels[key];
              if (!feature) return null;
              const Icon = feature.icon;
              const pct = insights.totalUsers ? Math.round((count / insights.totalUsers) * 100) : 0;
              return (
                <div key={key} className="text-center p-3 bg-muted/30 rounded-xl">
                  <Icon className="h-5 w-5 mx-auto mb-1 text-primary/70" />
                  <p className="text-lg font-semibold text-foreground">{pct}%</p>
                  <p className="text-[9px] text-muted-foreground">{feature.label}</p>
                  <p className="text-[9px] text-muted-foreground/60">{count} av {insights.totalUsers}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top App Pages */}
      {insights.topAppPages.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Mest besökta appsidor (30 dagar)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1.5">
              {insights.topAppPages.map(([page, count], i) => (
                <div key={page} className="flex items-center gap-2 text-xs">
                  <span className="w-5 text-muted-foreground text-right">{i + 1}.</span>
                  <span className="flex-1 text-foreground font-medium">/{page}</span>
                  <div className="w-24 bg-muted/50 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-primary/30 rounded-full"
                      style={{ width: `${(count / insights.topAppPages[0][1]) * 100}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-10 text-right">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* At-Risk Users */}
      {insights.atRiskList.length > 0 && (
        <Card className="border-border/50 border-yellow-500/20">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Användare i riskzonen ({insights.atRiskList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1.5">
              {insights.atRiskList.slice(0, 10).map(user => (
                <div key={user.user_id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-yellow-600">
                      {(user.display_name || user.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="flex-1 text-foreground truncate">{user.display_name || user.email}</span>
                  <span className="text-muted-foreground">{user.daysSinceLastActivity}d sedan</span>
                  <span className="text-muted-foreground">{user.totalEggs} ägg</span>
                  <Badge variant="outline" className="text-[8px]">{user.featureCount} funktioner</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Churned Users */}
      {insights.churnedList.length > 0 && (
        <Card className="border-border/50 border-red-500/20">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <UserX className="h-4 w-4 text-red-500" />
              Churnade användare (topp 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1.5">
              {insights.churnedList.map(user => (
                <div key={user.user_id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-red-600">
                      {(user.display_name || user.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="flex-1 text-foreground truncate">{user.display_name || user.email}</span>
                  <span className="text-muted-foreground">{user.daysSinceLastActivity}d sedan</span>
                  <span className="text-muted-foreground">{user.totalEggs} ägg</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription Health Check */}
      <Card className="border-border/50">
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Prenumerationshälsokontroll
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 rounded-lg gap-1.5"
              onClick={() => healthCheckMutation.mutate()}
              disabled={healthCheckMutation.isPending}
            >
              {healthCheckMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Kör hälsokontroll nu
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {healthCheckMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Skannar prenumerationer och synkar mot Stripe...
            </div>
          ) : healthCheckResult ? (
            <div className="space-y-3">
              {healthCheckResult.totalIssues === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <ShieldCheck className="h-4 w-4" />
                  Alla prenumerationer är korrekta! Inga problem hittades.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <strong>{healthCheckResult.totalIssues} problem hittades</strong>
                  </div>
                  {healthCheckResult.issues.duplicates.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      • {healthCheckResult.issues.duplicates.length} dubbla aktiva prenumerationer
                    </div>
                  )}
                  {healthCheckResult.issues.orphan_premium.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      • {healthCheckResult.issues.orphan_premium.length} premium utan giltigt slutdatum
                    </div>
                  )}
                  {healthCheckResult.issues.out_of_sync.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      • {healthCheckResult.issues.out_of_sync.length} profiler osynkade mot Stripe
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Ett detaljerat mejl har skickats till info@auroramedia.se
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Kör manuell hälsokontroll för att skanna efter dubbla prenumerationer, orphan-premium och synkproblem. Körs automatiskt varje dag kl 06:00.
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Tips Section */}
      <Card className="border-border/50 border-primary/20">
        <CardHeader className="px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              AI-förbättringsförslag
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 rounded-lg gap-1.5"
              onClick={() => aiTipsMutation.mutate()}
              disabled={aiTipsMutation.isPending}
            >
              {aiTipsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {aiTips ? 'Generera nya tips' : 'Generera tips'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {aiTipsMutation.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyserar användardata och genererar förslag...
            </div>
          ) : aiTips ? (
            <div className="prose prose-sm max-w-none text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {aiTips}
            </div>
          ) : aiTipsMutation.isError ? (
            <p className="text-sm text-destructive">
              Kunde inte generera tips. Försök igen.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Klicka på "Generera tips" för att få AI-drivna förbättringsförslag baserat på hur dina användare faktiskt använder appen.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
