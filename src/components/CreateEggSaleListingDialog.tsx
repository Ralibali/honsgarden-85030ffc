import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, ImagePlus, X } from 'lucide-react';

function slugify(input: string) {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å|ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'agg'}-${suffix}`;
}

type Props = {
  trigger?: React.ReactNode;
};

export default function CreateEggSaleListingDialog({ trigger }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [pricePerPack, setPricePerPack] = useState<string>('60');
  const [eggsPerPack, setEggsPerPack] = useState<string>('12');
  const [stockPacks, setStockPacks] = useState<string>('5');
  const [pickupInfo, setPickupInfo] = useState('');
  const [swishNumber, setSwishNumber] = useState('');
  const [swishName, setSwishName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const reset = () => {
    setTitle(''); setDescription(''); setLocation('');
    setPricePerPack('60'); setEggsPerPack('12'); setStockPacks('5');
    setPickupInfo(''); setSwishNumber(''); setSwishName('');
    setImageUrl(null);
  };

  const onImageChange = async (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Bilden är för stor', description: 'Max 5 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Du måste vara inloggad.');
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('egg-sale-images').upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('egg-sale-images').getPublicUrl(path);
      setImageUrl(pub.publicUrl);
    } catch (err: any) {
      toast({ title: 'Kunde inte ladda upp bilden', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: 'Titel saknas', description: 'Skriv en kort rubrik för säljsidan.', variant: 'destructive' });
      return;
    }
    const price = Number(pricePerPack);
    const stock = Number(stockPacks);
    const eggs = Number(eggsPerPack);
    if (!Number.isFinite(price) || price <= 0) {
      toast({ title: 'Felaktigt pris', variant: 'destructive' }); return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast({ title: 'Felaktigt lagerantal', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error('Du måste vara inloggad.');
      const payload = {
        user_id: userData.user.id,
        slug: slugify(title),
        title: title.trim(),
        description: description.trim() || 'Färska ägg från lokal hönsgård.',
        location: location.trim() || null,
        price_per_pack: price,
        eggs_per_pack: Number.isFinite(eggs) && eggs > 0 ? eggs : 12,
        packs_available: stock,
        stock_packs: stock,
        stock_source: 'manual',
        pickup_info: pickupInfo.trim() || null,
        swish_number: swishNumber.trim() || null,
        swish_name: swishName.trim() || null,
        image_url: imageUrl,
        is_active: true,
        auto_publish: true,
      };
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .insert(payload)
        .select('id, slug')
        .single();
      if (error) throw error;
      toast({
        title: 'Säljsidan är skapad! 🥚',
        description: `Din länk: honsgarden.se/s/${data.slug}`,
      });
      queryClient.invalidateQueries({ queryKey: ['egg-sales-browser-listings'] });
      queryClient.invalidateQueries({ queryKey: ['agda-pro-listings'] });
      queryClient.invalidateQueries({ queryKey: ['egg-sales-overview-listings'] });
      reset();
      setOpen(false);
    } catch (err: any) {
      toast({
        title: 'Det gick inte att skapa säljsidan',
        description: err?.message || err?.error_description || 'Försök igen om en stund.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> Skapa säljsida
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Skapa ny säljsida</DialogTitle>
          <DialogDescription>
            Fyll i en rubrik, pris och hämtinformation. Du kan ändra allt senare.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Rubrik *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="t.ex. Färska ägg från Strömsnäs gård" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Beskrivning</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} placeholder="Berätta lite om dina höns, hur länge äggen är från osv." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="price">Pris per karta (kr) *</Label>
              <Input id="price" type="number" min={1} step={1} value={pricePerPack} onChange={(e) => setPricePerPack(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eggs">Ägg per karta</Label>
              <Input id="eggs" type="number" min={1} step={1} value={eggsPerPack} onChange={(e) => setEggsPerPack(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock">Antal kartor i lager *</Label>
            <Input id="stock" type="number" min={0} step={1} value={stockPacks} onChange={(e) => setStockPacks(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Plats (visas för köpare)</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value.slice(0, 80))} placeholder="t.ex. Strömsnäs, Vimmerby" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pickup">Hämtinformation</Label>
            <Textarea id="pickup" value={pickupInfo} onChange={(e) => setPickupInfo(e.target.value.slice(0, 300))} placeholder="t.ex. Hämtas vid ladugården vardagar 16–19." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="swish">Swish-nummer</Label>
              <Input id="swish" value={swishNumber} onChange={(e) => setSwishNumber(e.target.value.slice(0, 20))} placeholder="123 456 78 90" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="swish-name">Swish-mottagare</Label>
              <Input id="swish-name" value={swishName} onChange={(e) => setSwishName(e.target.value.slice(0, 40))} placeholder="t.ex. Emelie H." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bild (valfritt)</Label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border">
                <img src={imageUrl} alt="" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/90 border flex items-center justify-center"
                  aria-label="Ta bort bild"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border border-dashed rounded-xl px-3 py-6 cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? 'Laddar upp…' : 'Lägg till bild (max 5 MB)'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageChange(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          <LegalReadinessChecklist />



          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Avbryt</Button>
            <Button type="submit" disabled={saving || uploading} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Sparar…' : 'Skapa säljsida'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
