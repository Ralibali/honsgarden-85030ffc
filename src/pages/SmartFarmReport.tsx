import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import PlusFeatureGate from '@/components/PlusFeatureGate';
import { ArrowRight, Bell, Bird, CalendarDays, CheckCircle2, Copy, Egg, ReceiptText, Sparkles, TrendingDown, TrendingUp, Wallet, Wheat } from 'lucide-react';

function startOfWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day + 1);
  return date;
}

function previousWeekStart() {
  const date = startOfWeek();
  date.setDate(date.getDate() - 7);
  return date;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function kr(value: unknown) {
  return `${Math.round(Number(value || 0))} kr`;
}

function copyText(text: string, label = 'Texten') {
  navigator.clipboard?.writeText(text);
  toast({ title: `${label} är kopierad` });
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

function SmartFarmReportContent() {
  const navigate = useNavigate();
  const weekStart = startOfWeek();
  const prevStart = previousWeekStart();
  const today = new Date();
  const weekLabel = `${weekStart.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} – ${today.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`;

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs().catch(() => []) });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens().catch(() => []) });
  const { data: feedStats } = useQuery({ queryKey: ['feed-stats'], queryFn: () => api.getFeedStatistics().catch(() => null) });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores().catch(() => []) });

  const { data: listings = [] } = useQuery({
    queryKey: ['smart-report-listings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any).from('public_egg_sale_listings').select('*').eq('user_id', userId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['smart-report-bookings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any).from('public_egg_sale_bookings').select('*').eq('seller_user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const report = useMemo(() => {
    const currentWeekStart = iso(weekStart);
    const prevWeekStart = iso(prevStart);
    const prevWeekEnd = iso(new Date(weekStart.getTime() - 86400000));
    const weekEggs = (eggs as any[]).filter((e) => e.date >= currentWeekStart).reduce((s, e) => s + Number(e.count || 0), 0);
    const prevWeekEggs = (eggs as any[]).filter((e) => e.date >= prevWeekStart && e.date <= prevWeekEnd).reduce((s, e) => s + Number(e.count || 0), 0);
    const diff = weekEggs - prevWeekEggs;
    const activeHens = (hens as any[]).filter((h) => h.is_active !== false).length;
    const completedTasks = (chores as any[]).filter((c) => c.completed).length;
    const totalTasks = (chores as any[]).length;
    const listingById: Record<string, any> = {};
    (listings as any[]).forEach((l) => { listingById[l.id] = l; });
    const activeBookings = (bookings as any[]).filter((b) => b.status !== 'cancelled');
    const weekBookings = activeBookings.filter((b) => b.created_at && new Date(b.created_at) >= weekStart);
    const salesValue = weekBookings.reduce((sum, b) => sum + Number(b.packs || 0) * Number(listingById[b.listing_id]?.price_per_pack || 0), 0);
    const salesPacks = weekBookings.reduce((sum, b) => sum + Number(b.packs || 0), 0);
    const activeListings = (listings as any[]).filter((l) => l.is_active !== false && !l.sold_out_manually).length;
    const feedCostPerEgg = (feedStats as any)?.cost_per_egg || null;
    const insights: string[] = [];
    if (weekEggs === 0) insights.push('Börja med att logga veckans första ägg så kan rapporten hitta riktiga mönster.');
    else if (diff > 0) insights.push(`Äggproduktionen är upp ${diff} ägg mot förra veckan. Det är ett fint tecken på stabil flockrytm.`);
    else if (diff < 0) insights.push(`Äggproduktionen är ner ${Math.abs(diff)} ägg mot förra veckan. Kolla väder, ruggning, foderbyte och stress.`);
    else insights.push('Äggproduktionen ligger stabilt mot förra veckan. Stabilitet är också ett bra tecken.');
    if (feedCostPerEgg) insights.push(`Din ungefärliga foderkostnad är ${Number(feedCostPerEgg).toFixed(2)} kr per ägg.`);
    if (salesValue > 0) insights.push(`Agdas Bod har gett cirka ${kr(salesValue)} i bokningsvärde denna vecka.`);
    if (totalTasks > 0) insights.push(`${completedTasks} av ${totalTasks} uppgifter är avklarade. Rutinerna är det som gör hönsgården enklare över tid.`);
    return { weekEggs, prevWeekEggs, diff, activeHens, completedTasks, totalTasks, salesValue, salesPacks, activeListings, weekBookings: weekBookings.length, feedCostPerEgg, insights };
  }, [eggs, hens, chores, feedStats, bookings, listings, weekStart, prevStart]);

  const plainReport = `Smart gårdsrapport – ${weekLabel}\n\n🥚 Ägg denna vecka: ${report.weekEggs}\n${report.diff >= 0 ? '📈' : '📉'} Skillnad mot förra veckan: ${report.diff >= 0 ? '+' : ''}${report.diff}\n🐔 Aktiva hönor: ${report.activeHens}\n🌾 Foderkostnad/ägg: ${report.feedCostPerEgg ? Number(report.feedCostPerEgg).toFixed(2) + ' kr' : 'saknas'}\n💰 Agdas Bod denna vecka: ${kr(report.salesValue)} (${report.salesPacks} kartor)\n✅ Uppgifter: ${report.completedTasks}/${report.totalTasks}\n\nAgdas rekommendationer:\n${report.insights.map((i) => `• ${i}`).join('\n')}`;
  const actions = [
    { title: 'Logga ägg', text: 'Fyll på rapporten med aktuell produktion.', path: '/app/eggs', icon: Egg, show: report.weekEggs === 0 },
    { title: 'Lägg till foder', text: 'Räkna ut kostnad per ägg.', path: '/app/feed', icon: Wheat, show: !report.feedCostPerEgg },
    { title: 'Öppna Agdas Bod', text: 'Sälj överskott och följ bokningar.', path: '/app/egg-sales', icon: ReceiptText, show: report.activeListings === 0 || report.salesValue === 0 },
    { title: 'Skapa uppgift', text: 'Bygg återkommande rutiner.', path: '/app/tasks', icon: Bell, show: report.totalTasks === 0 },
  ].filter((a) => a.show).slice(0, 3);

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div><p className="data-label mb-1">SaaS-rapport</p><h1 className="text-2xl sm:text-3xl font-serif text-foreground">Smart gårdsrapport ✨</h1><p className="text-sm text-muted-foreground mt-1">{weekLabel} · ägg, flock, foder, uppgifter och Agdas Bod i samma överblick.</p></div>
        <Button className="rounded-xl gap-2" onClick={() => copyText(plainReport, 'Gårdsrapporten')}><Copy className="h-4 w-4" /> Kopiera rapport</Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={Egg} label="Ägg denna vecka" value={report.weekEggs} sub={`${report.diff >= 0 ? '+' : ''}${report.diff} mot förra veckan`} trend={report.diff} />
        <Metric icon={Bird} label="Aktiva hönor" value={report.activeHens} sub="i flocken" />
        <Metric icon={Wallet} label="Agdas Bod" value={kr(report.salesValue)} sub={`${report.salesPacks} kartor · ${report.weekBookings} bokningar`} />
        <Metric icon={CheckCircle2} label="Uppgifter" value={`${report.completedTasks}/${report.totalTasks}`} sub="avklarade rutiner" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 border-primary/20 bg-gradient-to-br from-primary/8 via-card to-accent/5 shadow-sm"><CardContent className="p-4 sm:p-5 space-y-4"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><h2 className="font-serif text-lg text-foreground">Agdas smarta sammanfattning</h2></div><div className="space-y-3">{report.insights.map((insight, index) => <div key={index} className="rounded-2xl border bg-background/70 p-4 text-sm leading-relaxed text-foreground">{insight}</div>)}</div></CardContent></Card>
        <Card className="shadow-sm"><CardContent className="p-4 sm:p-5 space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="font-serif text-lg text-foreground">Nästa bästa steg</h2><Badge variant="secondary">Smart</Badge></div>{actions.length === 0 ? <div className="rounded-2xl border border-success/20 bg-success/5 p-4"><p className="font-medium text-sm text-foreground">Bra jobbat!</p><p className="text-xs text-muted-foreground mt-1">Du har redan fyllt rapporten med bra data den här veckan.</p></div> : actions.map((action) => <button key={action.title} onClick={() => navigate(action.path)} className="w-full rounded-2xl border bg-card hover:bg-muted/30 p-3 text-left flex items-center gap-3 transition-colors"><div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><action.icon className="h-4 w-4 text-primary" /></div><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{action.title}</p><p className="text-xs text-muted-foreground">{action.text}</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></button>)}</CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><MiniPanel icon={Wheat} title="Foder" value={report.feedCostPerEgg ? `${Number(report.feedCostPerEgg).toFixed(2)} kr/ägg` : 'Saknas'} text="Lägg in foderköp för att göra rapporten mer ekonomisk." /><MiniPanel icon={ReceiptText} title="Säljsidor" value={report.activeListings} text="Aktiva säljsidor i Agdas Bod just nu." /><MiniPanel icon={CalendarDays} title="Veckorytm" value={report.weekEggs > 0 ? 'Igång' : 'Starta'} text="Rapporten blir starkare när du loggar lite varje vecka." /></div>
    </div>
  );
}

