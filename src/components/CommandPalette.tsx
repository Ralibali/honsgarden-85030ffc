import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Bird, Egg, Wallet, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface SearchResult {
  id: string;
  type: 'hen' | 'egg' | 'transaction';
  title: string;
  subtitle: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchTerm = `%${q.trim()}%`;

    const [hensRes, eggsRes, txRes] = await Promise.all([
      supabase
        .from('hens')
        .select('id, name, breed')
        .or(`name.ilike.${searchTerm},breed.ilike.${searchTerm}`)
        .limit(5),
      supabase
        .from('egg_logs')
        .select('id, date, count, notes')
        .ilike('notes', searchTerm)
        .limit(5),
      supabase
        .from('transactions')
        .select('id, date, amount, description, type, category')
        .or(`description.ilike.${searchTerm},category.ilike.${searchTerm}`)
        .limit(5),
    ]);

    const items: SearchResult[] = [];

    hensRes.data?.forEach((h) =>
      items.push({
        id: h.id,
        type: 'hen',
        title: h.name,
        subtitle: h.breed || 'Höna',
      })
    );

    eggsRes.data?.forEach((e) =>
      items.push({
        id: e.id,
        type: 'egg',
        title: `${e.count} ägg – ${format(new Date(e.date), 'yyyy-MM-dd')}`,
        subtitle: e.notes || 'Äggloggning',
      })
    );

    txRes.data?.forEach((t) =>
      items.push({
        id: t.id,
        type: 'transaction',
        title: `${t.amount} kr – ${t.description || t.category || t.type}`,
        subtitle: format(new Date(t.date), 'yyyy-MM-dd'),
      })
    );

    setResults(items);
    setLoading(false);
  }, [user]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const handleSelect = (item: SearchResult) => {
    setOpen(false);
    setQuery('');
    switch (item.type) {
      case 'hen':
        navigate(`/app/hens/${item.id}`);
        break;
      case 'egg':
        navigate('/app/eggs');
        break;
      case 'transaction':
        navigate('/app/finance');
        break;
    }
  };

  const iconMap = {
    hen: Bird,
    egg: Egg,
    transaction: Wallet,
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Sök höna, ägg, transaktion..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Söker...' : query ? 'Inga resultat hittades.' : 'Börja skriva för att söka...'}
        </CommandEmpty>

        {results.filter((r) => r.type === 'hen').length > 0 && (
          <CommandGroup heading="Hönor">
            {results
              .filter((r) => r.type === 'hen')
              .map((item) => {
                const Icon = iconMap[item.type];
                return (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-3">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}

        {results.filter((r) => r.type === 'egg').length > 0 && (
          <CommandGroup heading="Äggloggningar">
            {results
              .filter((r) => r.type === 'egg')
              .map((item) => {
                const Icon = iconMap[item.type];
                return (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-3">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}

        {results.filter((r) => r.type === 'transaction').length > 0 && (
          <CommandGroup heading="Transaktioner">
            {results
              .filter((r) => r.type === 'transaction')
              .map((item) => {
                const Icon = iconMap[item.type];
                return (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-3">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-sm">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </div>
                  </CommandItem>
                );
              })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
