import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Plus, ArrowLeft, Save, Eye, EyeOff, Trash2, Loader2,
  ImagePlus, FileText, Tag, Search, Globe, MonitorSmartphone, ShoppingBag, LinkIcon
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';

/** Render content for preview – supports HTML and Markdown */
function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('<') || trimmed.startsWith('<!');
}

function renderPreview(md: string): string {
  if (isHtmlContent(md)) {
    return DOMPurify.sanitize(md, {
      ADD_TAGS: ['iframe', 'video', 'source', 'picture', 'details', 'summary'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'loading', 'target', 'rel', 'style'],
    });
  }
  const html = md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-serif text-foreground mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-serif text-foreground mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-serif text-foreground mt-8 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, text, url) => {
      const isAffiliate = url.includes('adtraction') || url.includes('awin') || url.includes('tradedoubler') || url.includes('partner') || text.includes('→') || text.toLowerCase().includes('köp');
      if (isAffiliate) {
        return `<a href="${url}" target="_blank" rel="noopener sponsored" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity no-underline">${text}</a>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener" class="text-primary underline underline-offset-2 hover:opacity-80">${text}</a>`;
    })
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-foreground/90">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-foreground/90">$1</li>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-4 w-full max-w-lg" loading="lazy" />')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-1 my-4 text-muted-foreground italic">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="my-6 border-border/50" />')
    .replace(/\n\n/g, '</p><p class="text-foreground/85 leading-relaxed mb-4">')
    .replace(/\n/g, '<br />');
  return DOMPurify.sanitize(`<p class="text-foreground/85 leading-relaxed mb-4">${html}</p>`);
}

const stockImages = [
  { path: '/blog-images/hens-garden.jpg', label: 'Höns i trädgård' },
  { path: '/blog-images/eggs-basket.jpg', label: 'Äggkorg' },
  { path: '/blog-images/chicken-coop.jpg', label: 'Hönshus' },
  { path: '/blog-images/hen-portrait.jpg', label: 'Hönsporträtt' },
  { path: '/blog-images/baby-chicks.jpg', label: 'Kycklingar' },
  { path: '/blog-images/eggs-nest.jpg', label: 'Ägg i bo' },
  { path: '/blog-images/hens-feeding.jpg', label: 'Utfodring' },
  { path: '/blog-images/hen-health-check.jpg', label: 'Hälsokontroll' },
  { path: '/blog-images/rooster-portrait.jpg', label: 'Tupp' },
  { path: '/blog-images/hens-autumn.jpg', label: 'Höst' },
  { path: '/blog-images/winter-hens.jpg', label: 'Vinter' },
  { path: '/blog-images/feed-varieties.jpg', label: 'Fodersorter' },
  { path: '/blog-images/hen-with-chicks.jpg', label: 'Höna med kycklingar' },
  { path: '/blog-images/organic-eggs.jpg', label: 'Ekologiska ägg' },
  { path: '/blog-images/building-coop.jpg', label: 'Bygga hönshus' },
  { path: '/blog-images/chicken-breeds.jpg', label: 'Hönsraser' },
  { path: '/blog-images/morning-farm.jpg', label: 'Morgon på gården' },
  { path: '/blog-images/egg-collecting.jpg', label: 'Ägginsamling' },
  { path: '/blog-images/dust-bath.jpg', label: 'Sandbad' },
  { path: '/blog-images/water-station.jpg', label: 'Vattenstation' },
  { path: '/blog-images/hens-meadow.jpg', label: 'Blomsteräng' },
  { path: '/blog-images/sunset-farm.jpg', label: 'Solnedgång' },
  { path: '/blog-images/hen-nesting.jpg', label: 'Höna ruvar' },
  { path: '/blog-images/chicken-run.jpg', label: 'Hönsrastgård' },
  { path: '/blog-images/roost-bar.jpg', label: 'Sittpinne' },
  { path: '/blog-images/farm-kitchen.jpg', label: 'Lantligt kök' },
  { path: '/blog-images/spring-garden.jpg', label: 'Vårträdgård' },
  { path: '/blog-images/hen-detail.jpg', label: 'Hönsdetalj' },
  { path: '/blog-images/silkie-chicken.jpg', label: 'Silkeshöna' },
  { path: '/blog-images/grit-calcium.jpg', label: 'Maggrus' },
];

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  feature_image_url?: string | null;
  category: string | null;
  tags: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords?: string | null;
  reading_time_minutes?: number | null;
  word_count?: number | null;
  is_published: boolean;
  published_at: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getPlainWordCount(value: string) {
  return value.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

async function compressImageToWebP(file: File, maxWidth = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/webp') {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Kunde inte läsa bilden'));
      img.src = imageUrl;
    });

    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Kunde inte komprimera bilden');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('WebP-konvertering misslyckades')), 'image/webp', quality);
    });

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'blog-image';
    return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

