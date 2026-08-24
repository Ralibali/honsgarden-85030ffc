import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

/**
 * Ej blockerande checklista som visas i onboardingen för säljsidor.
 * Krysstatusen sparas endast i localStorage – det påverkar inte publiceringen.
 */
export default function LegalReadinessChecklist() {
  const storageKey = 'saljcheck-v1';
  const initial = (() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  })();
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<Record<string, boolean>>(initial);

  const toggle = (k: string) => {
    setState((s) => {
      const next = { ...s, [k]: !s[k] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const items: { key: string; label: string; hint?: string }[] = [
    { key: 'jv', label: 'Anläggningen registrerad hos Jordbruksverket' },
    { key: 'lst', label: 'Registrerad hos länsstyrelsen om fler än 50 höns' },
    { key: 'foder', label: 'Koll på foderreglerna (inga animaliska matrester)' },
  ];

  const done = items.filter((i) => state[i.key]).length;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
          <ShieldCheck className="h-4 w-4" />
          Redo att sälja lagligt? <span className="text-xs opacity-70">({done}/{items.length})</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-amber-700" /> : <ChevronDown className="h-4 w-4 text-amber-700" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <label key={it.key} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100 cursor-pointer">
              <Checkbox
                checked={!!state[it.key]}
                onCheckedChange={() => toggle(it.key)}
                className="mt-0.5"
              />
              <span>{it.label}</span>
            </label>
          ))}
          <p className="text-xs text-amber-800/80 dark:text-amber-100/80 pt-1">
            Vägledande, inte blockerande. Läs mer i{' '}
            <Link to="/guider/salja-agg-regler" target="_blank" className="underline inline-flex items-center gap-0.5">
              regelguiden <ExternalLink className="h-3 w-3" />
            </Link>{' '}
            eller på{' '}
            <a href="https://jordbruksverket.se/djur/fjaderfa/hons-och-agg" target="_blank" rel="noopener noreferrer" className="underline">
              Jordbruksverket
            </a>.
          </p>
        </div>
      )}
    </div>
  );
}
