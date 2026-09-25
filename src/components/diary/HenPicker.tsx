import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';

export default function HenPicker({ label, hens, selected, onChange, disabled = false }: {
  label: string; hens: { id: string; name: string }[]; selected: string[];
  onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const options = [...hens, ...selected.filter(value => !hens.some(h => h.id === value)).map(value => ({ id: value, name: 'Tidigare vald individ' }))];
  const filtered = options.filter(h => h.name.toLocaleLowerCase('sv-SE').includes(search.toLocaleLowerCase('sv-SE')));
  return <fieldset disabled={disabled} className="space-y-2">
    <legend className="text-sm font-medium">{label} <span className="text-muted-foreground">({selected.length} valda)</span></legend>
    {options.length > 6 && <Input aria-label={`Sök: ${label}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök efter namn…" />}
    <div className="max-h-44 overflow-y-auto rounded-xl border p-2 space-y-1">
      {filtered.map(h => <label key={h.id} htmlFor={`${id}-${h.id}`} className="flex items-center gap-3 min-h-11 rounded-lg px-2 hover:bg-muted cursor-pointer text-sm">
        <input id={`${id}-${h.id}`} type="checkbox" className="h-4 w-4 accent-primary" checked={selected.includes(h.id)} onChange={e => onChange(e.target.checked ? [...selected, h.id] : selected.filter(value => value !== h.id))} />
        <span className="break-words min-w-0">{h.name}</span>
      </label>)}
      {!filtered.length && <p className="p-2 text-sm text-muted-foreground">Inga individer att visa.</p>}
    </div>
  </fieldset>;
}
