import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Hen } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BroodOriginEditor from './BroodOriginEditor';
import BroodOriginSummary from './BroodOriginSummary';
import { toast } from '@/hooks/use-toast';

export default function HenOrigin({ hen }: { hen: Hen }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [genbank, setGenbank] = useState('');
  const [broodId, setBroodId] = useState('');
  const [editor, setEditor] = useState<'new' | 'existing' | null>(null);
  const { data: origins = [], isPending, isError, refetch } = useQuery({ queryKey: ['brood-origins'], queryFn: () => api.getBroodOrigins() });
  const current = origins.find(o => o.id === hen.brood_origin_id);
  const choices = origins.filter(o => !o.parents.some(p => p.hen_id === hen.id));
  const save = useMutation({
    mutationFn: () => api.updateHenOrigin(hen.id, genbank, broodId || null),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hen-profile'] }); void client.invalidateQueries({ queryKey: ['hens'] });
      void client.invalidateQueries({ queryKey: ['farm-hens'] }); setEditing(false); toast({ title: 'Ursprunget är uppdaterat' });
    },
  });
  return <section data-private-content aria-label={`Ursprung för ${hen.name}`} className="space-y-3 rounded-2xl border p-4">
    <div className="flex justify-between items-center gap-2"><h3 className="font-serif text-lg">Ursprung och genbank</h3>{!editing && <Button variant="outline" onClick={() => { setGenbank(hen.origin_genbank_number ?? ''); setBroodId(hen.brood_origin_id ?? ''); save.reset(); setEditing(true); }}>Redigera ursprung</Button>}</div>
    <p className="text-sm">Ursprungligt genbanksnummer: <strong>{hen.origin_genbank_number || 'Inte angivet'}</strong></p>
    {isPending ? <p role="status">Hämtar kullar…</p> : isError ? <p role="alert">Kullarna kunde inte hämtas. <Button variant="link" onClick={() => void refetch()}>Försök igen</Button></p> : current ? <><BroodOriginSummary origin={current} /><Button variant="link" onClick={() => setEditor('existing')}>Redigera föräldragruppen för kullen</Button></> : <p className="text-sm text-muted-foreground">Ingen kull med möjliga föräldrar är kopplad ännu.</p>}
    {editing && <form className="space-y-3 border-t pt-3" onSubmit={e => { e.preventDefault(); if (!save.isPending) save.mutate(); }}>
      <div className="space-y-2"><Label htmlFor={`origin-genbank-${hen.id}`}>Ursprungligt genbanksnummer</Label><Input id={`origin-genbank-${hen.id}`} value={genbank} onChange={e => setGenbank(e.target.value)} maxLength={100} disabled={save.isPending} /><p className="text-xs text-muted-foreground">Genbanken individen kommer från. Detta anger inte nuvarande genbankstillhörighet.</p></div>
      <div className="space-y-2"><Label htmlFor={`origin-brood-${hen.id}`}>Tillhör kull</Label><select id={`origin-brood-${hen.id}`} value={broodId} onChange={e => setBroodId(e.target.value)} disabled={save.isPending || isPending || isError} className="w-full h-11 border rounded-md bg-background px-3 text-sm"><option value="">Ingen kopplad kull</option>{choices.map(o => <option key={o.id} value={o.id}>{o.name} · {o.date}</option>)}</select><p className="text-xs text-muted-foreground">Alla individer kopplade till kullen får samma dokumenterade möjliga föräldrar.</p></div>
      <Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditor('new')}>Skapa kull med möjliga föräldrar</Button>
      {save.isError && <p role="alert" className="text-sm text-destructive">Ursprunget kunde inte sparas. Kontrollera anslutningen och din behörighet. En förälder kan inte själv tillhöra kullen.</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setEditing(false)}>Avbryt</Button><Button type="submit" disabled={save.isPending || isPending || isError}>{save.isPending ? 'Sparar…' : 'Spara ursprung'}</Button></div>
    </form>}
    <BroodOriginEditor open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }} origin={editor === 'existing' ? current : null} onSaved={origin => { if (editor === 'new') setBroodId(origin.id); }} />
  </section>;
}
