import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Sparkles, CheckCircle2, Pencil, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import SeoEditorModal, { type SeoType } from './SeoEditorModal';

type SeoRow = Tables<'seo_breeds'> | Tables<'seo_problems'> | Tables<'seo_care_topics'> | Tables<'seo_months'>;

const CONFIG: Record<SeoType, { label: string; singular: string; needsCategory?: boolean; needsMonth?: boolean; aiKey: 'breeds' | 'problems' | 'care' | 'months'; previewPath: (slug: string) => string }> = {
  seo_breeds: { label: 'Raser', singular: 'ras', aiKey: 'breeds', previewPath: (slug) => `/raser/${slug}` },
  seo_problems: { label: 'Problem', singular: 'problem', needsCategory: true, aiKey: 'problems', previewPath: (slug) => `/problem/${slug}` },
  seo_care_topics: { label: 'Skötsel', singular: 'skötselämne', needsCategory: true, aiKey: 'care', previewPath: (slug) => `/skotsel/${slug}` },
  seo_months: { label: 'Månader', singular: 'månad', needsMonth: true, aiKey: 'months', previewPath: (slug) => `/manad/${slug}` },
};

const slugify = (value: string) => value.toLowerCase().trim().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function SeoAdmin() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<SeoType>('seo_breeds');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [monthNumber, setMonthNumber] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const config = CONFIG[type];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['seo-admin', type],
    queryFn: async () => {
      const { data, error } = await supabase.from(type).select('*').order('updated_at', { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as SeoRow[];
    },
  });

  const resetForm = () => {
    setName('');
    setSlug('');
    setCategory('');
    setMonthNumber('1');
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const base = { name, slug: slug || slugify(name), generation_status: 'pending', published: false };
      const payload = type === 'seo_months'
        ? { ...base, month_number: Number(monthNumber) || 1 }
        : config.needsCategory
          ? { ...base, category: category || 'Allmänt' }
          : base;
      const { data, error } = await supabase.from(type).insert(payload as never).select('id').single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ['seo-admin', type] });
      resetForm();
      toast({ title: 'SEO-post skapad — öppnar editor' });
      setEditingId(newId);
    },
    onError: (err: Error) => toast({ title: 'Kunde inte skapa', description: err.message, variant: 'destructive' }),
  });

  const generateAndPublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('seo-generate-content', {
        body: { type: config.aiKey, id, auto_publish: true },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-admin', type] });
      toast({ title: '✅ Genererad och publicerad' });
    },
    onError: (err: Error) => toast({ title: 'AI-generering misslyckades', description: err.message, variant: 'destructive' }),
  });

  const batchMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('seo-generate-content', {
        body: { batch: true, type: config.aiKey, limit: 5, auto_publish: true },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['seo-admin', type] });
      const result = data?.results?.[config.aiKey] ?? { done: 0, failed: 0 };
      toast({ title: `Batchkörning klar: ${result.done} klara, ${result.failed} misslyckade` });
    },
    onError: (err: Error) => toast({ title: 'Batch misslyckades', description: err.message, variant: 'destructive' }),
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const published = rows.filter((r: any) => r.published).length;
    const missingContent = rows.filter((r: any) => !r.content).length;
    return { total, published, missingContent };
  }, [rows]);

  return (
    <div className="space-y-4">
      <Tabs value={type} onValueChange={(value) => { setType(value as SeoType); resetForm(); }}>
        <TabsList className="flex w-full overflow-x-auto rounded-xl">
          {Object.entries(CONFIG).map(([key, item]) => (
            <TabsTrigger key={key} value={key} className="rounded-lg text-xs">{item.label}</TabsTrigger>
          ))}
        </TabsList>
        {Object.keys(CONFIG).map((key) => <TabsContent key={key} value={key} />)}
      </Tabs>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif">Skapa {config.singular}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="Namn" value={name} onChange={(event) => { setName(event.target.value); setSlug(slugify(event.target.value)); }} className="rounded-xl" />
          <Input placeholder="slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} className="rounded-xl" />
          {config.needsCategory && <Input placeholder="Kategori" value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl" />}
          {config.needsMonth && <Input type="number" min="1" max="12" placeholder="Månad" value={monthNumber} onChange={(event) => setMonthNumber(event.target.value)} className="rounded-xl" />}
          <Button disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()} className="rounded-xl gap-2">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Skapa
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{stats.total}</strong> poster</span>
          <span>•</span>
          <span><strong className="text-foreground">{stats.published}</strong> publicerade</span>
          <span>•</span>
          <span><strong className="text-warning">{stats.missingContent}</strong> saknar text</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg gap-1.5 text-xs"
          disabled={batchMutation.isPending || stats.missingContent === 0}
          onClick={() => batchMutation.mutate()}
        >
          {batchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI-fyll 5 utan text
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {rows.map((row: any) => (
            <Card key={row.id} className="border-border/50">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">/{row.slug}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant={row.published ? 'default' : 'secondary'} className="text-[10px]">
                      {row.published ? 'Publicerad' : 'Utkast'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{row.generation_status}</Badge>
                    {row.content
                      ? <Badge variant="outline" className="text-[10px] text-success">Text finns</Badge>
                      : <Badge variant="outline" className="text-[10px] text-warning">Saknar text</Badge>}
                    {row.medically_reviewed_by && (
                      <Badge variant="outline" className="text-[10px] text-success">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Granskad
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 rounded-lg gap-1.5 text-xs"
                    disabled={generateAndPublishMutation.isPending}
                    onClick={() => generateAndPublishMutation.mutate(row.id)}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI + publicera
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg gap-1.5 text-xs"
                    onClick={() => setEditingId(row.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Redigera
                  </Button>
                  {row.published && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-lg gap-1.5 text-xs"
                      asChild
                    >
                      <a href={config.previewPath(row.slug)} target="_blank" rel="noreferrer">
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SeoEditorModal type={type} id={editingId} onClose={() => setEditingId(null)} />
    </div>
  );
}
