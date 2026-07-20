import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import type { Tables } from '@/integrations/supabase/types';

type ShopProduct = Tables<'shop_products'>;

export interface ProductFormValues {
  name: string;
  description: string;
  emoji: string;
  image_url: string;
  priceOre: number;
  stock: number | null;
  sort_order: number;
  active: boolean;
}

const EMOJI_CHOICES = ['🥚', '🐔', '👕', '☕', '🧢', '🧺', '🍯', '🌼', '🎁', '📦', '🕯️', '🧶'];

interface ShopProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null = ny produkt, annars redigering */
  product: ShopProduct | null;
  onSave: (values: ProductFormValues) => Promise<void>;
}

/** Dialog för att skapa/redigera en butiksprodukt. */
export default function ShopProductForm({ open, onOpenChange, product, onSave }: ShopProductFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🥚');
  const [imageUrl, setImageUrl] = useState('');
  const [priceKr, setPriceKr] = useState('');
  const [stockText, setStockText] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(product?.name ?? '');
    setDescription(product?.description ?? '');
    setEmoji(product?.emoji ?? '🥚');
    setImageUrl(product?.image_url ?? '');
    setPriceKr(product ? String(product.price_ore / 100).replace('.', ',') : '');
    setStockText(product?.stock === null || product?.stock === undefined ? '' : String(product.stock));
    setSortOrder(String(product?.sort_order ?? 0));
    setActive(product?.active ?? true);
  }, [open, product]);

  const handleSave = async () => {
    const parsed = parseFloat(priceKr.replace(/\s/g, '').replace(',', '.'));
    if (!name.trim()) { setError('Produkten behöver ett namn.'); return; }
    if (!Number.isFinite(parsed) || parsed < 0.5) { setError('Ange ett pris på minst 0,50 kr.'); return; }
    const stockParsed = stockText.trim() === '' ? null : parseInt(stockText, 10);
    if (stockParsed !== null && (!Number.isInteger(stockParsed) || stockParsed < 0)) {
      setError('Lagersaldo måste vara ett heltal (eller tomt för obegränsat).'); return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        emoji,
        image_url: imageUrl.trim(),
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
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {product ? 'Redigera produkt' : 'Ny produkt'}
          </DialogTitle>
          <DialogDescription>
            Priset sätts i kronor – Stripe drar exakt detta belopp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sp-name">Namn</Label>
            <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Hönsgården T-shirt" className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-desc">Beskrivning</Label>
            <Textarea id="sp-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Kort säljande beskrivning…" rows={3} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <Label>Bild (emoji eller bild-URL)</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e} type="button"
                  onClick={() => { setEmoji(e); setImageUrl(''); }}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all ${
                    emoji === e && !imageUrl
                      ? 'border-primary bg-primary/10 scale-110'
                      : 'border-border/60 hover:border-primary/40'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="…eller klistra in en bild-URL (valfritt)" className="rounded-xl mt-1.5" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-price">Pris (kr)</Label>
              <Input id="sp-price" inputMode="decimal" value={priceKr}
                onChange={(e) => setPriceKr(e.target.value)} placeholder="249" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-stock">Lager (valfritt)</Label>
              <Input id="sp-stock" inputMode="numeric" value={stockText}
                onChange={(e) => setStockText(e.target.value)} placeholder="∞" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-sort">Sortering</Label>
              <Input id="sp-sort" inputMode="numeric" value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)} className="rounded-xl" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Synlig i butiken</p>
              <p className="text-xs text-muted-foreground">Slå av för att dölja utan att ta bort</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
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
