import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, TrendingUp, TrendingDown, Coins, ShoppingCart, Minus, Users, Loader2, Trash2, Download, BarChart3, ReceiptText, ArrowRight } from 'lucide-react';
import { downloadCSV, downloadPDF } from '@/lib/exportUtils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PremiumGate } from '@/components/PremiumGate';
import FinancialInsights from '@/components/FinancialInsights';
import BudgetGoalsWidget from '@/components/BudgetGoalsWidget';
import { useQuery as useRQQuery } from '@tanstack/react-query';

const INCOME_CATEGORIES = [
  { value: 'egg_sales', label: 'Äggförsäljning' },
  { value: 'hen_sales', label: 'Sålt höna' },
  { value: 'rooster_sales', label: 'Sålt tupp' },
  { value: 'chick_sales', label: 'Sålt kycklingar' },
  { value: 'manure_sales', label: 'Sålt gödsel' },
  { value: 'other', label: 'Övrigt' },
];

const EXPENSE_CATEGORIES = [
  { value: 'feed', label: 'Foder' },
  { value: 'bedding', label: 'Strö & bäddmaterial' },
  { value: 'veterinary', label: 'Veterinär' },
  { value: 'medicine', label: 'Medicin & avmaskning' },
  { value: 'equipment', label: 'Utrustning & material' },
  { value: 'electricity', label: 'El & värme' },
  { value: 'coop_maintenance', label: 'Underhåll av hönshus' },
  { value: 'new_hens', label: 'Inköp av hönor/tuppar' },
  { value: 'other', label: 'Övrigt' },
];

