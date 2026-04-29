import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Egg, Bird, Sun, Loader2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';


const STORAGE_KEY = 'daily-summary-date';

export function DailySummaryModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only check once per component mount
    if (hasChecked.current) return;
    hasChecked.current = true;

    const lastShown = readScoped(user?.id, STORAGE_KEY);
    const today = new Date().toDateString();
    if (lastShown === today) return; // Already shown today

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.getYesterdaySummary();
        setSummary(data);
      } catch {
        setSummary({
          date: 'Igår',
          eggs: 0,
          tip: 'Kom ihåg att samla ägg tidigt på morgonen för bäst kvalitet!',
        });
      } finally {
        setLoading(false);
        setOpen(true);
        // Mark as shown immediately when opened
        writeScoped(user?.id, STORAGE_KEY, today);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleClose = () => {
    setOpen(false);
  };

  const eggCount = Number(summary?.eggs ?? summary?.eggs_collected ?? 0);
  const getEmoji = () => {
    if (isNaN(eggCount) || eggCount === 0) return '🌅';
    if (eggCount >= 8) return '🎉';
    if (eggCount >= 5) return '👏';
    return '🐔';
  };

  const getHeadline = () => {
    if (isNaN(eggCount) || eggCount === 0) return 'God morgon!';
    if (eggCount >= 8) return 'Fantastisk dag igår!';
    if (eggCount >= 5) return 'Bra dag igår!';
    return 'Hur gick det igår?';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[340px] sm:max-w-sm mx-auto p-0 overflow-hidden border-primary/20 shadow-xl gap-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary/15 via-accent/10 to-warning/10 px-5 pt-5 pb-3">
              <button onClick={handleClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <div className="text-center">
                <span className="text-2xl block mb-1">{getEmoji()}</span>
                <h2 className="font-serif text-lg text-foreground">{getHeadline()}</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  <Sun className="h-3 w-3 inline mr-1 text-warning" />
                  {summary?.date || 'Igår'} – Dagrapport
                </p>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-primary/5 rounded-lg p-2.5 text-center">
                  <Egg className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
                  <p className="stat-number text-xl text-foreground">{eggCount}</p>
                  <p className="text-[9px] text-muted-foreground">ägg samlade</p>
                </div>
                <div className="bg-accent/5 rounded-lg p-2.5 text-center">
                  <Bird className="h-3.5 w-3.5 text-accent mx-auto mb-0.5" />
                  <p className="stat-number text-xl text-foreground">{summary?.avg_per_hen ?? '–'}</p>
                  <p className="text-[9px] text-muted-foreground">ägg/höna snitt</p>
                </div>
              </div>

              {/* Tip */}
              {summary?.tip && (
                <div className="bg-warning/5 border border-warning/15 rounded-lg p-2">
                  <p className="text-[10px] text-foreground leading-relaxed">💡 {summary.tip}</p>
                </div>
              )}

              {/* Action */}
              <Button className="w-full h-9 text-sm font-medium" onClick={handleClose}>
                Starta dagen 🐔
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
