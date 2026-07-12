import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Egg, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, Coins, Package, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PremiumGate } from '@/components/PremiumGate';
import { motion } from 'framer-motion';

const MONTH_NAMES = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

export default function Overview() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [view, setView] = useState<'year' | 'month'>('year');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => api.getTransactions(), staleTime: 60_000 });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });

  const yearData = useMemo(() => {
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mStr = `${year}-${String(m).padStart(2, '0')}`;
      const monthEggs = (eggs as any[]).filter(e => e.date?.startsWith(mStr));
      const monthTxns = (transactions as any[]).filter(t => t.date?.startsWith(mStr));
      const monthFeed = (feedRecords as any[]).filter(f => f.date?.startsWith(mStr));
      const eggCount = monthEggs.reduce((s, e) => s + (e.count || 0), 0);
      const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const feedCost = monthFeed.reduce((s, f) => s + (f.cost || 0), 0);
      return { month: m, name: MONTH_NAMES[i], eggs: eggCount, income, expense, feedCost, profit: income - expense };
    });

    const totalEggs = monthly.reduce((s, m) => s + m.eggs, 0);
    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
    const totalFeedCost = monthly.reduce((s, m) => s + m.feedCost, 0);
    const maxEggs = Math.max(1, ...monthly.map(m => m.eggs));

    // Compare to previous year
    const prevYearEggs = (eggs as any[])
      .filter(e => e.date?.startsWith(`${year - 1}`))
      .reduce((s, e) => s + (e.count || 0), 0);
    const yoyChange = prevYearEggs > 0 ? ((totalEggs - prevYearEggs) / prevYearEggs * 100) : null;

    return { monthly, totalEggs, totalIncome, totalExpense, totalFeedCost, maxEggs, yoyChange };
  }, [eggs, transactions, feedRecords, year]);

  const monthData = useMemo(() => {
    const mStr = `${year}-${String(selectedMonth).padStart(2, '0')}`;
    const monthEggs = (eggs as any[]).filter(e => e.date?.startsWith(mStr));
    const daysInMonth = new Date(year, selectedMonth, 0).getDate();

    const daily = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayStr = `${mStr}-${String(day).padStart(2, '0')}`;
      const count = monthEggs.filter(e => e.date === dayStr).reduce((s, e) => s + (e.count || 0), 0);
      return { day, count };
    });

    const totalEggs = daily.reduce((s, d) => s + d.count, 0);
    const activeDays = daily.filter(d => d.count > 0).length;
    const maxDay = Math.max(1, ...daily.map(d => d.count));
    const avgPerDay = activeDays > 0 ? (totalEggs / daysInMonth).toFixed(1) : '0';
    const bestDay = daily.reduce((best, d) => d.count > best.count ? d : best, { day: 0, count: 0 });

    // Previous month comparison
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? year - 1 : year;
    const prevStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevEggs = (eggs as any[]).filter(e => e.date?.startsWith(prevStr)).reduce((s, e) => s + (e.count || 0), 0);
    const momChange = prevEggs > 0 ? ((totalEggs - prevEggs) / prevEggs * 100) : null;

    return { daily, totalEggs, activeDays, maxDay, avgPerDay, bestDay, momChange };
  }, [eggs, year, selectedMonth]);

  const activeHens = (hens as any[]).filter(h => h.is_active).length;

  return (
    <PremiumGate feature="Översikt" blur>
      <motion.div
        className="max-w-3xl mx-auto space-y-5 pb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Översikt 📊</h1>
            <p className="text-sm text-muted-foreground mt-1">Trender och sammanfattningar</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(y => y - 1)} aria-label="Föregående år">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="text-sm font-semibold text-foreground tabular-nums min-w-[48px] text-center" aria-live="polite">{year}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear(y => y + 1)} disabled={year >= now.getFullYear()} aria-label="Nästa år">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex gap-2">
          <Button
            variant={view === 'year' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs h-8"
            onClick={() => setView('year')}
          >
            Årsöversikt
          </Button>
          <Button
            variant={view === 'month' ? 'default' : 'outline'}
            size="sm"
            className="rounded-xl text-xs h-8"
            onClick={() => setView('month')}
          >
            Månadsvy
          </Button>
        </div>

        {view === 'year' ? (
          <>
            {/* Year summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { icon: Egg, label: 'Ägg totalt', value: yearData.totalEggs, color: 'text-primary', bg: 'bg-primary/8' },
                { icon: Coins, label: 'Nettoresultat', value: `${yearData.totalIncome - yearData.totalExpense >= 0 ? '+' : ''}${Math.round(yearData.totalIncome - yearData.totalExpense)} kr`, color: yearData.totalIncome - yearData.totalExpense >= 0 ? 'text-success' : 'text-destructive', bg: yearData.totalIncome - yearData.totalExpense >= 0 ? 'bg-success/8' : 'bg-destructive/8' },
                { icon: Package, label: 'Foderkostnad', value: `${Math.round(yearData.totalFeedCost)} kr`, color: 'text-warning', bg: 'bg-warning/8' },
                { icon: Calendar, label: 'Snitt/mån', value: Math.round(yearData.totalEggs / 12), color: 'text-muted-foreground', bg: 'bg-muted/60' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <Card key={label} className="border-border/50 shadow-sm">
                  <CardContent className="p-3.5 text-center">
                    <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <p className="stat-number text-lg text-foreground">{value}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {yearData.yoyChange !== null && (
              <div className="flex items-center gap-2 px-1">
                {yearData.yoyChange > 0 ? <TrendingUp className="h-4 w-4 text-success" /> : yearData.yoyChange < 0 ? <TrendingDown className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4 text-muted-foreground" />}
                <span className={`text-sm font-medium ${yearData.yoyChange > 0 ? 'text-success' : yearData.yoyChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {yearData.yoyChange > 0 ? '+' : ''}{Math.round(yearData.yoyChange)}% jämfört med {year - 1}
                </span>
              </div>
            )}

            {/* Monthly bar chart */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="px-4 sm:px-5 pb-2">
                <CardTitle className="font-serif text-base">Ägg per månad</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-5 pb-5">
                <div className="space-y-2">
                  {yearData.monthly.map(m => (
                    <button
                      key={m.month}
                      className="w-full flex items-center gap-2 group hover:bg-muted/30 rounded-lg p-1 -mx-1 transition-colors"
                      onClick={() => { setSelectedMonth(m.month); setView('month'); }}
                    >
                      <span className="text-[11px] text-muted-foreground w-8 shrink-0 font-medium">{m.name.slice(0, 3)}</span>
                      <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded-full transition-all duration-500 group-hover:bg-primary"
                          style={{ width: `${(m.eggs / yearData.maxEggs) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground tabular-nums w-10 text-right">{m.eggs}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Yearly financial summary */}
            {(yearData.totalIncome > 0 || yearData.totalExpense > 0) && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="px-4 sm:px-5 pb-2">
                  <CardTitle className="font-serif text-base">💰 Ekonomisk sammanfattning</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-5 pb-5">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="stat-number text-lg text-success">{Math.round(yearData.totalIncome)} kr</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Intäkter</p>
                    </div>
                    <div>
                      <p className="stat-number text-lg text-destructive">{Math.round(yearData.totalExpense)} kr</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Utgifter</p>
                    </div>
                    <div>
                      <p className={`stat-number text-lg ${yearData.totalIncome - yearData.totalExpense >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {Math.round(yearData.totalIncome - yearData.totalExpense)} kr
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Resultat</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <>
            {/* Month selector */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                if (selectedMonth === 1) { setSelectedMonth(12); setYear(y => y - 1); }
                else setSelectedMonth(m => m - 1);
              }}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold text-foreground min-w-[100px] text-center">
                {MONTH_NAMES[selectedMonth - 1]} {year}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                if (selectedMonth === 12) { setSelectedMonth(1); setYear(y => y + 1); }
                else setSelectedMonth(m => m + 1);
              }} disabled={year >= now.getFullYear() && selectedMonth >= now.getMonth() + 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Month summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Totalt ägg', value: monthData.totalEggs },
                { label: 'Snitt/dag', value: monthData.avgPerDay },
                { label: 'Aktiva dagar', value: monthData.activeDays },
                { label: 'Bästa dag', value: monthData.bestDay.count > 0 ? `${monthData.bestDay.count} (d. ${monthData.bestDay.day})` : '–' },
              ].map(s => (
                <Card key={s.label} className="border-border/50 shadow-sm">
                  <CardContent className="p-3 text-center">
                    <p className="stat-number text-lg text-foreground">{s.value}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {monthData.momChange !== null && (
              <div className="flex items-center gap-2 px-1">
                {monthData.momChange > 0 ? <TrendingUp className="h-4 w-4 text-success" /> : monthData.momChange < 0 ? <TrendingDown className="h-4 w-4 text-destructive" /> : <Minus className="h-4 w-4 text-muted-foreground" />}
                <span className={`text-sm font-medium ${monthData.momChange > 0 ? 'text-success' : monthData.momChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {monthData.momChange > 0 ? '+' : ''}{Math.round(monthData.momChange)}% jämfört med förra månaden
                </span>
              </div>
            )}

            {/* Daily bar chart */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="px-4 sm:px-5 pb-2">
                <CardTitle className="font-serif text-base">Ägg per dag</CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-5 pb-5">
                <div className="flex items-end gap-[2px] h-32">
                  {monthData.daily.map(d => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className="w-full bg-primary/60 rounded-t-sm transition-all duration-300 min-h-[2px]"
                        style={{ height: `${d.count > 0 ? Math.max(8, (d.count / monthData.maxDay) * 100) : 2}%` }}
                        title={`Dag ${d.day}: ${d.count} ägg`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[9px] text-muted-foreground">1</span>
                  <span className="text-[9px] text-muted-foreground">{Math.floor(monthData.daily.length / 2)}</span>
                  <span className="text-[9px] text-muted-foreground">{monthData.daily.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Productivity estimate */}
            {activeHens > 0 && monthData.totalEggs > 0 && (
              <Card className="border-primary/15 bg-primary/3 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🐔</span>
                    <span className="font-serif text-sm text-foreground">Produktivitet</span>
                  </div>
                  <p className="text-sm text-foreground">
                    Med <strong>{activeHens}</strong> hönor producerade du <strong>{monthData.totalEggs} ägg</strong> denna månad – 
                    det är <strong>{(monthData.totalEggs / activeHens).toFixed(1)} ägg per höna</strong>.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </motion.div>
    </PremiumGate>
  );
}