export default function Finance() {
  const navigate = useNavigate();
  const [view, setView] = useState('overview');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ type: 'income', amount: '', description: '', category: '', customDescription: '', date: format(new Date(), 'yyyy-MM-dd') });
  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.getTransactions(),
  });

  const { data: eggs = [] } = useRQQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
    staleTime: 60_000,
  });

  const { data: coopSettings } = useRQQuery({
    queryKey: ['coop-settings'],
    queryFn: () => api.getCoopSettings(),
  });

  const budgetTarget = (coopSettings as any)?.settings?.budget_target ?? null;
  const incomeTarget = (coopSettings as any)?.settings?.income_target ?? null;

  const handleBudgetSave = async (costTarget: number | null, incTarget: number | null) => {
    const currentSettings = (coopSettings as any)?.settings || {};
    await api.updateCoopSettings({
      settings: { ...currentSettings, budget_target: costTarget, income_target: incTarget },
    });
    queryClient.invalidateQueries({ queryKey: ['coop-settings'] });
    toast({ title: 'Månadsmål sparade!' });
  };
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCategory = categories.find(c => c.value === form.category);
  const isOther = form.category === 'other';

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary-stats'] });
      setDialogOpen(false);
      setForm({ type: 'income', amount: '', description: '', category: '', customDescription: '', date: format(new Date(), 'yyyy-MM-dd') });
      toast({ title: 'Transaktion sparad!' });
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Transaktion borttagen' });
    },
  });

  const handleCategoryChange = (value: string) => {
    const cat = categories.find(c => c.value === value);
    if (value === 'other') {
      setForm({ ...form, category: value, description: '', customDescription: '' });
    } else {
      setForm({ ...form, category: value, description: cat?.label ?? '', customDescription: '' });
    }
  };

  const handleTypeChange = (value: string) => {
    setForm({ ...form, type: value, category: '', description: '', customDescription: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const description = isOther ? form.customDescription : form.description;
    if (!form.amount || !description || !form.category) return;
    createMutation.mutate({
      type: form.type,
      amount: parseFloat(form.amount),
      description,
      category: isOther ? form.customDescription : (selectedCategory?.label ?? form.category),
      date: form.date,
    });
  };

  const now = new Date();
  const currentMonth = now.getMonth();

  const monthIncome = transactions
    .filter((t: any) => t.type === 'income' && new Date(t.date).getMonth() === currentMonth)
    .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  const monthExpense = transactions
    .filter((t: any) => t.type === 'expense' && new Date(t.date).getMonth() === currentMonth)
    .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);

  const net = monthIncome - monthExpense;

  const customerMap: Record<string, { total: number; orders: number }> = {};
  transactions.filter((t: any) => t.type === 'income' && t.category).forEach((t: any) => {
    const key = t.category;
    if (!customerMap[key]) customerMap[key] = { total: 0, orders: 0 };
    customerMap[key].total += Math.abs(t.amount);
    customerMap[key].orders += 1;
  });
  const customerSales = Object.entries(customerMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const handleExportCSV = () => {
    const rows = transactions.map((t: any) => ({
      Datum: t.date,
      Typ: t.type === 'income' ? 'Intäkt' : 'Kostnad',
      Kategori: t.category || '',
      Beskrivning: t.description || '',
      Belopp: t.amount,
    }));
    downloadCSV(rows, `ekonomi-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    downloadPDF(
      'Ekonomi – Transaktioner',
      ['Datum', 'Typ', 'Kategori', 'Beskrivning', 'Belopp (kr)'],
      transactions.map((t: any) => [
        t.date,
        t.type === 'income' ? 'Intäkt' : 'Kostnad',
        t.category || '',
        t.description || '',
        String(t.amount),
      ]),
      'ekonomi'
    );
  };

  return (
    <PremiumGate feature="Ekonomi" featureKey="finance" preview>
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Ekonomi 💰</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Intäkter, kostnader och netto</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPDF}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 active:scale-95 transition-transform flex-1 sm:flex-initial">
                  <Plus className="h-4 w-4" />
                  Ny transaktion
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-serif">Ny transaktion</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Typ</Label>
                    <Select value={form.type} onValueChange={handleTypeChange}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Intäkt</SelectItem>
                        <SelectItem value="expense">Kostnad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kategori</Label>
                    <Select value={form.category} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Välj kategori..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isOther && (
                    <div>
                      <Label>Beskrivning</Label>
                      <Input className="mt-1.5" value={form.customDescription} onChange={(e) => setForm({ ...form, customDescription: e.target.value })} placeholder="Beskriv transaktionen..." required />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Belopp (kr)</Label>
                      <Input className="mt-1.5" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                    <div>
                      <Label>Datum</Label>
                      <Input className="mt-1.5" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.category}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Spara transaktion
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-card to-accent/5 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <ReceiptText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="data-label mb-1">Ny modul</p>
                <h2 className="font-serif text-lg text-foreground">Sälj ägg och håll koll på betalningar</h2>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">Perfekt när grannar, kollegor eller familj köper ägg. Synkar mellan mobil och dator.</p>
              </div>
            </div>
            <Button className="rounded-xl gap-2 w-full sm:w-auto" onClick={() => navigate('/app/egg-sales')}>
              Öppna Sälj ägg<ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="overview">Översikt</TabsTrigger>
            <TabsTrigger value="insights" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Analys
            </TabsTrigger>
            <TabsTrigger value="customers">Kategorier</TabsTrigger>
          </TabsList>
        </Tabs>

        {view === 'insights' ? (
          <FinancialInsights transactions={transactions as any} eggs={eggs as any} />
        ) : view === 'overview' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card className="bg-card border-border border-l-4 border-l-success shadow-sm animate-fade-in hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" style={{ animationDelay: '0ms', animationFillMode: 'backwards' }}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-4 w-4 text-success" />
                    <span className="data-label">Intäkter</span>
                  </div>
                  <p className="stat-number text-xl sm:text-2xl text-foreground">{monthIncome} kr</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border border-l-4 border-l-destructive shadow-sm animate-fade-in hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" style={{ animationDelay: '70ms', animationFillMode: 'backwards' }}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Minus className="h-4 w-4 text-destructive" />
                    <span className="data-label">Kostnader</span>
                  </div>
                  <p className="stat-number text-xl sm:text-2xl text-foreground">{monthExpense} kr</p>
                </CardContent>
              </Card>
            <Card className="bg-card border-border border-l-4 border-l-primary shadow-sm animate-fade-in hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" style={{ animationDelay: '140ms', animationFillMode: 'backwards' }}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="h-4 w-4 text-primary" />
                    <span className="data-label">Netto</span>
                  </div>
                  <p className={`stat-number text-xl sm:text-2xl ${net >= 0 ? 'text-success' : 'text-destructive'}`}>{net} kr</p>
                </CardContent>
              </Card>
            </div>

            <BudgetGoalsWidget
              monthExpense={monthExpense}
              monthIncome={monthIncome}
              budgetTarget={budgetTarget}
              incomeTarget={incomeTarget}
              onSave={handleBudgetSave}
            />

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="font-serif text-base sm:text-lg">Senaste transaktioner</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {transactions.slice(0, 20).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-secondary/50 transition-colors group">
                      <div className="min-w-0 mr-3">
                        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{t.description}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {t.date}{t.category && ` · ${t.category}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`stat-number text-sm sm:text-base shrink-0 ${t.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {t.type === 'income' ? '+' : '-'}{Math.abs(t.amount)} kr
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground text-sm">Inga transaktioner ännu</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="font-serif text-base sm:text-lg flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Per kategori
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {customerSales.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 hover:bg-secondary/50 transition-colors">
                    <span className="stat-number text-lg w-6 text-center text-muted-foreground">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground truncate">{c.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{c.orders} transaktioner</p>
                    </div>
                    <span className="stat-number text-sm text-success shrink-0">+{c.total} kr</span>
                  </div>
                ))}
                {customerSales.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-sm">Inga kategorier registrerade ännu</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PremiumGate>
  );
}
