import React, { useState, useMemo, useRef } from 'react';
import { eggLogValidationError } from '@/lib/eggLogValidation';
import { localCalendarDate, todayLocal } from '@/lib/datetime';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Minus, Plus, ShieldAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveKarens } from '@/hooks/useActiveKarens';
import type { Flock, Hen } from '@/lib/api';

interface EggFormProps {
  activeHens: Hen[];
  flocks: Flock[];
  isPending: boolean;
  onSubmit: (data: { date: string; count: number; hen_id?: string; flock_id?: string }) => void;
  onCancel: () => void;
  initialDate?: string;
}

const QUICK_COUNTS = [1, 2, 3, 4, 5, 6, 8, 10] as const;

export function EggForm({ activeHens, flocks, isPending, onSubmit, onCancel, initialDate }: EggFormProps) {
  const [date, setDate] = useState(initialDate ?? todayLocal());
  const dateRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const [selectedHenId, setSelectedHenId] = useState<string>('all');
  const { data: karens = [] } = useActiveKarens();

  const activeKarensForSelection = useMemo(() => {
    if (!karens.length) return [];
    const isFlock = selectedHenId.startsWith('flock:');
    const flockId = isFlock ? selectedHenId.replace('flock:', '') : undefined;
    const henId = !isFlock && selectedHenId !== 'all' ? selectedHenId : undefined;
    const henFlock = henId ? activeHens.find((h) => h.id === henId)?.flock_id : undefined;
    return karens.filter(k => {
      if (henId && k.hen_id === henId) return true;
      if (flockId && k.flock_id === flockId) return true;
      if (henFlock && k.flock_id === henFlock) return true;
      // "Alla" eller höna utan flock → visa karens som gäller hela besättningen
      if (selectedHenId === 'all' && !k.hen_id && !k.flock_id) return true;
      return false;
    });
  }, [karens, selectedHenId, activeHens]);

  const increment = () => setCount((current) => Math.min((Number.isFinite(current) ? current : 0) + 1, 999));
  const decrement = () => setCount((current) => Math.max((Number.isFinite(current) ? current : 0) - 1, 0));

  const handleSubmit = () => {
    if (isPending || eggLogValidationError(date, count)) return;
    const isFlockSelection = selectedHenId.startsWith('flock:');
    const hen_id = !isFlockSelection && selectedHenId !== 'all' ? selectedHenId : undefined;
    const flock_id = isFlockSelection ? selectedHenId.replace('flock:', '') : undefined;
    onSubmit({ date, count, hen_id, flock_id });
  };

  return (
    <Card className="egg-log-composer bg-card border-border animate-fade-in shadow-sm overflow-hidden">
      <CardContent className="p-4 sm:p-6 space-y-5">
        <div className="egg-log-composer__intro">
          <p className="data-label mb-1">Logga ägg</p>
          <h3 className="font-serif text-xl sm:text-2xl text-foreground">Hur många hittade du?</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Glömt en dag? Välj datumet då äggen samlades in och ange antalet.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="egg-log-date" className="data-label block">Datum</label>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant={date === todayLocal() ? 'default' : 'outline'} disabled={isPending} onClick={() => setDate(todayLocal())}>Idag</Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => {
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              setDate(localCalendarDate(yesterday, Intl.DateTimeFormat().resolvedOptions().timeZone));
            }}>Igår</Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => {
              dateRef.current?.focus();
              dateRef.current?.showPicker?.();
            }}>Välj datum</Button>
          </div>
          <Input ref={dateRef} id="egg-log-date" type="date" value={date} max={todayLocal()} disabled={isPending} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
        </div>

        <div className="egg-counter rounded-2xl bg-primary/5 border border-primary/15 p-4 sm:p-5 text-center">
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="egg-counter__step h-12 w-12 rounded-2xl active:scale-95"
              onClick={decrement}
              disabled={count <= 0 || isPending}
              aria-label="Minska antal ägg"
            >
              <Minus className="h-5 w-5" />
            </Button>

            <div className="min-w-[120px]">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                disabled={isPending}
                value={Number.isNaN(count) ? '' : count}
                onChange={(e) => setCount(e.target.value === '' ? NaN : Number(e.target.value))}
                className="egg-counter__input h-16 text-center text-4xl font-bold rounded-2xl bg-background"
                aria-label="Antal ägg"
              />
              <p className="text-xs text-muted-foreground mt-1">ägg</p>
            </div>

            <Button
              type="button"
              size="icon"
              className="egg-counter__step egg-counter__step--plus h-12 w-12 rounded-2xl active:scale-95"
              onClick={increment}
              disabled={isPending}
              aria-label="Öka antal ägg"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>

          <div className="egg-quick-counts mt-4" aria-label="Snabbval antal ägg">
            <p className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground mb-2">Snabbval</p>
            <div className="grid grid-cols-8 gap-1.5">
              {QUICK_COUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCount(value)}
                  disabled={isPending}
                  aria-pressed={count === value}
                  className={`egg-quick-count rounded-xl min-h-9 text-xs font-semibold tabular-nums transition-all active:scale-95 ${
                    count === value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-background/65 text-foreground border border-border/50 hover:border-primary/30'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="egg-log-details grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {(activeHens.length > 0 || flocks.length > 0) && (
            <div>
              <label className="data-label mb-1.5 block">Flock / höna <span className="text-muted-foreground normal-case">(valfritt)</span></label>
              <Select disabled={isPending} value={selectedHenId} onValueChange={setSelectedHenId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Alla (generellt)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🥚 Alla (generellt)</SelectItem>
                  {flocks.map((flock) => {
                    const flockHens = activeHens.filter((h) => h.flock_id === flock.id);
                    return (
                      <SelectItem key={`flock:${flock.id}`} value={`flock:${flock.id}`}>
                        <span className="font-semibold">👥 {flock.name}</span>
                        <span className="text-muted-foreground ml-1 text-[10px]">({flockHens.length} höns)</span>
                      </SelectItem>
                    );
                  })}
                  {activeHens.filter((h) => !h.flock_id).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-t border-border/30 mt-1 pt-2">Utan flock</div>
                      {activeHens.filter((h) => !h.flock_id).map((hen) => (
                        <SelectItem key={hen.id} value={hen.id}>🐔 {hen.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {activeKarensForSelection.length > 0 && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2 text-xs text-destructive">
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Karens aktiv</p>
              {activeKarensForSelection.map(k => (
                <p key={k.id} className="text-destructive/90">
                  Ägg från denna besättning bör inte ätas eller säljas förrän <strong>{k.egg_safe_from}</strong> ({k.days_left} dgr kvar).
                </p>
              ))}
            </div>
          </div>
        )}

        {eggLogValidationError(date, count) && <p role="alert" className="text-sm text-destructive">{eggLogValidationError(date, count)}</p>}
        <div className="egg-log-actions flex flex-col sm:flex-row gap-2">
          <Button onClick={handleSubmit} disabled={isPending || !!eggLogValidationError(date, count)} className="h-12 rounded-xl active:scale-95 transition-transform flex-1 text-sm font-semibold">
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {`Spara ${Number.isNaN(count) ? 0 : count} ägg`}
          </Button>
          <Button variant="outline" disabled={isPending} onClick={onCancel} className="h-12 rounded-xl">Avbryt</Button>
        </div>
      </CardContent>
    </Card>
  );
}
