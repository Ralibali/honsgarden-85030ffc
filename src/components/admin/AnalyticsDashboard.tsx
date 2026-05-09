import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Eye, Users, MousePointerClick, Globe, Monitor, Smartphone, Tablet,
  TrendingUp, Clock, BarChart3, FileText, ArrowUpRight, ArrowDownRight, Zap
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import PwaInstallsCard from './PwaInstallsCard';
import AppComingSoonStatsCard from './AppComingSoonStatsCard';

type Period = '24h' | '7d' | '30d' | '90d';

function getDateSince(period: Period) {
  const d = new Date();
  if (period === '24h') d.setHours(d.getHours() - 24);
  else if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString();
}

function getPreviousPeriodSince(period: Period) {
  const d = new Date();
  if (period === '24h') d.setHours(d.getHours() - 48);
  else if (period === '7d') d.setDate(d.getDate() - 14);
  else if (period === '30d') d.setDate(d.getDate() - 60);
  else d.setDate(d.getDate() - 180);
  return d.toISOString();
}

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

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center text-[10px] font-medium gap-0.5 ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct)}%
    </span>
  );
}

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('30d');
  const since = getDateSince(period);
  const prevSince = getPreviousPeriodSince(period);

  // Page views
  const { data: pageViews = [], isLoading: pvLoading } = useQuery({
    queryKey: ['analytics-pv', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('page_views')
        .select('path, created_at, device_type, referrer, session_id')
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
  });

  // Previous period page views for comparison
  const { data: prevPageViews = [] } = useQuery({
    queryKey: ['analytics-pv-prev', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('page_views')
        .select('session_id')
        .gte('created_at', prevSince)
        .lt('created_at', since);
      return (data || []) as any[];
    },
  });

  // Click events
  const { data: clickEvents = [], isLoading: ceLoading } = useQuery({
    queryKey: ['analytics-clicks', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('click_events')
        .select('event_name, element_text, path, created_at, session_id, metadata')
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
  });

  const isLoading = pvLoading || ceLoading;

  // Computed metrics
  const metrics = useMemo(() => {
    const uniqueSessions = new Set(pageViews.map(pv => pv.session_id)).size;
    const prevUnique = new Set(prevPageViews.map(pv => pv.session_id)).size;
    const totalViews = pageViews.length;
    const avgPages = uniqueSessions ? +(totalViews / uniqueSessions).toFixed(1) : 0;
    const ctaClicks = clickEvents.filter((ce: any) => ce.event_name === 'cta_click').length;
    const ctaRate = totalViews ? +((ctaClicks / totalViews) * 100).toFixed(1) : 0;

    // Bounce rate: sessions with only 1 page view
    const sessionPages: Record<string, number> = {};
    pageViews.forEach(pv => { sessionPages[pv.session_id] = (sessionPages[pv.session_id] || 0) + 1; });
    const totalSessions = Object.keys(sessionPages).length;
    const bounceSessions = Object.values(sessionPages).filter(c => c === 1).length;
    const bounceRate = totalSessions ? Math.round((bounceSessions / totalSessions) * 100) : 0;

    return { uniqueSessions, prevUnique, totalViews, avgPages, ctaClicks, ctaRate, bounceRate };
  }, [pageViews, prevPageViews, clickEvents]);

  // Chart data – hourly for 24h, daily otherwise
  const chartData = useMemo(() => {
    if (period === '24h') {
      const hours: Record<string, { views: number; visitors: Set<string> }> = {};
      for (let i = 23; i >= 0; i--) {
        const d = new Date();
        d.setHours(d.getHours() - i);
        const key = `${String(d.getHours()).padStart(2, '0')}:00`;
        hours[key] = { views: 0, visitors: new Set() };
      }
      pageViews.forEach(pv => {
        const h = new Date(pv.created_at);
        const key = `${String(h.getHours()).padStart(2, '0')}:00`;
        if (hours[key]) {
          hours[key].views++;
          hours[key].visitors.add(pv.session_id);
        }
      });
      return Object.entries(hours).map(([time, d]) => ({
        date: time,
        Sidvisningar: d.views,
        Besökare: d.visitors.size,
      }));
    }

    const days: Record<string, { views: number; visitors: Set<string> }> = {};
    pageViews.forEach(pv => {
      const day = pv.created_at.slice(0, 10);
      if (!days[day]) days[day] = { views: 0, visitors: new Set() };
      days[day].views++;
      days[day].visitors.add(pv.session_id);
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date: date.slice(5),
        Sidvisningar: d.views,
        Besökare: d.visitors.size,
      }));
  }, [pageViews, period]);

  // Click timeline for 24h
  const clickTimeline = useMemo(() => {
    if (period !== '24h') return [];
    const hours: Record<string, number> = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setHours(d.getHours() - i);
      hours[`${String(d.getHours()).padStart(2, '0')}:00`] = 0;
    }
    clickEvents.forEach((ce: any) => {
      const h = new Date(ce.created_at);
      const key = `${String(h.getHours()).padStart(2, '0')}:00`;
      if (hours[key] !== undefined) hours[key]++;
    });
    return Object.entries(hours).map(([time, count]) => ({ time, Klick: count }));
  }, [clickEvents, period]);

  // Top pages
  const topPages = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViews.forEach(pv => { counts[pv.path] = (counts[pv.path] || 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 15);
  }, [pageViews]);

  const blogPages = topPages.filter(([p]) => p.startsWith('/blogg/') && !p.includes('/kategori/') && !p.includes('/tagg/'));

  // Device distribution
  const deviceData = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViews.forEach(pv => { counts[pv.device_type || 'unknown'] = (counts[pv.device_type || 'unknown'] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [pageViews]);

  // Referrer sources
  const topReferrers = useMemo(() => {
    const counts: Record<string, number> = {};
    pageViews.forEach(pv => {
      let source = 'Direkt';
      if (pv.referrer) {
        try { source = new URL(pv.referrer).hostname.replace('www.', ''); } catch { source = pv.referrer; }
      }
      counts[source] = (counts[source] || 0) + 1;
    });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [pageViews]);

  // Click analysis
  const clickAnalysis = useMemo(() => {
    const byEvent: Record<string, { count: number; text: string; isCta: boolean }> = {};
    const byPage: Record<string, number> = {};
    const ctaTexts: Record<string, number> = {};

    clickEvents.forEach((ce: any) => {
      const key = ce.event_name;
      if (!byEvent[key]) byEvent[key] = { count: 0, text: ce.element_text || ce.event_name, isCta: ce.metadata?.isCta };
      byEvent[key].count++;
      byPage[ce.path] = (byPage[ce.path] || 0) + 1;
      if (ce.event_name === 'cta_click') {
        const t = (ce.element_text || '').trim();
        if (t) ctaTexts[t] = (ctaTexts[t] || 0) + 1;
      }
    });

    const topEvents = Object.entries(byEvent).sort(([, a], [, b]) => b.count - a.count).slice(0, 12);
    const topClickPages = Object.entries(byPage).sort(([, a], [, b]) => b - a).slice(0, 10);
    const topCtas = Object.entries(ctaTexts).sort(([, a], [, b]) => b - a).slice(0, 8);

    return { topEvents, topClickPages, topCtas };
  }, [clickEvents]);

  // Real-time: last 10 events
  const recentEvents = useMemo(() => {
    const all = [
      ...pageViews.slice(-5).map(pv => ({ type: 'view' as const, text: pv.path, time: pv.created_at, device: pv.device_type })),
      ...clickEvents.slice(-5).map((ce: any) => ({ type: 'click' as const, text: ce.element_text || ce.event_name, time: ce.created_at, device: null })),
    ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 8);
    return all;
  }, [pageViews, clickEvents]);

  const DeviceIcon = ({ type }: { type: string }) => {
    if (type === 'mobile') return <Smartphone className="h-3.5 w-3.5" />;
    if (type === 'tablet') return <Tablet className="h-3.5 w-3.5" />;
    return <Monitor className="h-3.5 w-3.5" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['24h', '7d', '30d', '90d'] as Period[]).map(p => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-8 rounded-lg"
            onClick={() => setPeriod(p)}
          >
            {p === '24h' ? '24 timmar' : p === '7d' ? '7 dagar' : p === '30d' ? '30 dagar' : '90 dagar'}
          </Button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Eye, label: 'Sidvisningar', value: metrics.totalViews, color: 'text-primary', bg: 'bg-primary/8' },
          { icon: Users, label: 'Unika besökare', value: metrics.uniqueSessions, color: 'text-accent', bg: 'bg-accent/8', delta: { current: metrics.uniqueSessions, previous: metrics.prevUnique } },
          { icon: BarChart3, label: 'Sidor/besök', value: metrics.avgPages, color: 'text-orange-500', bg: 'bg-orange-500/8' },
          { icon: Zap, label: 'CTA-klick', value: metrics.ctaClicks, color: 'text-green-500', bg: 'bg-green-500/8' },
          { icon: MousePointerClick, label: 'CTA-rate', value: `${metrics.ctaRate}%`, color: 'text-purple-500', bg: 'bg-purple-500/8' },
          { icon: TrendingUp, label: 'Avvisningsfrekvens', value: `${metrics.bounceRate}%`, color: 'text-red-500', bg: 'bg-red-500/8' },
        ].map(({ icon: Icon, label, value, color, bg, delta }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="flex items-center justify-center gap-1">
                <p className="text-xl font-semibold text-foreground">{value}</p>
                {delta && <DeltaBadge current={delta.current} previous={delta.previous} />}
              </div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Traffic chart */}
      {chartData.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {period === '24h' ? 'Trafik per timme (senaste 24h)' : 'Trafik över tid'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={period === '24h' ? 2 : 'preserveStartEnd'} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="Sidvisningar" stroke="hsl(var(--primary))" fill="url(#pvGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="Besökare" stroke="hsl(var(--accent))" fill="url(#visGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 24h click timeline */}
      {period === '24h' && clickTimeline.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-purple-500" /> Klick per timme
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={clickTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={2} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Klick" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Live feed */}
      {recentEvents.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="px-4 py-3">
            <CardTitle className="font-serif text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" /> Senaste händelser
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1.5">
              {recentEvents.map((ev, i) => {
                const time = new Date(ev.time);
                const ago = Math.round((Date.now() - time.getTime()) / 60000);
                const agoText = ago < 1 ? 'Just nu' : ago < 60 ? `${ago}m sedan` : `${Math.round(ago / 60)}h sedan`;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.type === 'click' ? 'bg-purple-500' : 'bg-green-500'}`} />
                    <span className="text-muted-foreground w-16 shrink-0">{agoText}</span>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {ev.type === 'click' ? 'Klick' : 'Besök'}
                    </Badge>
                    <span className="text-foreground truncate">{ev.text}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pages" className="w-full">
        <TabsList className="flex overflow-x-auto w-full justify-start gap-1 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="pages" className="text-xs rounded-lg">Sidor</TabsTrigger>
          <TabsTrigger value="blog" className="text-xs rounded-lg">Blogg</TabsTrigger>
          <TabsTrigger value="clicks" className="text-xs rounded-lg">Klick</TabsTrigger>
          <TabsTrigger value="cta" className="text-xs rounded-lg">CTA</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs rounded-lg">Källor</TabsTrigger>
          <TabsTrigger value="devices" className="text-xs rounded-lg">Enheter</TabsTrigger>
          <TabsTrigger value="pwa" className="text-xs rounded-lg">PWA</TabsTrigger>
        </TabsList>

        {/* Pages tab */}
        <TabsContent value="pages">
          <Card className="border-border/50">
            <CardHeader className="px-4 py-3">
              <CardTitle className="font-serif text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Populära sidor
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {topPages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Ingen data ännu</p>
              ) : (
                <div className="space-y-2">
                  {topPages.map(([path, count], i) => {
                    const maxCount = topPages[0][1];
                    return (
                      <div key={path} className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground w-5 text-right">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-foreground truncate">{path}</span>
                            <span className="text-xs font-medium text-primary ml-2">{count}</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1">
                            <div className="bg-primary rounded-full h-1 transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Blog tab */}
        <TabsContent value="blog">
          <Card className="border-border/50">
            <CardHeader className="px-4 py-3">
              <CardTitle className="font-serif text-sm">📝 Blogginlägg – topp</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {blogPages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Inga bloggbesök ännu</p>
              ) : (
                <div className="space-y-2">
                  {blogPages.map(([path, count], i) => {
                    const slug = path.replace('/blogg/', '');
                    return (
                      <div key={path} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-muted-foreground">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                          <span className="text-xs text-foreground truncate">{slug}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{count} visningar</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clicks tab */}
        <TabsContent value="clicks">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardHeader className="px-4 py-3">
                <CardTitle className="font-serif text-sm flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-primary" /> Alla klickhändelser
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {clickAnalysis.topEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Inga klick ännu</p>
                ) : (
                  <div className="space-y-2">
                    {clickAnalysis.topEvents.map(([name, { count, text, isCta }]) => (
                      <div key={name} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-foreground truncate block">{text}</span>
                            {isCta && <Badge className="text-[8px] bg-green-500/10 text-green-600 border-0 px-1">CTA</Badge>}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{name}</span>
                        </div>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardHeader className="px-4 py-3">
                <CardTitle className="font-serif text-sm">📍 Klick per sida</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {clickAnalysis.topClickPages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Ingen data ännu</p>
                ) : (
                  <div className="space-y-2">
                    {clickAnalysis.topClickPages.map(([path, count]) => (
                      <div key={path} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-foreground truncate">{path}</span>
                        <span className="text-xs font-medium text-primary">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CTA tab */}
        <TabsContent value="cta">
          <Card className="border-border/50">
            <CardHeader className="px-4 py-3">
              <CardTitle className="font-serif text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" /> CTA-konverteringar
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {clickAnalysis.topCtas.length === 0 ? (
                <div className="text-center py-6">
                  <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">Inga CTA-klick ännu.</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Knappar som "Kom igång", "Skapa konto" och "Uppgradera" spåras automatiskt.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clickAnalysis.topCtas.map(([text, count], i) => {
                    const max = clickAnalysis.topCtas[0][1];
                    return (
                      <div key={text}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground font-medium">{text}</span>
                          <span className="text-xs font-bold text-green-600">{count}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div className="bg-green-500 rounded-full h-2 transition-all" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources tab */}
        <TabsContent value="sources">
          <Card className="border-border/50">
            <CardHeader className="px-4 py-3">
              <CardTitle className="font-serif text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Trafikkällor
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {topReferrers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Ingen data ännu</p>
              ) : (
                <div className="space-y-2">
                  {topReferrers.map(([source, count], i) => {
                    const max = topReferrers[0][1];
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs text-foreground truncate">{source}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground ml-2">{count}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1 ml-4">
                          <div className="bg-primary/60 rounded-full h-1" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices tab */}
        <TabsContent value="devices">
          <Card className="border-border/50">
            <CardHeader className="px-4 py-3">
              <CardTitle className="font-serif text-sm flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" /> Enheter
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {deviceData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Ingen data ännu</p>
              ) : (
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={deviceData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                          {deviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 flex-1">
                    {deviceData.map((d, i) => {
                      const pct = metrics.totalViews ? Math.round((d.value / metrics.totalViews) * 100) : 0;
                      return (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <DeviceIcon type={d.name} />
                            <span className="text-xs text-foreground capitalize">{d.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{pct}% ({d.value})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PWA tab */}
        <TabsContent value="pwa">
          <PwaInstallsCard period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
