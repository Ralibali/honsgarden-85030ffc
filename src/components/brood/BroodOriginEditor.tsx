import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BroodOrigin } from '@/lib/broodOrigin';
import { todayLocal } from '@/lib/datetime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import HenPicker from '@/components/diary/HenPicker';
import { toast } from '@/hooks/use-toast';

export default function BroodOriginEditor({ open, onOpenChange, origin, hatching, onSaved }: {
  open: boolean; onOpenChange: (open: boolean) => void; origin?: BroodOrigin | null;
  hatching?: { id: string; name: string; date: string }; onSaved?: (origin: BroodOrigin) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [mothers, setMothers] = useState<string[]>([]);
  const [fathers, setFathers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [discardOpen, setDiscardOpen] = useState(false);
  const { data: hens = [], isPending, isError, refetch } = useQuery({ queryKey: ['farm-hens'], queryFn: () => api.getFarmHens(), enabled: open });
  useEffect(() => {
    if (!open) return;
    setName(origin?.name ?? hatching?.name ?? ''); setDate(origin?.date ?? hatching?.date ?? todayLocal());
    setNotes(origin?.notes ?? ''); setMothers(origin?.parents.filter(p => p.role === 'mother').map(p => p.hen_id) ?? []);
    setFathers(origin?.parents.filter(p => p.role === 'father').map(p => p.hen_id) ?? []); setError(''); setDiscardOpen(false);
  }, [open, origin, hatching?.id, hatching?.name, hatching?.date]);
  const save = useMutation({
    mutationFn: () => api.saveBroodOrigin({ id: origin?.id, hatching_id: hatching?.id, name, date, notes,
      parents: [...mothers.map(hen_id => ({ hen_id, role: 'mother' as const })), ...fathers.map(hen_id => ({ hen_id, role: 'father' as const }))] }),
    onSuccess: saved => { void client.invalidateQueries({ queryKey: ['brood-origins'] }); toast({ title: 'Kullens ursprung är sparat' }); onSaved?.(saved); onOpenChange(false); },
    onError: () => setError('Kullen kunde inte sparas. Kontrollera att föräldrarna tillhör din hönsgård, är födda senast på kullens datum och inte själva hör till kullen. Dina val finns kvar.'),
  });
  const savedParents = origin?.parents ?? [];
  const options = [
    ...hens.filter(h => (!origin || h.brood_origin_id !== origin.id) && !savedParents.some(p => p.hen_id === h.id)),
    ...savedParents.map(p => ({ id: p.hen_id, name: `${p.name} (sparad uppgift)`, hen_type: p.role === 'father' ? 'rooster' : 'hen' })),
  ];
  function close() {
    if (save.isPending) return;
    const dirty = name !== (origin?.name ?? hatching?.name ?? '') || date !== (origin?.date ?? hatching?.date ?? todayLocal()) || notes !== (origin?.notes ?? '') || JSON.stringify(mothers) !== JSON.stringify(origin?.parents.filter(p => p.role === 'mother').map(p => p.hen_id) ?? []) || JSON.stringify(fathers) !== JSON.stringify(origin?.parents.filter(p => p.role === 'father').map(p => p.hen_id) ?? []);
    if (dirty) setDiscardOpen(true); else onOpenChange(false);
  }
  return <><Dialog open={open} onOpenChange={next => next ? onOpenChange(true) : close()}><DialogContent data-private-content className="max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl">
    <DialogHeader><DialogTitle>Kullens ursprung</DialogTitle><DialogDescription>Samla möjliga mödrar och fäder när individuellt föräldraskap är okänt.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
      <div className="space-y-2"><Label htmlFor="brood-name">Kullens namn</Label><Input id="brood-name" value={name} onChange={e => setName(e.target.value)} required maxLength={150} disabled={save.isPending} placeholder="Till exempel vårkullen 2026" /></div>
      <div className="space-y-2"><Label htmlFor="brood-date">Datum för kullen</Label><Input id="brood-date" type="date" value={date} onChange={e => setDate(e.target.value)} required disabled={save.isPending} /></div>
      {isPending ? <p role="status">Hämtar individer…</p> : isError ? <p role="alert">Individerna kunde inte hämtas. <Button type="button" variant="link" onClick={() => void refetch()}>Försök igen</Button></p> : <>
        <HenPicker label="Möjliga mödrar" hens={options.filter(h => h.hen_type !== 'rooster')} selected={mothers} onChange={setMothers} disabled={save.isPending} />
        <HenPicker label="Möjliga fäder" hens={options.filter(h => h.hen_type === 'rooster')} selected={fathers} onChange={setFathers} disabled={save.isPending} />
      </>}
      <p className="text-xs text-muted-foreground">Namn och ursprungligt genbanksnummer sparas som uppgifter för den här kullen. Förändringar i flocken ändrar inte historiken. Lämna ett urval tomt om föräldrarna är okända.</p>
      <div className="space-y-2"><Label htmlFor="brood-notes">Anteckning om ursprung (valfritt)</Label><Textarea id="brood-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} disabled={save.isPending} placeholder="Till exempel uppfödare eller uppgifter om inköpta ägg." /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={close}>Avbryt</Button><Button type="submit" disabled={save.isPending || !name.trim() || !date || isPending || isError}>{save.isPending ? 'Sparar…' : 'Spara kullens ursprung'}</Button></div>
    </form>
  </DialogContent></Dialog><AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Stäng utan att spara?</AlertDialogTitle><AlertDialogDescription>Du har ändringar i kullens ursprung som inte är sparade.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Fortsätt redigera</AlertDialogCancel><AlertDialogAction onClick={() => { setDiscardOpen(false); onOpenChange(false); }}>Kasta ändringar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
