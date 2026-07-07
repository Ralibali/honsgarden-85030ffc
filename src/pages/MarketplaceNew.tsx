import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, Loader2 } from 'lucide-react';
import LandingNavbar from '@/components/LandingNavbar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { CATEGORIES, REGIONS, hasContactInfo, type MarketplaceCategory } from '@/lib/marketplace';

const MAX_IMAGES = 8;
const MAX_SIZE = 5 * 1024 * 1024;

export default function MarketplaceNew() {
  usePageTitle('Lägg in annons');
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [form, setForm] = useState({
    title: '', description: '', category: '' as MarketplaceCategory | '',
    price: '', is_giveaway: false, condition: 'begagnat',
    region: '', city: '', postal_code: '',
  });

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login?redirect=/marknad/ny" replace />;

  const uploadFiles = async (files: File[]) => {
    if (!files.length || !user) return;
    if (imageUrls.length + files.length > MAX_IMAGES) {
      toast({ title: 'För många bilder', description: `Max ${MAX_IMAGES} bilder per annons`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        if (file.size > MAX_SIZE) {
          toast({ title: 'För stor bild', description: `${file.name} är större än 5 MB`, variant: 'destructive' });
          continue;
        }
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/marketplace/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('community-images').upload(path, file, { upsert: false });
        if (error) { toast({ title: 'Uppladdning misslyckades', description: error.message, variant: 'destructive' }); continue; }
        const { data: pub } = supabase.storage.from('community-images').getPublicUrl(path);
        uploaded.push(pub.publicUrl);
      }
      setImageUrls((urls) => [...urls, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await uploadFiles(files);
    e.target.value = '';
  };

  const handleNativePick = async () => {
    const { isNativePlatform, pickImagesNative } = await import('@/lib/nativeImagePicker');
    if (!isNativePlatform()) return false;
    try {
      const remaining = MAX_IMAGES - imageUrls.length;
      const files = await pickImagesNative(Math.max(1, remaining));
      if (files && files.length) await uploadFiles(files);
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) {
        toast({ title: 'Kunde inte välja bilder', description: err.message, variant: 'destructive' });
      }
    }
    return true;
  };

  const removeImage = (url: string) => setImageUrls((urls) => urls.filter((u) => u !== url));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.title.length < 3) return toast({ title: 'Titel för kort', variant: 'destructive' });
    if (form.description.length < 10) return toast({ title: 'Beskrivning för kort', description: 'Minst 10 tecken', variant: 'destructive' });
    if (!form.category) return toast({ title: 'Välj kategori', variant: 'destructive' });
    if (hasContactInfo(form.description)) {
      return toast({
        title: 'Ta bort kontaktuppgifter',
        description: 'Köpare kontaktar dig via Hönsgården-meddelanden. Ta bort telefon/e-post från beskrivningen.',
        variant: 'destructive',
      });
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .insert({
          user_id: user.id,
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          price: form.is_giveaway ? null : (form.price ? Number(form.price) : null),
          is_giveaway: form.is_giveaway,
          condition: form.condition || null,
          region: form.region || null,
          city: form.city.trim() || null,
          postal_code: form.postal_code.trim() || null,
          image_urls: imageUrls,
          slug: '', // genereras av trigger
        })
        .select('slug')
        .single();
      if (error) throw error;
      toast({ title: 'Annons publicerad!', description: 'Din annons syns nu på Marknad.' });
      navigate(`/marknad/${data.slug}`);
    } catch (err: any) {
      toast({ title: 'Kunde inte publicera', description: err.message ?? String(err), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main className="pt-24 pb-16 container max-w-2xl mx-auto px-5">
        <Button variant="ghost" size="sm" onClick={() => navigate('/marknad')} className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" /> Tillbaka till Marknad
        </Button>
        <h1 className="font-serif text-3xl text-foreground mb-6">Lägg in annons</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bilder */}
          <Card><CardContent className="p-5 space-y-3">
            <Label>Bilder (max 8, 5 MB/styck)</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imageUrls.map((url) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {imageUrls.length < MAX_IMAGES && (
                <label
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition"
                  onClick={async (e) => {
                    const used = await handleNativePick();
                    if (used) e.preventDefault();
                  }}
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-xs">Lägg till</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-5 space-y-4">
            <div>
              <Label htmlFor="title">Rubrik *</Label>
              <Input id="title" value={form.title} maxLength={120} required
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="T.ex. 6 unghöns Bielefelder, 14 veckor" />
            </div>
            <div>
              <Label htmlFor="cat">Kategori *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as MarketplaceCategory })}>
                <SelectTrigger><SelectValue placeholder="Välj kategori" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="desc">Beskrivning *</Label>
              <Textarea id="desc" value={form.description} required minLength={10} maxLength={5000} rows={6}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Berätta om varan: ålder, ras, skick, varför du säljer…" />
              <p className="text-xs text-muted-foreground mt-1">
                Skriv inte telefon eller e-post – köpare når dig via Hönsgården-meddelanden.
              </p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="giveaway">Skänkes</Label>
                <p className="text-xs text-muted-foreground">Inget pris, lämnas gratis</p>
              </div>
              <Switch id="giveaway" checked={form.is_giveaway} onCheckedChange={(v) => setForm({ ...form, is_giveaway: v })} />
            </div>
            {!form.is_giveaway && (
              <div>
                <Label htmlFor="price">Pris (kr)</Label>
                <Input id="price" type="number" min="0" step="1" value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="350" />
              </div>
            )}
            <div>
              <Label>Skick</Label>
              <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nytt">Nytt</SelectItem>
                  <SelectItem value="begagnat">Begagnat</SelectItem>
                  <SelectItem value="skick-ej-angivet">Skick ej angivet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent></Card>

          <Card><CardContent className="p-5 space-y-4">
            <div>
              <Label>Region</Label>
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger><SelectValue placeholder="Välj region" /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">Ort</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="T.ex. Lund" />
              </div>
              <div>
                <Label htmlFor="zip">Postnummer</Label>
                <Input id="zip" value={form.postal_code} maxLength={10}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="22100" />
              </div>
            </div>
          </CardContent></Card>

          <Alert>
            <AlertDescription className="text-xs">
              Genom att publicera godkänner du att din annons visas publikt på Hönsgården (även för icke-inloggade) och kan synas i sökmotorer. Du kan ta bort annonsen när som helst.
            </AlertDescription>
          </Alert>

          <Button type="submit" size="lg" disabled={submitting || uploading} className="w-full rounded-2xl">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publicerar…</> : 'Publicera annons'}
          </Button>
        </form>
      </main>
    </div>
  );
}
