import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, PiggyBank, BarChart3, ArrowUpRight, ArrowDownRight, Coins, Percent } from 'lucide-react';
import { motion } from 'framer-motion';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  date: string;
  category?: string;
  description?: string;
}

interface EggLog {
  id: string;
  date: string;
  count: number;
}

interface FinancialInsightsProps {
  transactions: Transaction[];
  eggs: EggLog[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function FinancialInsights({ transactions, eggs }: FinancialInsightsProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const insights = useMemo(() => {
    // Monthly data for current year
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const mStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
      const mTxns = transactions.filter(t => t.date?.startsWith(mStr));
      const income = mTxns.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
      const expense = mTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
      const mEggs = eggs.filter(e => e.date?.startsWith(mStr)).reduce((s, e) => s + (e.count || 0), 0);
      return { month: i, income, expense, profit: income - expense, eggs: mEggs };
    });

    // Year to date
    const ytdIncome = monthly.slice(0, currentMonth + 1).reduce((s, m) => s + m.income, 0);
    const ytdExpense = monthly.slice(0, currentMonth + 1).reduce((s, m) => s + m.expense, 0);
    const ytdProfit = ytdIncome - ytdExpense;

    // Previous year comparison
    const prevYearStr = `${currentYear - 1}`;
    const prevYearIncome = transactions
      .filter(t => t.type === 'income' && t.date?.startsWith(prevYearStr))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const prevYearExpense = transactions
      .filter(t => t.type === 'expense' && t.date?.startsWith(prevYearStr))
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    // Avg monthly income (from months with data)
    const monthsWithIncome = monthly.slice(0, currentMonth + 1).filter(m => m.income > 0);
    const avgMonthlyIncome = monthsWithIncome.length > 0
      ? monthsWithIncome.reduce((s, m) => s + m.income, 0) / monthsWithIncome.length
      : 0;

    const avgMonthlyExpense = monthly.slice(0, currentMonth + 1).length > 0
      ? ytdExpense / (currentMonth + 1)
      : 0;

    // Forecast: project remaining months using average
    const remainingMonths = 11 - currentMonth;
    const forecastIncome = ytdIncome + avgMonthlyIncome * remainingMonths;
    const forecastExpense = ytdExpense + avgMonthlyExpense * remainingMonths;
    const forecastProfit = forecastIncome - forecastExpense;

    // Profit margin
    const profitMargin = ytdIncome > 0 ? (ytdProfit / ytdIncome) * 100 : 0;

    // Cost per egg
    const ytdEggs = monthly.slice(0, currentMonth + 1).reduce((s, m) => s + m.eggs, 0);
    const costPerEgg = ytdEggs > 0 ? ytdExpense / ytdEggs : 0;
    const revenuePerEgg = ytdEggs > 0 ? ytdIncome / ytdEggs : 0;

    // Best & worst months
    const monthsWithData = monthly.slice(0, currentMonth + 1).filter(m => m.income > 0 || m.expense > 0);
    const bestMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((best, m) => m.profit > best.profit ? m : best, monthsWithData[0])
      : null;
    const worstMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((worst, m) => m.profit < worst.profit ? m : worst, monthsWithData[0])
      : null;

    // Category breakdown (expenses)
    const expenseByCat: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense' && t.date?.startsWith(`${currentYear}`))
      .forEach(t => {
        const cat = t.category || t.description || 'Övrigt';
        expenseByCat[cat] = (expenseByCat[cat] || 0) + Math.abs(t.amount);
      });
    const topExpenses = Object.entries(expenseByCat)
      .map(([name, total]) => ({ name, total, pct: ytdExpense > 0 ? (total / ytdExpense) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Income category breakdown
    const incomeByCat: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'income' && t.date?.startsWith(`${currentYear}`))
      .forEach(t => {
        const cat = t.category || t.description || 'Övrigt';
        incomeByCat[cat] = (incomeByCat[cat] || 0) + Math.abs(t.amount);
      });
    const topIncome = Object.entries(incomeByCat)
      .map(([name, total]) => ({ name, total, pct: ytdIncome > 0 ? (total / ytdIncome) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Month over month trend
    const thisMonthIncome = monthly[currentMonth]?.income || 0;
    const lastMonthIncome = currentMonth > 0 ? (monthly[currentMonth - 1]?.income || 0) : 0;
    const momChange = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : null;

    // Max for chart
    const maxMonthlyValue = Math.max(1, ...monthly.map(m => Math.max(m.income, m.expense)));

    return {
      monthly, ytdIncome, ytdExpense, ytdProfit,
      prevYearIncome, prevYearExpense,
      avgMonthlyIncome, avgMonthlyExpense,
      forecastIncome, forecastExpense, forecastProfit,
      profitMargin, costPerEgg, revenuePerEgg, ytdEggs,
      bestMonth, worstMonth,
      topExpenses, topIncome,
      momChange, thisMonthIncome, lastMonthIncome,
      maxMonthlyValue,
    };
  }, [transactions, eggs, currentYear, currentMonth]);

  const hasData = insights.ytdIncome > 0 || insights.ytdExpense > 0;

  if (!hasData) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-8 text-center">
          <span className="text-3xl mb-3 block">📊</span>
          <p className="text-sm text-muted-foreground">Logga intäkter och kostnader för att se finansiell analys och prognoser här.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          {
            icon: Coins, label: 'Intäkter i år',
            value: `${Math.round(insights.ytdIncome)} kr`,
            color: 'text-success', bg: 'bg-success/8',
          },
          {
            icon: PiggyBank, label: 'Resultat i år',
            value: `${insights.ytdProfit >= 0 ? '+' : ''}${Math.round(insights.ytdProfit)} kr`,
            color: insights.ytdProfit >= 0 ? 'text-success' : 'text-destructive',
            bg: insights.ytdProfit >= 0 ? 'bg-success/8' : 'bg-destructive/8',
          },
          {
            icon: Percent, label: 'Vinstmarginal',
            value: `${Math.round(insights.profitMargin)}%`,
            color: insights.profitMargin >= 0 ? 'text-primary' : 'text-destructive',
            bg: 'bg-primary/8',
          },
          {
            icon: Target, label: 'Prognos helår',
            value: `${insights.forecastProfit >= 0 ? '+' : ''}${Math.round(insights.forecastProfit)} kr`,
            color: insights.forecastProfit >= 0 ? 'text-success' : 'text-destructive',
            bg: insights.forecastProfit >= 0 ? 'bg-success/8' : 'bg-destructive/8',
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-border/50 shadow-sm">
            <CardContent className="p-3.5 text-center">
              <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center mx-auto mb-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="stat-number text-base sm:text-lg text-foreground">{value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MoM trend */}
      {insights.momChange !== null && (
        <div className="flex items-center gap-2 px-1">
          {insights.momChange > 0 ? (
            <ArrowUpRight className="h-4 w-4 text-success" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          )}
          <span className={`text-sm font-medium ${insights.momChange >= 0 ? 'text-success' : 'text-destructive'}`}>
            {insights.momChange > 0 ? '+' : ''}{Math.round(insights.momChange)}% intäkter vs förra månaden
          </span>
        </div>
      )}

      {/* Revenue & Expense Chart */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="px-4 sm:px-5 pb-2">
          <CardTitle className="font-serif text-base">Intäkter vs kostnader per månad</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-5">
          <div className="space-y-2">
            {insights.monthly.slice(0, currentMonth + 1).map((m) => (
              <div key={m.month} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-8 shrink-0 font-medium">{MONTH_NAMES[m.month]}</span>
                  <div className="flex-1 space-y-0.5">
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success/70 rounded-full transition-all duration-500"
                        style={{ width: `${(m.income / insights.maxMonthlyValue) * 100}%` }}
                      />
                    </div>
                    <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-destructive/50 rounded-full transition-all duration-500"
                        style={{ width: `${(m.expense / insights.maxMonthlyValue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right w-20 shrink-0">
                    <p className="text-[10px] font-semibold text-success tabular-nums">+{Math.round(m.income)}</p>
                    <p className="text-[10px] font-semibold text-destructive tabular-nums">-{Math.round(m.expense)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success/70" /> Intäkter</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-destructive/50" /> Kostnader</span>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Card */}
      <Card className="border-primary/15 bg-primary/3 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-primary" />
            <span className="font-serif text-sm text-foreground">Prognos {currentYear}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="stat-number text-lg text-success">{Math.round(insights.forecastIncome)} kr</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Intäkter</p>
            </div>
            <div>
              <p className="stat-number text-lg text-destructive">{Math.round(insights.forecastExpense)} kr</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kostnader</p>
            </div>
            <div>
              <p className={`stat-number text-lg ${insights.forecastProfit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {insights.forecastProfit >= 0 ? '+' : ''}{Math.round(insights.forecastProfit)} kr
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Resultat</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            Baserat på snitt {Math.round(insights.avgMonthlyIncome)} kr intäkter och {Math.round(insights.avgMonthlyExpense)} kr kostnader per månad
          </p>
        </CardContent>
      </Card>

      {/* Per-egg economics */}
      {insights.ytdEggs > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="px-4 sm:px-5 pb-2">
            <CardTitle className="font-serif text-base">🥚 Ekonomi per ägg</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="stat-number text-lg text-success">{insights.revenuePerEgg.toFixed(1)} kr</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Intäkt/ägg</p>
              </div>
              <div>
                <p className="stat-number text-lg text-destructive">{insights.costPerEgg.toFixed(1)} kr</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kostnad/ägg</p>
              </div>
              <div>
                <p className={`stat-number text-lg ${insights.revenuePerEgg - insights.costPerEgg >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {(insights.revenuePerEgg - insights.costPerEgg).toFixed(1)} kr
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vinst/ägg</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Baserat på {insights.ytdEggs} ägg hittills i år
            </p>
          </CardContent>
        </Card>
      )}

      {/* Category breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Top income categories */}
        {insights.topIncome.length > 0 && (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="font-serif text-sm flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-success" /> Intäktskällor
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {insights.topIncome.map(cat => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-foreground font-medium truncate mr-2">{cat.name}</span>
                      <span className="text-success tabular-nums shrink-0">{Math.round(cat.total)} kr ({Math.round(cat.pct)}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-success/60 rounded-full" style={{ width: `${cat.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top expense categories */}
        {insights.topExpenses.length > 0 && (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="px-4 pb-2">
              <CardTitle className="font-serif text-sm flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-destructive" /> Kostnadsposter
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {insights.topExpenses.map(cat => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-foreground font-medium truncate mr-2">{cat.name}</span>
                      <span className="text-destructive tabular-nums shrink-0">{Math.round(cat.total)} kr ({Math.round(cat.pct)}%)</span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-destructive/40 rounded-full" style={{ width: `${cat.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Best/worst month */}
      {(insights.bestMonth || insights.worstMonth) && (
        <div className="grid grid-cols-2 gap-2.5">
          {insights.bestMonth && (
            <Card className="border-success/20 shadow-sm">
              <CardContent className="p-3.5 text-center">
                <span className="text-lg">🏆</span>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">Bästa månad</p>
                <p className="font-serif text-sm text-foreground mt-0.5">{MONTH_NAMES[insights.bestMonth.month]}</p>
                <p className="stat-number text-sm text-success">+{Math.round(insights.bestMonth.profit)} kr</p>
              </CardContent>
            </Card>
          )}
          {insights.worstMonth && (
            <Card className="border-destructive/20 shadow-sm">
              <CardContent className="p-3.5 text-center">
                <span className="text-lg">📉</span>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">Svagaste månad</p>
                <p className="font-serif text-sm text-foreground mt-0.5">{MONTH_NAMES[insights.worstMonth.month]}</p>
                <p className={`stat-number text-sm ${insights.worstMonth.profit >= 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
                  {insights.worstMonth.profit >= 0 ? '+' : ''}{Math.round(insights.worstMonth.profit)} kr
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}
