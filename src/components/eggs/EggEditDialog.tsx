import { useState } from 'react';
import type { EggLog } from '@/lib/api';
import { todayLocal } from '@/lib/datetime';
import { eggLogValidationError } from '@/lib/eggLogValidation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EggEditDialogProps {
  entry: EggLog;
  isPending: boolean;
  error: string | null;
  onSave: (data: { date: string; count: number }) => void;
  onClose: () => void;
}

export function EggEditDialog({ entry, isPending, error, onSave, onClose }: EggEditDialogProps) {
  const [date, setDate] = useState(entry.date);
  const [count, setCount] = useState(String(entry.count));
  const validationError = eggLogValidationError(date, count.trim() === '' ? NaN : Number(count));

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isPending) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ändra äggregistrering</DialogTitle>
          <DialogDescription>Rätta datum eller antal för registreringen från {entry.date}.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (!isPending && !validationError) onSave({ date, count: Number(count) });
        }}>
          <div className="space-y-1.5">
            <label htmlFor="edit-egg-date" className="text-sm font-medium">Datum</label>
            <Input id="edit-egg-date" type="date" value={date} max={todayLocal()} required disabled={isPending} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="edit-egg-count" className="text-sm font-medium">Antal ägg</label>
            <Input id="edit-egg-count" type="number" inputMode="numeric" min={0} step={1} value={count} required disabled={isPending} onChange={(event) => setCount(event.target.value)} />
          </div>
          {(validationError || error) && <p role="alert" className="text-sm text-destructive">{validationError || error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={isPending || !!validationError}>{isPending ? 'Sparar…' : 'Spara ändringar'}</Button>
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>Avbryt</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