type ProductItem = {
  url: string;
  name: string;
  image: string;
  price: string;
  badge: string;
  loading: boolean;
};

const emptyProduct = (): ProductItem => ({ url: '', name: '', image: '', price: '', badge: '', loading: false });

function ProductInsertCard({ onInsert }: { onInsert: (html: string) => void }) {
  const [products, setProducts] = useState<ProductItem[]>([emptyProduct()]);
  const [insertMode, setInsertMode] = useState<'card' | 'table'>('table');

  const updateProduct = (idx: number, updates: Partial<ProductItem>) => {
    setProducts(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
  };

  const autoFetch = async (idx: number, url: string) => {
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;
    updateProduct(idx, { loading: true });
    try {
      const { data, error } = await supabase.functions.invoke('scrape-product', { body: { url } });
      if (error) throw error;
      if (data?.success) {
        const updates: Partial<ProductItem> = { loading: false };
        if (data.title && !products[idx].name) updates.name = data.title;
        if (data.image && !products[idx].image) updates.image = data.image;
        if (data.price && !products[idx].price) updates.price = data.price;
        updateProduct(idx, updates);
        toast({ title: 'Produktdata hämtad!' });
      } else {
        updateProduct(idx, { loading: false });
      }
    } catch {
      updateProduct(idx, { loading: false });
      toast({ title: 'Kunde inte hämta produktdata', variant: 'destructive' });
    }
  };

  const addProduct = () => setProducts(prev => [...prev, emptyProduct()]);
  const removeProduct = (idx: number) => setProducts(prev => prev.filter((_, i) => i !== idx));

  const generateTableHtml = () => {
    const valid = products.filter(p => p.url && p.name);
    if (!valid.length) return '';
    const rows = valid.map(p => {
      const imgHtml = p.image ? `<img class="pct-product-img" src="${p.image}" alt="${p.name}" />` : '';
      const badgeHtml = p.badge ? `<td><span class="pct-badge">${p.badge}</span></td>` : '<td></td>';
      return `    <tr>
      <td><div class="pct-product-cell">${imgHtml}<span class="pct-product-name">${p.name}</span></div></td>
      ${badgeHtml}
      <td><span class="pct-price">${p.price || '–'}</span></td>
      <td><a href="${p.url}" target="_blank" rel="noopener sponsored" class="pct-cta">Se pris →</a></td>
    </tr>`;
    }).join('\n');
    return `<table class="product-comparison-table">
  <thead><tr><th>Produkt</th><th></th><th>Pris</th><th></th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
<p class="product-card-disclosure">* Affiliatelänkar – vi kan få ersättning vid köp.</p>`;
  };

  const generateCardsHtml = () => {
    const valid = products.filter(p => p.url && p.name);
    if (!valid.length) return '';
    const cards = valid.map(p => {
      const imgHtml = p.image ? `<div class="product-card-image"><img src="${p.image}" alt="${p.name}" /></div>` : '';
      const badgeHtml = p.badge ? `<span class="product-card-badge">${p.badge}</span>` : '';
      const priceHtml = p.price ? `<span class="product-card-price">${p.price}</span>` : '';
      return `<div class="product-card">
  ${badgeHtml}
  ${imgHtml}
  <div class="product-card-body">
    <h4 class="product-card-title">${p.name}</h4>
    ${priceHtml}
    <a href="${p.url}" target="_blank" rel="noopener sponsored" class="product-card-cta">Se pris →</a>
  </div>
</div>`;
    }).join('\n');
    return `<div class="product-grid">\n${cards}\n</div>\n<p class="product-card-disclosure">* Affiliatelänkar – vi kan få ersättning vid köp.</p>`;
  };

  const handleInsert = () => {
    const valid = products.filter(p => p.url && p.name);
    if (!valid.length) {
      toast({ title: 'Lägg till minst en produkt med namn och URL', variant: 'destructive' });
      return;
    }
    const html = insertMode === 'table' ? generateTableHtml() : generateCardsHtml();
    onInsert(html);
    setProducts([emptyProduct()]);
    toast({ title: `${insertMode === 'table' ? 'Jämförelsetabell' : 'Produktkort'} infogade!` });
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <ShoppingBag className="h-3 w-3" /> Produkter ({products.length})
        </p>

        {/* Mode toggle */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50">
          <button
            type="button"
            onClick={() => setInsertMode('table')}
            className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${insertMode === 'table' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            📊 Jämförelsetabell
          </button>
          <button
            type="button"
            onClick={() => setInsertMode('card')}
            className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${insertMode === 'card' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            🃏 Produktkort
          </button>
        </div>

        {/* Product list */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-0.5">
          {products.map((prod, idx) => (
            <div key={idx} className="rounded-lg border border-border/40 p-2.5 space-y-1.5 bg-muted/20 relative">
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeProduct(idx)}
                  className="absolute top-1.5 right-1.5 text-destructive/50 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              <div className="flex gap-1.5 items-end">
                <div className="flex-1">
                  <Input
                    value={prod.url}
                    onChange={e => updateProduct(idx, { url: e.target.value })}
                    onBlur={() => autoFetch(idx, prod.url)}
                    placeholder="Klistra in produkt-URL..."
                    className="rounded-lg text-[11px] h-7 font-mono"
                  />
                </div>
                {prod.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0 mb-1" />}
              </div>

              {/* Preview row */}
              <div className="flex items-center gap-2">
                {prod.image ? (
                  <img src={prod.image} alt={prod.name} className="w-10 h-10 rounded-md object-contain bg-background shrink-0 border border-border/30" />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <Input
                    value={prod.name}
                    onChange={e => updateProduct(idx, { name: e.target.value })}
                    placeholder="Produktnamn"
                    className="rounded-lg text-[11px] h-6 px-2 border-border/30"
                  />
                  <div className="flex gap-1">
                    <Input
                      value={prod.price}
                      onChange={e => updateProduct(idx, { price: e.target.value })}
                      placeholder="Pris"
                      className="rounded-lg text-[10px] h-5 px-1.5 border-border/30 flex-1"
                    />
                    <Input
                      value={prod.badge}
                      onChange={e => updateProduct(idx, { badge: e.target.value })}
                      placeholder="Badge"
                      className="rounded-lg text-[10px] h-5 px-1.5 border-border/30 w-20"
                    />
                  </div>
                </div>
              </div>
              <Input
                value={prod.image}
                onChange={e => updateProduct(idx, { image: e.target.value })}
                placeholder="Bild-URL (auto-hämtas)"
                className="rounded-lg text-[10px] h-6 px-2 border-border/30"
              />
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full rounded-xl text-xs h-7 gap-1"
          onClick={addProduct}
        >
          <Plus className="h-3 w-3" /> Lägg till produkt
        </Button>

        <Button
          type="button"
          size="sm"
          className="w-full rounded-xl text-xs h-8 gap-1"
          onClick={handleInsert}
          disabled={!products.some(p => p.url && p.name)}
        >
          <Plus className="h-3 w-3" />
          {insertMode === 'table' ? 'Infoga jämförelsetabell' : 'Infoga produktkort'}
        </Button>
      </CardContent>
    </Card>
  );
}

type EditorMode = 'edit' | 'preview' | 'split';

function PostForm({ post, onBack }: { post?: BlogPost; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(post?.title || '');
  const [slug, setSlug] = useState(post?.slug || '');
  const [excerpt, setExcerpt] = useState(post?.excerpt || '');
  const [content, setContent] = useState(post?.content || '');
  const [category, setCategory] = useState(post?.category || 'guide');
  const [tagsInput, setTagsInput] = useState((post?.tags || []).join(', '));
  const [metaTitle, setMetaTitle] = useState(post?.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(post?.meta_description || '');
  const [metaKeywords, setMetaKeywords] = useState(post?.meta_keywords || '');
  const [coverUrl, setCoverUrl] = useState(post?.feature_image_url || post?.cover_image_url || '');
  const [uploading, setUploading] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [autoSlug, setAutoSlug] = useState(!post);
  const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>((post as any)?.glossary_ids || []);

  // Fetch all glossary entries
  const { data: glossaryEntries = [] } = useQuery({
    queryKey: ['glossary-entries-for-editor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('link_glossary')
        .select('id, keyword, url, is_active')
        .order('keyword', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (autoSlug && title) setSlug(slugify(title));
  }, [title, autoSlug]);

  const saveMutation = useMutation({
    mutationFn: async (publish?: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Ej inloggad');

      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const words = getPlainWordCount(content);
      const postData: any = {
        title,
        slug,
        excerpt: excerpt || null,
        content,
        category,
        tags,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        meta_keywords: metaKeywords || null,
        cover_image_url: coverUrl || null,
        feature_image_url: coverUrl || null,
        reading_time_minutes: Math.max(1, Math.ceil(words / 220)),
        word_count: words,
        author_id: user.id,
        glossary_ids: selectedGlossaryIds,
      };

      if (publish !== undefined) {
        postData.is_published = publish;
        if (publish && !post?.published_at) {
          postData.published_at = new Date().toISOString();
        }
        if (!publish) {
          postData.published_at = null;
        }
      }

      if (post) {
        const { error } = await supabase.from('blog_posts').update(postData).eq('id', post.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('blog_posts').insert(postData);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast({ title: 'Sparad!' });
      onBack();
    },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      if (file.type === 'image/svg+xml') {
        throw new Error('SVG stöds inte för feature-bilder. Ladda upp JPG, PNG eller WebP.');
      }

      const optimizedFile = await compressImageToWebP(file, 1800, 0.8);
      const baseName = slugify(optimizedFile.name.replace(/\.[^.]+$/, '') || title || 'feature-bild');
      const path = `feature-images/${baseName}-${Date.now()}.webp`;
      const { error } = await supabase.storage.from('blog-images').upload(path, optimizedFile, {
        contentType: 'image/webp',
        cacheControl: '31536000',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('blog-images').getPublicUrl(path);
      setCoverUrl(data.publicUrl);
      toast({ title: 'Feature-bild komprimerad till WebP och uppladdad' });
    } catch (err: any) {
      toast({ title: 'Uppladdning misslyckades', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-lg">
          <ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka
        </Button>
        <h2 className="font-serif text-lg flex-1">{post ? 'Redigera artikel' : 'Ny artikel'}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Main content - 2 cols */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Titel</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="T.ex. Bästa hönsfodret 2026" className="rounded-xl font-medium" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">URL-slug</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">/blogg/</span>
                  <Input value={slug} onChange={e => { setSlug(e.target.value); setAutoSlug(false); }} placeholder="basta-honsfodret" className="rounded-xl text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Sammanfattning</label>
                <Textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Kort beskrivning som visas i listan..." rows={2} className="rounded-xl" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Innehåll (Markdown / HTML)</label>
                  <div className="flex gap-0.5 p-0.5 rounded-lg bg-muted/50">
                    <button
                      type="button"
                      onClick={() => setEditorMode('edit')}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${editorMode === 'edit' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                      ✏️ Redigera
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('split')}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${editorMode === 'split' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                      📐 Delad vy
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode('preview')}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${editorMode === 'preview' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                      👁️ Förhandsvisa
                    </button>
                  </div>
                </div>

                {editorMode === 'split' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Skriv din artikel här..." rows={24} className="rounded-xl font-mono text-sm h-[600px] resize-none" />
                    </div>
                    <div className="rounded-xl border border-border/60 bg-background p-4 overflow-auto h-[600px]">
                      {coverUrl && (
                        <img src={coverUrl} alt={title} className="w-full aspect-video object-cover rounded-xl mb-4" />
                      )}
                      <h1 className="text-xl font-serif text-foreground mb-2">{title || 'Utan titel'}</h1>
                      {excerpt && <p className="text-muted-foreground text-xs mb-4">{excerpt}</p>}
                      <div
                        className="prose-custom text-sm"
                        dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
                      />
                    </div>
                  </div>
                ) : editorMode === 'preview' ? (
                  <div className="rounded-xl border border-border/60 bg-background p-4 sm:p-6 min-h-[400px] overflow-auto">
                    {coverUrl && (
                      <img src={coverUrl} alt={title} className="w-full aspect-video object-cover rounded-xl mb-6" />
                    )}
                    <h1 className="text-2xl sm:text-3xl font-serif text-foreground mb-2">{title || 'Utan titel'}</h1>
                    {excerpt && <p className="text-muted-foreground text-sm mb-6">{excerpt}</p>}
                    <div
                      className="prose-custom"
                      dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
                    />
                  </div>
                ) : (
                  <>
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Skriv din artikel här... Använd **fetstil**, *kursiv*, ## rubriker, [länktext](url) eller klistra in HTML." rows={16} className="rounded-xl font-mono text-sm" />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Tips: Använd [Köp här →](https://din-affiliate-länk.se) för affiliate-länkar. Du kan även klistra in ren HTML.
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Publicering</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => saveMutation.mutate(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-lg text-xs"
                  disabled={saveMutation.isPending || !title || !slug}
                >
                  <Save className="h-3 w-3 mr-1" /> Spara utkast
                </Button>
                <Button
                  onClick={() => saveMutation.mutate(true)}
                  size="sm"
                  className="flex-1 rounded-lg text-xs"
                  disabled={saveMutation.isPending || !title || !slug || !content}
                >
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3 mr-1" />}
                  Publicera
                </Button>
              </div>
              {post?.is_published && (
                <Button
                  onClick={() => saveMutation.mutate(false)}
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg text-xs text-warning"
                  disabled={saveMutation.isPending}
                >
                  <EyeOff className="h-3 w-3 mr-1" /> Avpublicera
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Feature image */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ImagePlus className="h-3 w-3" /> Feature-bild</p>
              {coverUrl ? (
                <div className="relative">
                  <img src={coverUrl} alt="Feature-bild" className="rounded-lg w-full aspect-video object-cover" />
                  <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => setCoverUrl('')}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground">{uploading ? 'Komprimerar till WebP och laddar upp...' : 'Ladda upp JPG/PNG/WebP – sparas som WebP'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                </label>
              )}
              <Input value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="Eller klistra in bild-URL" className="rounded-xl text-xs" />
              
              {/* Image gallery picker */}
              <div>
                <p className="text-[10px] font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <ImagePlus className="h-3 w-3" /> Välj från bildgalleriet ({stockImages.length} st)
                </p>
                <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto rounded-lg border border-border/40 p-1.5">
                  {stockImages.map((img) => (
                    <button
                      key={img.path}
                      type="button"
                      onClick={() => setCoverUrl(img.path)}
                      className={`relative aspect-video rounded-md overflow-hidden border-2 transition-all hover:opacity-90 ${coverUrl === img.path ? 'border-primary ring-1 ring-primary' : 'border-border/30 hover:border-primary/40'}`}
                    >
                      <img src={img.path} alt={img.label} className="w-full h-full object-cover" loading="lazy" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] leading-tight px-1 py-0.5 truncate">{img.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category & tags */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><FileText className="h-3 w-3" /> Kategori</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-xl text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guide">Guide</SelectItem>
                    <SelectItem value="recension">Recension</SelectItem>
                    <SelectItem value="tips">Tips & tricks</SelectItem>
                    <SelectItem value="halsa">Hälsa</SelectItem>
                    <SelectItem value="nyborjare">Nybörjare</SelectItem>
                    <SelectItem value="raser">Raser</SelectItem>
                    <SelectItem value="tradgard">Trädgård & odling</SelectItem>
                    <SelectItem value="hem">Hem & hållbarhet</SelectItem>
                    <SelectItem value="friluftsliv">Friluftsliv & natur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Tag className="h-3 w-3" /> Taggar</label>
                <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="foder, höns, recension" className="rounded-xl text-xs" />
                <p className="text-[9px] text-muted-foreground mt-0.5">Kommaseparerade</p>
              </div>
            </CardContent>
          </Card>

          {/* Glossary / Länkord picker */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <LinkIcon className="h-3 w-3" /> Länkord ({selectedGlossaryIds.length} valda)
              </p>
              <p className="text-[9px] text-muted-foreground">Välj vilka affiliatelänkord som ska appliceras automatiskt i denna artikel.</p>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                {glossaryEntries.filter(e => e.is_active).map(entry => (
                  <label
                    key={entry.id}
                    className={`flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
                      selectedGlossaryIds.includes(entry.id) ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGlossaryIds.includes(entry.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGlossaryIds(prev => [...prev, entry.id]);
                        } else {
                          setSelectedGlossaryIds(prev => prev.filter(id => id !== entry.id));
                        }
                      }}
                      className="rounded border-border accent-primary h-3 w-3"
                    />
                    <span className="font-medium truncate">{entry.keyword}</span>
                    <span className="text-[9px] text-muted-foreground truncate ml-auto max-w-[100px]">{new URL(entry.url).hostname}</span>
                  </label>
                ))}
                {glossaryEntries.filter(e => e.is_active).length === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-3">Inga länkord finns. Skapa dem i Länkord-fliken.</p>
                )}
              </div>
              {glossaryEntries.filter(e => e.is_active).length > 0 && (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg text-[10px] h-6"
                    onClick={() => setSelectedGlossaryIds(glossaryEntries.filter(e => e.is_active).map(e => e.id))}
                  >
                    Välj alla
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-lg text-[10px] h-6"
                    onClick={() => setSelectedGlossaryIds([])}
                  >
                    Avmarkera alla
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick product insert */}
          <ProductInsertCard onInsert={(html) => setContent(prev => prev + '\n\n' + html)} />

          {/* SEO */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" /> SEO</p>
              <div>
                <label className="text-[10px] text-muted-foreground">Meta-titel (max 60 tecken)</label>
                <Input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={title || 'Sidtitel'} className="rounded-xl text-xs" maxLength={60} />
                <span className="text-[9px] text-muted-foreground">{(metaTitle || title).length}/60</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Meta-beskrivning (max 160 tecken)</label>
                <Textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} placeholder={excerpt || 'Beskrivning för sökmotorer'} rows={2} className="rounded-xl text-xs" maxLength={160} />
                <span className="text-[9px] text-muted-foreground">{(metaDescription || excerpt || '').length}/160</span>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Meta-keywords</label>
                <Input value={metaKeywords} onChange={e => setMetaKeywords(e.target.value)} placeholder="hönsras, värphöns, lanthöns" className="rounded-xl text-xs" />
              </div>
              <p className="text-[10px] text-muted-foreground">{getPlainWordCount(content)} ord · ca {Math.max(1, Math.ceil(getPlainWordCount(content) / 220))} min läsning</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function BlogEditor() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<BlogPost | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['admin-blog-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BlogPost[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast({ title: 'Artikel raderad' });
    },
  });

  if (editing) {
    return <PostForm post={editing === 'new' ? undefined : editing} onBack={() => setEditing(null)} />;
  }

  const filtered = search
    ? posts.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : posts;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sök artiklar..." className="pl-9 rounded-xl h-10" />
        </div>
        <Button onClick={() => setEditing('new')} size="sm" className="rounded-xl gap-1">
          <Plus className="h-4 w-4" /> Ny artikel
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !filtered.length ? (
        <div className="text-center py-12">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{search ? 'Inga artiklar matchade sökningen.' : 'Inga artiklar ännu.'}</p>
          <Button onClick={() => setEditing('new')} variant="outline" size="sm" className="mt-3 rounded-xl">
            <Plus className="h-3 w-3 mr-1" /> Skapa din första artikel
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(post => (
            <Card key={post.id} className="border-border/50 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => setEditing(post)}>
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                {post.cover_image_url ? (
                  <img src={post.cover_image_url} alt="" className="w-14 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="secondary" className={`text-[9px] ${post.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground'}`}>
                      {post.is_published ? '● Publicerad' : 'Utkast'}
                    </Badge>
                    {post.category && (
                      <Badge variant="outline" className="text-[9px]">{post.category}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(post.updated_at).toLocaleDateString('sv-SE')}
                    </span>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/50 hover:text-destructive shrink-0" onClick={e => e.stopPropagation()}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl" onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif">Radera artikel?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Detta raderar <strong>{post.title}</strong> permanent.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Avbryt</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                        onClick={() => deleteMutation.mutate(post.id)}
                      >
                        Radera
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
