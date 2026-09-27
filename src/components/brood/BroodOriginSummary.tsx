import type { BroodOrigin } from '@/lib/broodOrigin';

export default function BroodOriginSummary({ origin }: { origin: BroodOrigin }) {
  return <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
    <div><h4 className="font-medium break-words">{origin.name}</h4><p className="text-xs text-muted-foreground">Kullens datum: {origin.date}</p></div>
    <p className="text-sm font-medium">Möjliga föräldrar – individuellt föräldraskap okänt</p>
    <div className="grid sm:grid-cols-2 gap-3">{(['mother', 'father'] as const).map(role => <div key={role}>
      <p className="text-sm font-medium">{role === 'mother' ? 'Möjliga mödrar' : 'Möjliga fäder'}</p>
      {origin.parents.some(p => p.role === role) ? <ul className="mt-1 space-y-1">{origin.parents.filter(p => p.role === role).map(p => <li key={p.hen_id} className="text-sm break-words">{p.name}{p.origin_genbank_number && <span className="block text-xs text-muted-foreground">Ursprunglig genbank: {p.origin_genbank_number}</span>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Okänt</p>}
    </div>)}</div>
    {origin.notes && <p className="text-sm whitespace-pre-wrap break-words">{origin.notes}</p>}
    <p className="text-xs text-muted-foreground">Sparade uppgifter för kullen. Möjliga föräldrar ingår inte i den bekräftade stamtavlan eller beräkningar av släktskap.</p>
  </div>;
}
