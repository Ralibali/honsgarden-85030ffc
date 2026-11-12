import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { getFarmUserIds } from '@/lib/farmScope';
import { withRequestTimeout } from '@/lib/requestTimeout';
import { appPages } from '@/lib/appPages';
import { useAuth } from '@/hooks/useAuth';

async function findRecords(term: string, userId: string, signal: AbortSignal) {
  const owners = await getFarmUserIds(userId);
  // Quote the complete PostgREST operand, including commas in names.
  const pattern = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
  const operand = '"' + pattern.replace(/["\\]/g, '\\$&') + '"';
  const [hens, flocks, eggs, tx] = await Promise.all([
    supabase.from('hens').select('id,name,breed').in('user_id', owners)
      .or(`name.ilike.${operand},breed.ilike.${operand}`).limit(5).abortSignal(signal),
    supabase.from('flocks').select('id,name').in('user_id', owners).ilike('name', pattern).limit(5).abortSignal(signal),
    supabase.from('egg_logs').select('id,date,count,notes').in('user_id', owners).ilike('notes', pattern).limit(5).abortSignal(signal),
    supabase.from('transactions').select('id,amount,description,category').in('user_id', owners)
      .or(`description.ilike.${operand},category.ilike.${operand}`).limit(5).abortSignal(signal),
  ]);
  for (const response of [hens, flocks, eggs, tx]) if (response.error) throw response.error;
  return [
    ...(hens.data ?? []).map(h => ({ id: h.id, label: h.name, detail: h.breed || 'Höna', path: '/app/hens/' + h.id })),
    ...(flocks.data ?? []).map(f => ({ id: f.id, label: f.name, detail: 'Flock', path: '/app/hens?flock=' + f.id })),
    ...(eggs.data ?? []).map(e => ({ id: e.id, label: e.count + ' ägg · ' + e.date, detail: e.notes, path: '/app/eggs' })),
    ...(tx.data ?? []).map(t => ({ id: t.id, label: t.amount + ' kr · ' + (t.description || t.category || 'Transaktion'), detail: 'Ekonomi', path: '/app/finance' })),
  ];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!open) { setInput(''); setTerm(''); return; }
    const timer = setTimeout(() => setTerm(input.trim()), 220);
    return () => clearTimeout(timer);
  }, [input, open]);
  const { data: admin } = useQuery({ queryKey: ['admin-check'], queryFn: api.adminCheck, enabled: open && !!user });
  const result = useQuery({
    queryKey: ['command-search', user?.id, term],
    enabled: open && !!user && !!term,
    queryFn: () => withRequestTimeout(signal => findRecords(term, user!.id, signal), 8000),
    retry: false, networkMode: 'always',
  });
  const query = input.trim().toLocaleLowerCase('sv');
  const pages = query ? appPages.filter(p => (admin?.is_admin || !['/app/admin', '/app/growth-intelligence', '/app/butik'].includes(p.path)) &&
    (p.label + ' ' + (p.terms ?? '')).toLocaleLowerCase('sv').includes(query)) : [];
  const records = input.trim() === term && query ? result.data ?? [] : [];
  const go = (path: string) => { setOpen(false); navigate(path); };
  const waiting = input.trim() !== term || result.isFetching;
  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput placeholder="Sök sida, flock, höna, ägg eller transaktion…" value={input} onValueChange={setInput} />
      <CommandList>
        {pages.length > 0 && <CommandGroup heading="Sidor">{pages.map(p =>
          <CommandItem key={p.path} value={p.path} onSelect={() => go(p.path)}>{p.label}</CommandItem>)}</CommandGroup>}
        {records.length > 0 && <CommandGroup heading="På din gård">{records.map(r =>
          <CommandItem key={r.id} value={r.id} onSelect={() => go(r.path)}>
            {r.label} <span className="ml-2 text-xs text-muted-foreground">{r.detail}</span>
          </CommandItem>)}</CommandGroup>}
        {(!query || waiting || result.isError || (!pages.length && !records.length)) &&
          <p role="status" className="p-4 text-sm text-muted-foreground">{!query ? 'Börja skriva för att söka.' :
            waiting ? 'Söker…' : result.isError ? 'Gårdens uppgifter kunde inte hämtas.' : 'Inga resultat hittades.'}</p>}
      </CommandList>
    </CommandDialog>
  );
}
