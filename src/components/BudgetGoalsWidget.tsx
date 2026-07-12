import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Target, Pencil, Check, X, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface BudgetGoalsWidgetProps {
  monthExpense: number;
  monthIncome: number;
  budgetTarget: number | null;
  incomeTarget: number | null;
  onSave: (costTarget: number | null, incomeTarget: number | null) => void;
}

export default function BudgetGoalsWidget({ monthExpense, monthIncome, budgetTarget, incomeTarget, onSave }: BudgetGoalsWidgetProps) {
  const [editing, setEditing] = useState(false);
  const [costVal, setCostVal] = useState(budgetTarget?.toString() ?? '');
  const [incomeVal, setIncomeVal] = useState(incomeTarget?.toString() ?? '');

  const handleSave = () => {
    const c = costVal ? parseFloat(costVal) : null;
    const i = incomeVal ? parseFloat(incomeVal) : null;
    onSave(c, i);
    setEditing(false);
  };

  const handleCancel = () => {
    setCostVal(budgetTarget?.toString() ?? '');
    setIncomeVal(incomeTarget?.toString() ?? '');
    setEditing(false);
  };

  if (!budgetTarget && !incomeTarget && !editing) {
    return (
      <Card className="bg-card border-border border-dashed shadow-sm">
        <CardContent className="p-4 sm:p-5 text-center">
          <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Sätt månadsmål för att jämföra mot utfall</p>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Sätt mål
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6 pb-2">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Månadsmål
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-3">
          <div>
            <Label className="text-xs">Max kostnader (kr/mån)</Label>
            <Input type="number" min="0" step="1" value={costVal} onChange={e => setCostVal(e.target.value)} placeholder="t.ex. 2000" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Intäktsmål (kr/mån)</Label>
            <Input type="number" min="0" step="1" value={incomeVal} onChange={e => setIncomeVal(e.target.value)} placeholder="t.ex. 3000" className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="gap-1.5 flex-1">
              <Check className="h-3.5 w-3.5" /> Spara
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const costPct = budgetTarget ? Math.min(100, (monthExpense / budgetTarget) * 100) : 0;
  const incomePct = incomeTarget ? Math.min(100, (monthIncome / incomeTarget) * 100) : 0;
  const costOver = budgetTarget ? monthExpense > budgetTarget : false;
  const incomeReached = incomeTarget ? monthIncome >= incomeTarget : false;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Månadsmål
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)} aria-label="Redigera månadsmål">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-4">
        {budgetTarget != null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                {costOver ? <AlertTriangle className="h-3 w-3 text-destructive" /> : <TrendingDown className="h-3 w-3 text-success" />}
                Kostnader
              </span>
              <span className={`font-medium ${costOver ? 'text-destructive' : 'text-foreground'}`}>
                {monthExpense} / {budgetTarget} kr
              </span>
            </div>
            <Progress value={costPct} className={`h-2 ${costOver ? '[&>div]:bg-destructive' : ''}`} />
            {costOver && (
              <p className="text-[10px] text-destructive">⚠️ Du har överskridit budgeten med {monthExpense - budgetTarget} kr</p>
            )}
          </div>
        )}
        {incomeTarget != null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                {incomeReached ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingUp className="h-3 w-3 text-muted-foreground" />}
                Intäkter
              </span>
              <span className={`font-medium ${incomeReached ? 'text-success' : 'text-foreground'}`}>
                {monthIncome} / {incomeTarget} kr
              </span>
            </div>
            <Progress value={incomePct} className={`h-2 ${incomeReached ? '[&>div]:bg-success' : ''}`} />
            {incomeReached && (
              <p className="text-[10px] text-success">🎉 Intäktsmålet uppnått!</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
