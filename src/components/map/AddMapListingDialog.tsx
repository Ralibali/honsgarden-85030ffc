import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Image as ImageIcon, CheckCircle2 } from "lucide-react";

async function fileToCompressedBase64(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("Kunde inte läsa bilden");
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas saknas");
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function AddMapListingDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ email: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    owner_email: "",
    contact_phone: "",
    eggs_per_pack: "6",
    price_per_pack: "35",
    stock_packs: "5",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let image_b64: string | null = null;
      if (imageFile) {
        if (imageFile.size > 8_000_000) throw new Error("Bilden är för stor (max 8 MB)");
        image_b64 = await fileToCompressedBase64(imageFile);
      }
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        owner_email: form.owner_email,
        contact_phone: form.contact_phone || null,
        eggs_per_pack: Number(form.eggs_per_pack),
        price_per_pack: Number(form.price_per_pack),
        stock_packs: Number(form.stock_packs),
        image_b64,
      };
      const { data, error } = await supabase.functions.invoke("map-listing-submit", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDone({ email: form.owner_email });
    } catch (err: any) {
      toast.error(err?.message || "Något gick fel — försök igen");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setDone(null);
    setForm({ title: "", description: "", location: "", owner_email: "", contact_phone: "",
      eggs_per_pack: "6", price_per_pack: "35", stock_packs: "5" });
    setImageFile(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        {done ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 grid place-items-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="font-serif text-2xl">Kolla din mejl!</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Vi har skickat en bekräftelselänk till <strong className="text-foreground">{done.email}</strong>.
              Klicka på länken så publiceras din annons direkt på kartan.
            </p>
            <p className="text-xs text-muted-foreground">
              I samma mejl finns en privat hanteringslänk — spara den så kan du redigera, pausa eller ta bort annonsen när du vill.
            </p>
            <Button onClick={() => setOpen(false)} className="mt-2">Stäng</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Lägg upp din äggannons</DialogTitle>
              <DialogDescription>
                Gratis. Inget konto krävs. Annonsen syns på kartan i 60 dagar — du kan förlänga när som helst.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Rubrik *</Label>
                <Input id="title" value={form.title} onChange={set("title")} required maxLength={80}
                  placeholder="t.ex. Färska ägg från frigående höns" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Beskrivning *</Label>
                <Textarea id="description" value={form.description} onChange={set("description")} required
                  maxLength={1500} rows={4}
                  placeholder="Berätta om dina höns, foder, hämtning, öppettider…" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Plats *
                </Label>
                <Input id="location" value={form.location} onChange={set("location")} required maxLength={80}
                  placeholder="Ort eller postnummer, t.ex. Sigtuna eller 193 41" />
                <p className="text-xs text-muted-foreground">Vi placerar en pin baserat på platsen — exakt adress visas aldrig.</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Antal i pack</Label>
                  <Select value={form.eggs_per_pack} onValueChange={(v) => setForm((s) => ({ ...s, eggs_per_pack: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6-pack</SelectItem>
                      <SelectItem value="12">12-pack</SelectItem>
                      <SelectItem value="30">30-pack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="price">Pris (kr)</Label>
                  <Input id="price" type="number" min={0} max={999} value={form.price_per_pack}
                    onChange={set("price_per_pack")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="stock">Antal pack</Label>
                  <Input id="stock" type="number" min={0} max={999} value={form.stock_packs}
                    onChange={set("stock_packs")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="image" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> Bild (valfri)
                </Label>
                <Input id="image" type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-post *</Label>
                  <Input id="email" type="email" value={form.owner_email} onChange={set("owner_email")} required
                    placeholder="din@epost.se" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefon (valfritt)</Label>
                  <Input id="phone" type="tel" value={form.contact_phone} onChange={set("contact_phone")}
                    placeholder="070-123 45 67" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                E-posten visas inte publikt. Vi mejlar bara dig en bekräftelse- och hanteringslänk.
              </p>

              <Button type="submit" disabled={submitting} size="lg" className="w-full">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting ? "Skickar…" : "Skicka in annons →"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Genom att skicka in godkänner du att informationen visas publikt på kartan.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
