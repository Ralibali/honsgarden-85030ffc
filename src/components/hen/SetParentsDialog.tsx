import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2, Search, X } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  henId: string;
  currentMotherId: string | null;
  currentFatherId: string | null;
  henBirthDate: string | null;
}

export default function SetParentsDialog({ open, onOpenChange, henId, currentMotherId, currentFatherId, henBirthDate }: Props) {
  const qc = useQueryClient();
  const [motherId, setMotherId] = useState<string | null>(currentMotherId);
  const [fatherId, setFatherId] = useState<string | null>(currentFatherId);
  const [motherSearch, setMotherSearch] = useState('');
  const [fatherSearch, setFatherSearch] = useState('');

  React.useEffect(() => {
    setMotherId(currentMotherId);
    setFatherId(currentFatherId);
  }, [currentMotherId, currentFatherId, open]);

  const { data: candidates = [] } = useQuery({
    queryKey: ['hens-parent-candidates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hens')
        .select('id, name, breed, hen_type, birth_date')
        .neq('id', henId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const mothers = useMemo(
    () => candidates.filter((h: any) => h.hen_type !== 'rooster' && h.name.toLowerCase().includes(motherSearch.toLowerCase())),
    [candidates, motherSearch],
  );
  const fathers = useMemo(
    () => candidates.filter((h: any) => h.hen_type === 'rooster' && h.name.toLowerCase().includes(fatherSearch.toLowerCase())),
    [candidates, fatherSearch],
  );

  const save = useMutation({
    mutationFn: async () => {
      // validate ages
      if (henBirthDate) {
        for (const pid of [motherId, fatherId]) {
          if (!pid) continue;
          const parent = candidates.find((c: any) => c.id === pid);
          if (parent?.birth_date && parent.birth_date >= henBirthDate) {
            throw new Error(`${parent.name} kan inte vara förälder – är inte äldre än hönan.`);
          }
        }
      }
      if (motherId && motherId === fatherId) {
        throw new Error('Mor och far kan inte vara samma individ.');
      }
      const { error } = await supabase
        .from('hens')
        .update({ mother_id: motherId, father_id: fatherId })
        .eq('id', henId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hen-profile', henId] });
      qc.invalidateQueries({ queryKey: ['hen-ancestors', henId] });
      toast({ title: 'Föräldrar uppdaterade 🌳' });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e?.message ?? '', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Sätt föräldrar</DialogTitle>
          <DialogDescription className="text-xs">
            Välj mor (höna) och far (tupp) från din flock. Föräldern måste vara äldre än hönan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ParentPicker
            label="Mor"
            placeholder="Sök bland hönor..."
            search={motherSearch}
            setSearch={setMotherSearch}
            list={mothers}
            selectedId={motherId}
            onSelect={setMotherId}
            emptyText="Inga hönor matchar."
          />
          <ParentPicker
            label="Far"
            placeholder="Sök bland tuppar..."
            search={fatherSearch}
            setSearch={setFatherSearch}
            list={fathers}
            selectedId={fatherId}
            onSelect={setFatherId}
            emptyText="Inga tuppar matchar."
          />

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <Button className="flex-1 rounded-xl h-10" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
            </Button>
            <Button variant="outline" className="rounded-xl h-10" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParentPicker({ label, placeholder, search, setSearch, list, selectedId, onSelect, emptyText }: any) {
  const selected = list.find((h: any) => h.id === selectedId);
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {selected ? (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20">
          <div className="text-sm">
            <span className="font-medium">{selected.name}</span>
            {selected.breed && <span className="text-xs text-muted-foreground ml-2">{selected.breed}</span>}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelect(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9 h-9"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">{emptyText}</p>
            ) : (
              list.slice(0, 30).map((h: any) => (
                <button
                  key={h.id}
                  className="w-full text-left px-3 py-2 hover:bg-muted/40 text-sm flex items-center justify-between"
                  onClick={() => onSelect(h.id)}
                >
                  <span>{h.name}</span>
                  {h.breed && <span className="text-[10px] text-muted-foreground">{h.breed}</span>}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
