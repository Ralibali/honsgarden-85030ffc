import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { Tables } from '@/integrations/supabase/types';
import ShopVariantsSection from './ShopVariantsSection';
import { normalizeSlug, isValidSlug, isValidHttpUrl, validateShippingDays } from '@/lib/shop/validation';

type ShopProduct = Tables<'shop_products'>;

export interface ProductFormValues {
  name: string;
  slug: string;
  description: string;
  long_description: string;
  emoji: string;
  image_url: string;
  images: string[];
  features: string[];
  specifications: Record<string, string>;
  category: string;
  badge: string;
  featured: boolean;
  shipping_days_min: number | null;
  shipping_days_max: number | null;
  priceOre: number;
  stock: number | null;
  sort_order: number;
  active: boolean;
}

const EMOJI_CHOICES = ['🥚', '🐔', '👕', '☕', '🧢', '🧺', '🍯', '🌼', '🎁', '📦', '🕯️', '🧶'];

interface ShopProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ShopProduct | null;
  onSave: (values: ProductFormValues) => Promise<void>;
}

// Slug via delad validation.ts – ingen duplicerad slugify här.

export default function ShopProductForm({ open, onOpenChange, product, onSave }: ShopProductFormProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [emoji, setEmoji] = useState('🥚');
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImage, setNewImage] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  const [specs, setSpecs] = useState<{ key: string; value: string }[]>([]);
  const [category, setCategory] = useState('');
  const [badge, setBadge] = useState('');
  const [featured, setFeatured] = useState(false);
  const [shipMin, setShipMin] = useState('');
  const [shipMax, setShipMax] = useState('');
  const [priceKr, setPriceKr] = useState('');
  const [stockText, setStockText] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(false);
    setName(product?.name ?? '');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = product as any;
    setSlug(p?.slug ?? '');
    setDescription(product?.description ?? '');
    setLongDescription(p?.long_description ?? '');
    setEmoji(product?.emoji ?? '🥚');
    setImageUrl(product?.image_url ?? '');
    setImages(Array.isArray(p?.images) ? p.images : []);
    setFeatures(Array.isArray(p?.features) ? p.features : []);
    const spec = (p?.specifications && typeof p.specifications === 'object') ? p.specifications : {};
    setSpecs(Object.entries(spec).map(([key, value]) => ({ key, value: String(value) })));
    setCategory(p?.category ?? '');
    setBadge(p?.badge ?? '');
    setFeatured(!!p?.featured);
    setShipMin(p?.shipping_days_min != null ? String(p.shipping_days_min) : '');
    setShipMax(p?.shipping_days_max != null ? String(p.shipping_days_max) : '');
    setPriceKr(product ? String(product.price_ore / 100).replace('.', ',') : '');
    setStockText(product?.stock === null || product?.stock === undefined ? '' : String(product.stock));
    setSortOrder(String(product?.sort_order ?? 0));
    setActive(product?.active ?? true);
    setNewImage(''); setNewFeature('');
  }, [open, product]);

  const autoSlug = useMemo(() => normalizeSlug(name), [name]);
  const effectiveSlug = slugTouched || slug ? slug : autoSlug;

  const handleSave = async () => {
    const parsed = parseFloat(priceKr.replace(/\s/g, '').replace(',', '.'));
    if (!name.trim()) { setError('Produkten behöver ett namn.'); return; }
    const finalSlug = normalizeSlug(effectiveSlug) || normalizeSlug(name);
    if (!isValidSlug(finalSlug)) {
      setError('URL-slug måste bara innehålla små bokstäver, siffror och bindestreck.'); return;
    }
    if (!Number.isFinite(parsed) || parsed < 0.5) { setError('Ange ett pris på minst 0,50 kr.'); return; }
    const stockParsed = stockText.trim() === '' ? null : parseInt(stockText, 10);
    if (stockParsed !== null && (!Number.isInteger(stockParsed) || stockParsed < 0)) {
      setError('Lagersaldo måste vara ett heltal (eller tomt för obegränsat).'); return;
    }
    const shipMinVal = shipMin.trim() === '' ? null : parseInt(shipMin, 10);
    const shipMaxVal = shipMax.trim() === '' ? null : parseInt(shipMax, 10);
    const shipCheck = validateShippingDays(shipMinVal, shipMaxVal);
    if (!shipCheck.ok) { setError(shipCheck.error ?? 'Ogiltig leveranstid.'); return; }
    if (imageUrl.trim() && !isValidHttpUrl(imageUrl.trim())) {
      setError('Huvudbildens URL måste börja med http:// eller https://.'); return;
    }
    const badImage = images.find((u) => !isValidHttpUrl(u));
    if (badImage) { setError('Alla bild-URL:er måste börja med http:// eller https://.'); return; }
    const specsObj: Record<string, string> = {};
    specs.forEach((s) => { if (s.key.trim()) specsObj[s.key.trim()] = s.value; });

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        long_description: longDescription.trim(),
        emoji,
        image_url: imageUrl.trim(),
        images,
        features: features.filter((f) => f.trim()),
        specifications: specsObj,
        category: category.trim(),
        badge: badge.trim(),
        featured,
        shipping_days_min: shipMinVal,
        shipping_days_max: shipMaxVal,
        priceOre: Math.round(parsed * 100),
        stock: stockParsed,
        sort_order: parseInt(sortOrder, 10) || 0,
        active,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte spara produkten.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {product ? 'Redigera produkt' : 'Ny produkt'}
          </DialogTitle>
          <DialogDescription>
            Priset sätts i kronor – Stripe drar exakt detta belopp.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basics" className="mt-2">
          <TabsList className="rounded-xl">
            <TabsTrigger value="basics" className="rounded-lg">Grunder</TabsTrigger>
            <TabsTrigger value="details" className="rounded-lg">Beskrivning</TabsTrigger>
            <TabsTrigger value="media" className="rounded-lg">Media</TabsTrigger>
            <TabsTrigger value="variants" className="rounded-lg">Varianter</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-name">Namn</Label>
              <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Hönsgården T-shirt" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-slug">URL-slug</Label>
              <Input id="sp-slug" value={effectiveSlug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                placeholder={autoSlug || 'honsgarden-tshirt'} className="rounded-xl font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Används i /butik/produkt/{effectiveSlug || 'namn'}.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-desc">Kort beskrivning</Label>
              <Textarea id="sp-desc" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Kort säljande beskrivning – syns på kortet i butiken." rows={2} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-cat">Kategori</Label>
                <Input id="sp-cat" value={category} onChange={(e) => setCategory(e.target.value)}
                  placeholder="Kläder, Kartonger, Böcker…" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-badge">Badge (valfritt)</Label>
                <Input id="sp-badge" value={badge} onChange={(e) => setBadge(e.target.value)}
                  placeholder="Nyhet, Populär, -20%" className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-price">Pris (kr)</Label>
                <Input id="sp-price" inputMode="decimal" value={priceKr}
                  onChange={(e) => setPriceKr(e.target.value)} placeholder="249" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-stock">Lager</Label>
                <Input id="sp-stock" inputMode="numeric" value={stockText}
                  onChange={(e) => setStockText(e.target.value)} placeholder="∞" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-sort">Sortering</Label>
                <Input id="sp-sort" inputMode="numeric" value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-shipmin">Leveranstid min (dagar)</Label>
                <Input id="sp-shipmin" inputMode="numeric" value={shipMin}
                  onChange={(e) => setShipMin(e.target.value)} placeholder="ärver butik" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-shipmax">Leveranstid max (dagar)</Label>
                <Input id="sp-shipmax" inputMode="numeric" value={shipMax}
                  onChange={(e) => setShipMax(e.target.value)} placeholder="ärver butik" className="rounded-xl" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Synlig i butiken</p>
                <p className="text-xs text-muted-foreground">Slå av för att dölja utan att ta bort</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Framhäv i butiken</p>
                <p className="text-xs text-muted-foreground">Visas först under "Rekommenderat"</p>
              </div>
              <Switch checked={featured} onCheckedChange={setFeatured} />
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-long">Lång beskrivning</Label>
              <Textarea id="sp-long" rows={6} value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                placeholder="Fyllig produkttext för produktsidan. Enkla radbrytningar stödjs." className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Nyckelfördelar</Label>
              <div className="flex gap-2">
                <Input value={newFeature} onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="T.ex. Ekologiskt certifierad" className="rounded-xl"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(''); } } }} />
                <Button type="button" variant="outline" className="rounded-xl"
                  onClick={() => { if (newFeature.trim()) { setFeatures([...features, newFeature.trim()]); setNewFeature(''); } }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {features.map((f, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                      {f}
                      <button type="button" onClick={() => setFeatures(features.filter((_, j) => j !== i))}
                        className="hover:text-destructive"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Specifikationer (nyckel / värde)</Label>
              {specs.map((sp, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={sp.key} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                    placeholder="Material" className="rounded-xl" />
                  <Input value={sp.value} onChange={(e) => setSpecs(specs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                    placeholder="100% ekologisk bomull" className="rounded-xl" />
                  <Button type="button" variant="ghost" size="icon" className="rounded-xl"
                    onClick={() => setSpecs(specs.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="rounded-xl"
                onClick={() => setSpecs([...specs, { key: '', value: '' }])}>
                <Plus className="h-4 w-4 mr-1" /> Lägg till rad
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Fallback-emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map((e) => (
                  <button key={e} type="button"
                    onClick={() => setEmoji(e)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all ${
                      emoji === e ? 'border-primary bg-primary/10 scale-110' : 'border-border/60 hover:border-primary/40'
                    }`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Huvudbild (URL)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…" className="rounded-xl" />
              {imageUrl && (
                <div className="rounded-xl overflow-hidden border w-32 h-32 mt-1">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Fler bilder (för galleri)</Label>
              <div className="flex gap-2">
                <Input value={newImage} onChange={(e) => setNewImage(e.target.value)}
                  placeholder="https://…" className="rounded-xl"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newImage.trim()) { setImages([...images, newImage.trim()]); setNewImage(''); } } }} />
                <Button type="button" variant="outline" className="rounded-xl"
                  onClick={() => { if (newImage.trim()) { setImages([...images, newImage.trim()]); setNewImage(''); } }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {images.map((src, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border aspect-square">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button"
                        onClick={() => setImages(images.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="variants" className="pt-4">
            <ShopVariantsSection productId={product?.id ?? null} />
          </TabsContent>
        </Tabs>

        {error && <p className="text-sm text-destructive pt-2">{error}</p>}

        <DialogFooter className="pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Avbryt</Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {product ? 'Spara ändringar' : 'Lägg till produkt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