export default function SmartFarmReport() {
  useEffect(() => { document.title = 'Smart gårdsrapport | Hönsgården'; }, []);
  return <PlusFeatureGate title="Lås upp Smart gårdsrapport" description="Smart rapport binder ihop ägg, hönor, foder, uppgifter och Agdas Bod till en tydlig veckosammanfattning med nästa bästa steg." featureName="Plus-funktion"><SmartFarmReportContent /></PlusFeatureGate>;
}

function Metric({ icon: Icon, label, value, sub, trend }: { icon: any; label: string; value: string | number; sub: string; trend?: number }) {
  const TrendIcon = trend === undefined ? null : trend >= 0 ? TrendingUp : TrendingDown;
  return <Card className="shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><Icon className="h-4 w-4 text-primary" />{TrendIcon && <TrendIcon className={`h-4 w-4 ${trend >= 0 ? 'text-success' : 'text-destructive'}`} />}</div><p className="text-2xl font-bold text-foreground tabular-nums">{value}</p><p className="data-label text-[10px] mt-1">{label}</p><p className="text-xs text-muted-foreground mt-1">{sub}</p></CardContent></Card>;
}

function MiniPanel({ icon: Icon, title, value, text }: { icon: any; title: string; value: string | number; text: string }) {
  return <Card className="border-border/60 shadow-sm"><CardContent className="p-4 flex gap-3"><div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-primary" /></div><div><p className="text-xs text-muted-foreground">{title}</p><p className="font-semibold text-foreground">{value}</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p></div></CardContent></Card>;
}
