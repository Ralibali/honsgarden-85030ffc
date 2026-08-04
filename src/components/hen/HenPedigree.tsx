import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, GitBranch, AlertTriangle } from 'lucide-react';
import HenAvatar from '@/components/HenAvatar';
import SetParentsDialog from './SetParentsDialog';

interface Props {
  henId: string;
  henName: string;
  henBirthDate: string | null;
  motherId: string | null;
  fatherId: string | null;
  motherName?: string | null;
  fatherName?: string | null;
}


interface AncestorRow {
  id: string;
  name: string;
  breed: string | null;
  color: string | null;
  birth_date: string | null;
  hen_type: string;
  image_url: string | null;
  mother_id: string | null;
  father_id: string | null;
  depth: number;
  relation: string;
}

export default function HenPedigree({ henId, henName, henBirthDate, motherId, fatherId, motherName, fatherName }: Props) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: ancestors = [], isLoading } = useQuery({
    queryKey: ['hen-ancestors', henId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_hen_ancestors', { _hen_id: henId, _generations: 3 });
      if (error) throw error;
      return (data || []) as AncestorRow[];
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const byId = new Map(ancestors.map((a) => [a.id, a]));
  const self = byId.get(henId);
  const mother = motherId ? byId.get(motherId) : null;
  const father = fatherId ? byId.get(fatherId) : null;

  // Detect self-reference cycles
  const cycleWarning = self && (self.mother_id === self.id || self.father_id === self.id);

  const grandparent = (parent: AncestorRow | null | undefined, side: 'mother' | 'father') => {
    if (!parent) return null;
    const id = side === 'mother' ? parent.mother_id : parent.father_id;
    return id ? byId.get(id) : null;
  };

  const mm = grandparent(mother, 'mother');
  const mf = grandparent(mother, 'father');
  const fm = grandparent(father, 'mother');
  const ff = grandparent(father, 'father');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base text-foreground">Stamtavla</h3>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1.5" onClick={() => setEditOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Sätt föräldrar
        </Button>
      </div>

      {cycleWarning && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <span>Den här hönan är registrerad som sin egen förälder. Vi visar inte den länken. Sätt rätt föräldrar för att åtgärda.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Column 1: self */}
        <div className="flex items-center justify-center">
          <NodeCard hen={self} label="Hönan" highlight onClick={() => {}} />
        </div>

        {/* Column 2: parents */}
        <div className="flex flex-col gap-2 sm:gap-3 justify-center">
          <NodeOrEmpty
            hen={mother}
            freeTextName={!mother ? motherName ?? null : null}
            relationLabel="Mor"
            emptyLabel="Lägg till mor"
            onAdd={() => setEditOpen(true)}
            onClick={(id) => navigate(`/app/hens/${id}`)}
          />
          <NodeOrEmpty
            hen={father}
            freeTextName={!father ? fatherName ?? null : null}
            relationLabel="Far"
            emptyLabel="Lägg till far"
            onAdd={() => setEditOpen(true)}
            onClick={(id) => navigate(`/app/hens/${id}`)}
          />
        </div>


        {/* Column 3: grandparents */}
        <div className="flex flex-col gap-1.5 sm:gap-2 justify-center">
          <MiniNode hen={mm} label="Mormor" onClick={(id) => navigate(`/app/hens/${id}`)} />
          <MiniNode hen={mf} label="Morfar" onClick={(id) => navigate(`/app/hens/${id}`)} />
          <MiniNode hen={fm} label="Farmor" onClick={(id) => navigate(`/app/hens/${id}`)} />
          <MiniNode hen={ff} label="Farfar" onClick={(id) => navigate(`/app/hens/${id}`)} />
        </div>
      </div>

      {!mother && !father && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Inga föräldrar registrerade ännu. Sätt mor och far för att bygga upp stamtavlan för {henName}.
        </p>
      )}

      <SetParentsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        henId={henId}
        currentMotherId={motherId}
        currentFatherId={fatherId}
        currentMotherName={motherName ?? null}
        currentFatherName={fatherName ?? null}
        henBirthDate={henBirthDate}
      />

    </div>
  );
}

function NodeCard({ hen, label, highlight, onClick }: { hen?: AncestorRow | null; label: string; highlight?: boolean; onClick?: () => void }) {
  if (!hen) return null;
  const year = hen.birth_date ? new Date(hen.birth_date).getFullYear() : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-2.5 text-center transition-all ${
        highlight ? 'border-primary/40 bg-primary/5 shadow-sm' : 'border-border/50 bg-card hover:border-primary/30'
      }`}
    >
      <div className="flex justify-center mb-1.5">
        <HenAvatar henId={hen.id} henType={hen.hen_type} imageUrl={hen.image_url} size="sm" />
      </div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground truncate">{hen.name}</p>
      {hen.breed && <p className="text-[10px] text-muted-foreground truncate">{hen.breed}</p>}
      {year && <p className="text-[10px] text-muted-foreground">{year}</p>}
    </button>
  );
}

function NodeOrEmpty({ hen, freeTextName, relationLabel, emptyLabel, onAdd, onClick }: { hen?: AncestorRow | null; freeTextName?: string | null; relationLabel: string; emptyLabel: string; onAdd: () => void; onClick: (id: string) => void }) {
  if (hen) return <NodeCard hen={hen} label={relationLabel} onClick={() => onClick(hen.id)} />;
  if (freeTextName) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded-xl border border-border/50 bg-card p-2.5 text-center hover:border-primary/30 transition-all"
      >
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{relationLabel}</p>
        <p className="text-xs font-semibold text-foreground truncate">{freeTextName}</p>
        <p className="text-[9px] text-muted-foreground/70 italic">fritext</p>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full rounded-xl border border-dashed border-border/60 p-3 text-center hover:border-primary/40 hover:bg-primary/5 transition-all"
    >
      <Plus className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-[10px] text-muted-foreground">{emptyLabel}</p>
    </button>
  );
}


function MiniNode({ hen, label, onClick }: { hen?: AncestorRow | null; label: string; onClick: (id: string) => void }) {
  if (!hen) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 p-1.5 text-center">
        <p className="text-[8px] uppercase tracking-wider text-muted-foreground/60">{label}</p>
        <p className="text-[10px] text-muted-foreground/50">–</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onClick(hen.id)}
      className="rounded-lg border border-border/40 p-1.5 text-center bg-card hover:border-primary/30 transition-all"
    >
      <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[10px] font-medium text-foreground truncate">{hen.name}</p>
    </button>
  );
}
