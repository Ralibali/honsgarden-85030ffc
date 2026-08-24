import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, ExternalLink, Calendar } from "lucide-react";

type Listing = {
  id: string; slug: string; title: string; description: string;
  location: string; latitude: number | null; longitude: number | null;
  eggs_per_pack: number; price_per_pack: number; stock_packs: number;
  is_active: boolean; image_url: string | null; contact_phone: string | null;
  expires_at: string | null;
};

export default function MapListingManage() {
  const { token = "" } = useParams<{ token: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("map-listing-manage", { body: { token, action: "get" } });
      if (error) throw error;
      if ((data as any)?.error) { setNotFound(true); return; }
      setListing((data as any).listing);
    } catch {
      setNotFound(true);
    } finally { setLoading(false); }
  }
  useEffect(() => { document.title = "Hantera annons – Hönsgården"; if (token) load(); }, [token]);

  async function call(action: string, patch?: any) {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("map-listing-manage", { body: { token, action, patch } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    } catch (e: any) {
      toast.error(e?.message || "Något gick fel");
      return null;
    } finally { setSaving(false); }
  }

  async function save() {
    if (!listing) return;
    const res = await call("update", {
      title: listing.title, description: listing.description, location: listing.location,
      eggs_per_pack: listing.eggs_per_pack, price_per_pack: listing.price_per_pack,
      stock_packs: listing.stock_packs, contact_phone: listing.contact_phone ?? "",
    });
    if (res?.ok) { toast.success("Sparat"); load(); }
  }

  if (loading) {
    return <div className="min-h-dvh grid place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (notFound || !listing) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background px-4">
        <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center">
          <h1 className="font-serif text-2xl">Länken hittades inte</h1>
          <p className="text-sm text-muted-foreground mt-2">Den här hanteringslänken är ogiltig eller borttagen.</p>
          <Button asChild className="mt-6"><Link to="/karta">Till kartan</Link></Button>
        </div>
      </div>
    );
  }

  const expSoon = listing.expires_at && new Date(listing.expires_at).getTime() - Date.now() < 14 * 86400 * 1000;

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="font-serif text-3xl">Hantera annons</h1>
            <Badge variant={listing.is_active ? "default" : "secondary"}>
              {listing.is_active ? "Aktiv på kartan" : "Pausad"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Spara denna sida som bokmärke. Bara du med länken kan ändra här.
          </p>
        </header>

        <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            {listing.expires_at && (
              <div className={`flex items-center gap-1.5 ${expSoon ? "text-warning" : "text-muted-foreground"}`}>
                <Calendar className="h-4 w-4" />
                Går ut {new Date(listing.expires_at).toLocaleDateString("sv-SE")}
              </div>
            )}
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/s/${listing.slug}`} target="_blank" rel="noopener">
                Visa annons <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Rubrik</Label>
            <Input value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label>Beskrivning</Label>
            <Textarea rows={4} value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} maxLength={1500} />
          </div>
          <div className="space-y-1.5">
            <Label>Plats (ort/postnummer)</Label>
            <Input value={listing.location} onChange={(e) => setListing({ ...listing, location: e.target.value })} maxLength={80} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Antal i pack</Label>
              <Select value={String(listing.eggs_per_pack)} onValueChange={(v) => setListing({ ...listing, eggs_per_pack: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6-pack</SelectItem>
                  <SelectItem value="12">12-pack</SelectItem>
                  <SelectItem value="30">30-pack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pris (kr)</Label>
              <Input type="number" min={0} max={999} value={listing.price_per_pack}
                onChange={(e) => setListing({ ...listing, price_per_pack: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Antal pack</Label>
              <Input type="number" min={0} max={999} value={listing.stock_packs}
                onChange={(e) => setListing({ ...listing, stock_packs: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Telefon (valfri)</Label>
            <Input value={listing.contact_phone ?? ""} onChange={(e) => setListing({ ...listing, contact_phone: e.target.value })} maxLength={30} />
          </div>

          <Button onClick={save} disabled={saving} size="lg" className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Spara ändringar
          </Button>
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-3">
          {listing.is_active ? (
            <Button variant="outline" onClick={async () => { const r = await call("pause"); if (r?.ok) { toast.success("Pausad"); load(); } }}>
              Pausa annonsen
            </Button>
          ) : (
            <Button variant="outline" onClick={async () => { const r = await call("resume"); if (r?.ok) { toast.success("Aktiv igen"); load(); } }}>
              Aktivera igen
            </Button>
          )}
          <Button variant="outline" onClick={async () => { const r = await call("extend"); if (r?.ok) { toast.success("Förlängd 60 dagar"); load(); } }}>
            Förläng 60 dagar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Ta bort</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ta bort annonsen?</AlertDialogTitle>
                <AlertDialogDescription>Detta går inte att ångra.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={async () => { const r = await call("delete"); if (r?.ok) { toast.success("Borttagen"); setNotFound(true); } }}>
                  Ta bort
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
