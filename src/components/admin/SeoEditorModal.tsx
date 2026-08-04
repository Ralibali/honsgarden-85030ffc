import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Sparkles, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

export type SeoType = 'seo_breeds' | 'seo_problems' | 'seo_care_topics' | 'seo_months';

const AI_SHORT: Record<SeoType, 'breeds' | 'problems' | 'care' | 'months'> = {
  seo_breeds: 'breeds',
  seo_problems: 'problems',
  seo_care_topics: 'care',
  seo_months: 'months',
};

interface SeoEditorModalProps {
  type: SeoType;
  id: string | null;
  onClose: () => void;
}

const formatJson = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
};

const parseJsonField = (value: string): unknown => {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export default function SeoEditorModal({ type, id, onClose }: SeoEditorModalProps) {
  const queryClient = useQueryClient();
  const open = Boolean(id);

  const { data: row, isLoading } = useQuery({
    queryKey: ['seo-editor', type, id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from(type).select('*').eq('id', id!).single();
      if (error) throw new Error(error.message);
      return data as Record<string, any>;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!row) return;
    setForm({
      summary: row.summary ?? '',
      content: row.content ?? '',
      meta_title: row.meta_title ?? '',
      meta_description: row.meta_description ?? '',
      og_image_url: row.og_image_url ?? '',
      key_facts: formatJson(row.key_facts),
      faq: formatJson(row.faq),
      authoritative_sources: formatJson(row.authoritative_sources),
      medical_disclaimer: row.medical_disclaimer ?? '',
      medically_reviewed_by: row.medically_reviewed_by ?? '',
    });
    setPublished(Boolean(row.published));
  }, [row]);

  const saveMutation = useMutation({
    mutationFn: async (extras: Partial<Record<string, unknown>> = {}) => {
      const patch: Record<string, unknown> = {
        summary: form.summary || null,
        content: form.content || null,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        og_image_url: form.og_image_url || null,
        key_facts: parseJsonField(form.key_facts),
        faq: parseJsonField(form.faq),
        authoritative_sources: parseJsonField(form.authoritative_sources),
        ...extras,
      };
      if (type === 'seo_breeds' || type === 'seo_problems') {
        patch.medical_disclaimer = form.medical_disclaimer || null;
        patch.medically_reviewed_by = form.medically_reviewed_by || null;
        if (form.medically_reviewed_by) patch.reviewed_at = new Date().toISOString();
      }
      const { error } = await supabase.from(type).update(patch as never).eq('id', id!);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seo-editor', type, id] });
      queryClient.invalidateQueries({ queryKey: ['seo-admin', type] });
      toast({ title: 'Sparat' });
    },
    onError: (err: Error) => toast({ title: 'Kunde inte spara', description: err.message, variant: 'destructive' }),
  });

  const generateMutation = useMutation({
    mutationFn: async (autoPublish: boolean) => {
      const { data, error } = await supabase.functions.invoke('seo-generate-content', {
        body: { type: AI_SHORT[type], id, auto_publish: autoPublish },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, autoPublish) => {
      queryClient.invalidateQueries({ queryKey: ['seo-editor', type, id] });
      queryClient.invalidateQueries({ queryKey: ['seo-admin', type] });
      toast({ title: autoPublish ? '✅ Genererad och publicerad' : 'Genererad — granska innan publicering' });
    },
    onError: (err: Error) => toast({ title: 'AI-generering misslyckades', description: err.message, variant: 'destructive' }),
  });

  const togglePublishMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.from(type).update({ published: next } as never).eq('id', id!);
      if (error) throw new Error(error.message);
      return next;
    },
    onSuccess: (next) => {
      setPublished(next);
      queryClient.invalidateQueries({ queryKey: ['seo-admin', type] });
      toast({ title: next ? 'Publicerad' : 'Avpublicerad' });
    },
  });

  const showMedical = type === 'seo_breeds' || type === 'seo_problems';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            {row?.name ?? 'Laddar...'}
            <Badge variant={published ? 'default' : 'secondary'} className="text-[10px]">
              {published ? 'Publicerad' : 'Utkast'}
            </Badge>
            {row?.generation_status && (
              <Badge variant="outline" className="text-[10px]">{row.generation_status}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {/* AI actions */}
            <div className="flex flex-wrap gap-2 rounded-xl bg-muted/40 p-3">
              <Button
                size="sm"
                className="rounded-lg gap-1.5"
                disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate(true)}
              >
                {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI generera + publicera
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg gap-1.5"
                disabled={generateMutation.isPending}
                onClick={() => generateMutation.mutate(false)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                AI generera (utkast)
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={published}
                  disabled={togglePublishMutation.isPending}
                  onCheckedChange={(v) => togglePublishMutation.mutate(v)}
                />
                <span>Publicerad</span>
              </div>
            </div>

            <Tabs defaultValue="content" className="space-y-3">
              <TabsList className="flex w-full overflow-x-auto rounded-xl">
                <TabsTrigger value="content" className="rounded-lg text-xs">Innehåll</TabsTrigger>
                <TabsTrigger value="seo" className="rounded-lg text-xs">SEO &amp; bild</TabsTrigger>
                <TabsTrigger value="data" className="rounded-lg text-xs">Fakta &amp; FAQ</TabsTrigger>
                <TabsTrigger value="sources" className="rounded-lg text-xs">Källor</TabsTrigger>
                {showMedical && <TabsTrigger value="medical" className="rounded-lg text-xs">Granskning</TabsTrigger>}
              </TabsList>

              <TabsContent value="content" className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sammanfattning</Label>
                  <Textarea
                    rows={3}
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    className="rounded-xl"
                    placeholder="Kort introduktion (1–2 meningar)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Huvudinnehåll (markdown)</Label>
                  <Textarea
                    rows={18}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className="rounded-xl font-mono text-xs"
                    placeholder="## Rubrik\n\nText..."
                  />
                  <p className="text-[10px] text-muted-foreground">{form.content?.length ?? 0} tecken</p>
                </div>
              </TabsContent>

              <TabsContent value="seo" className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Meta title (max 60)</Label>
                  <Input
                    value={form.meta_title}
                    onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                    maxLength={70}
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">{form.meta_title?.length ?? 0}/60</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Meta description (max 155)</Label>
                  <Textarea
                    rows={3}
                    value={form.meta_description}
                    onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                    maxLength={170}
                    className="rounded-xl"
                  />
                  <p className="text-[10px] text-muted-foreground">{form.meta_description?.length ?? 0}/155</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">OG-bild URL</Label>
                  <Input
                    value={form.og_image_url}
                    onChange={(e) => setForm({ ...form, og_image_url: e.target.value })}
                    placeholder="https://..."
                    className="rounded-xl"
                  />
                  {form.og_image_url && (
                    <img src={form.og_image_url} alt="OG preview" className="mt-2 h-32 w-full rounded-lg object-cover" />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="data" className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Key facts (JSON-array)</Label>
                  <Textarea
                    rows={8}
                    value={form.key_facts}
                    onChange={(e) => setForm({ ...form, key_facts: e.target.value })}
                    className="rounded-xl font-mono text-xs"
                    placeholder='[{"label": "Ursprung", "value": "Sverige"}]'
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">FAQ (JSON-array)</Label>
                  <Textarea
                    rows={10}
                    value={form.faq}
                    onChange={(e) => setForm({ ...form, faq: e.target.value })}
                    className="rounded-xl font-mono text-xs"
                    placeholder='[{"question": "...", "answer": "..."}]'
                  />
                </div>
              </TabsContent>

              <TabsContent value="sources" className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Auktoritativa källor (JSON-array)</Label>
                  <Textarea
                    rows={10}
                    value={form.authoritative_sources}
                    onChange={(e) => setForm({ ...form, authoritative_sources: e.target.value })}
                    className="rounded-xl font-mono text-xs"
                    placeholder='[{"title": "...", "url": "https://...", "publisher": "Jordbruksverket"}]'
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Använd svenska myndigheter/organisationer (Jordbruksverket, SVA, SLU) när relevant.
                  </p>
                </div>
              </TabsContent>

              {showMedical && (
                <TabsContent value="medical" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Medicinsk disclaimer</Label>
                    <Textarea
                      rows={4}
                      value={form.medical_disclaimer}
                      onChange={(e) => setForm({ ...form, medical_disclaimer: e.target.value })}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Granskad av (namn / titel)</Label>
                    <Input
                      value={form.medically_reviewed_by}
                      onChange={(e) => setForm({ ...form, medically_reviewed_by: e.target.value })}
                      className="rounded-xl"
                      placeholder="Ex: Dr. Anna Svensson, leg. veterinär"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      När du sparar med ett namn här uppdateras granskningsdatum automatiskt.
                    </p>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-xl gap-1.5">
            <X className="h-4 w-4" /> Stäng
          </Button>
          <Button
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({})}
            className="rounded-xl gap-1.5"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Spara
          </Button>
          <Button
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate({ published: true })}
            className="rounded-xl gap-1.5"
          >
            <Send className="h-4 w-4" /> Spara &amp; publicera
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
