import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check } from 'lucide-react';
import { api, type HealthLog } from '@/lib/api';
import { todayLocal } from '@/lib/datetime';
import { trackEvent } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: HealthLog | null;
  demo?: boolean;
}

export default function DiaryEditor({ open, onOpenChange, entry, demo = false }: Props) {
  const client = useQueryClient();
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDescription(entry?.description ?? '');
    setDate(entry?.date ?? todayLocal());
    setError('');
  }, [open, entry]);

  const save = useMutation({
    mutationFn: () => entry
      ? api.updateHealthLog(entry.id, { description: description.trim(), date })
      : api.createHealthLog({ description: description.trim(), date, type: 'diary' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['health-logs'] });
      void client.invalidateQueries({ queryKey: ['hen-profile'] });
      if (!demo) trackEvent('Diary Entry Saved', { action: entry ? 'edit' : 'create' });
      else trackEvent('Demo Feature Used', { feature: 'diary' });
      toast({ title: demo ? 'Tillagt i demon – inget sparas till ett konto' : entry ? 'Dagboksinlägget är uppdaterat' : 'Sparat i din dagbok' });
      onOpenChange(false);
    },
    onError: () => setError('Det gick inte att spara. Din text finns kvar här. Kontrollera uppkopplingen och försök igen.'),
  });

  function close() {
    if (save.isPending) return;
    const dirty = description !== (entry?.description ?? '') || date !== (entry?.date ?? todayLocal());
    if (dirty) setDiscardOpen(true);
    else onOpenChange(false);
  }

  return <>
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : close()}>
      <DialogContent data-private-content className="max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{entry ? 'Redigera inlägg' : 'En stund i hönsgården'}</DialogTitle>
          <DialogDescription>Spara små minnen och sådant du vill komma ihåg om flocken.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (description.trim() && date && !save.isPending) { setError(''); save.mutate(); } }}>
          <div className="space-y-2"><Label htmlFor="diary-date">Datum</Label><Input id="diary-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} disabled={save.isPending} /></div>
          <div className="space-y-2">
            <Label htmlFor="diary-text">Vad hände i hönsgården?</Label>
            <Textarea id="diary-text" autoFocus required value={description} onChange={(event) => setDescription(event.target.value)} disabled={save.isPending} rows={7} className="resize-y text-base leading-relaxed" placeholder="Första ägget från en unghöna, en ny rutin eller bara en fin stund med flocken…" aria-describedby={error ? 'diary-save-error' : undefined} />
          </div>
          {error && <p id="diary-save-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={close}>Avbryt</Button>
            <Button type="submit" disabled={!description.trim() || !date || save.isPending} className="gap-2 min-h-11">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {save.isPending ? 'Sparar…' : demo ? 'Prova att spara' : 'Spara inlägg'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Stäng utan att spara?</AlertDialogTitle><AlertDialogDescription>Du har ändringar som inte är sparade.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Fortsätt skriva</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscardOpen(false); onOpenChange(false); }}>Kasta ändringar</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
