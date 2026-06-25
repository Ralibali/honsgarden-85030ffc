import React, { useState, useRef, useEffect, useMemo } from 'react';
import { todayLocal } from '@/lib/datetime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  ImagePlus, Trash2, Loader2, ChevronLeft, ChevronRight, X, Camera, Crown,
} from 'lucide-react';

interface Photo {
  id: string;
  hen_id: string;
  photo_url: string;
  file_path: string | null;
  caption: string | null;
  taken_at: string;
  created_at: string;
}

const FREE_LIMIT = 5;
const BUCKET = 'hen-photos';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Extract storage path from a row, preferring file_path; falls back to parsing legacy public URLs. */
function getStoragePath(p: Pick<Photo, 'file_path' | 'photo_url'>): string | null {
  if (p.file_path) return p.file_path;
  if (!p.photo_url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const idx = p.photo_url.indexOf(marker);
  if (idx >= 0) return p.photo_url.substring(idx + marker.length);
  // If photo_url is already a bare path (no http), treat as path
  if (!/^https?:\/\//i.test(p.photo_url)) return p.photo_url;
  return null;
}

export default function HenPhotoTimeline({ henId, henName }: { henId: string; henName: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPremium = !!user?.is_premium;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [takenAt, setTakenAt] = useState(() => todayLocal());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Photo | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['hen-photos', henId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hen_photos')
        .select('id, hen_id, photo_url, file_path, caption, taken_at, created_at')
        .eq('hen_id', henId)
        .order('taken_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Photo[];
    },
    staleTime: 5 * 60_000,
  });

  // Sign URLs for private bucket. Re-signs every ~50 minutes.
  const { data: signedMap = {} } = useQuery({
    queryKey: ['hen-photos-signed', henId, photos.map((p) => p.id).join(',')],
    enabled: photos.length > 0,
    staleTime: 50 * 60_000,
    refetchInterval: 50 * 60_000,
    queryFn: async () => {
      const paths = photos
        .map((p) => ({ id: p.id, path: getStoragePath(p) }))
        .filter((x): x is { id: string; path: string } => !!x.path);
      if (paths.length === 0) return {};
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths.map((p) => p.path), SIGNED_URL_TTL);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((entry, i) => {
        if (entry?.signedUrl) map[paths[i].id] = entry.signedUrl;
      });
      return map;
    },
  });

  // Group by month
  const groups = useMemo(() => {
    const map = new Map<string, Photo[]>();
    for (const p of photos) {
      const d = new Date(p.taken_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [photos]);

  const handleFileSelected = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast({ title: 'Bildformatet stöds inte', description: 'Använd JPEG, PNG eller WebP.', variant: 'destructive' });
      return;
    }
    if (!isPremium && photos.length >= FREE_LIMIT) {
      setLimitDialogOpen(true);
      return;
    }
    setPendingFile(file);
    setCaption('');
    setTakenAt(todayLocal());
    setUploadDialogOpen(true);
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!pendingFile || !user) throw new Error('Saknar fil eller inloggad användare.');
      setUploading(true);
      const compressed = await imageCompression(pendingFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = `${user.id}/${henId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, compressed, {
        contentType: compressed.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('hen_photos').insert({
        hen_id: henId,
        user_id: user.id,
        photo_url: path, // bucket is now private; store path (not public URL)
        file_path: path,
        caption: caption.trim() || null,
        taken_at: takenAt,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hen-photos', henId] });
      toast({ title: 'Bilden är uppladdad 📸' });
      setUploadDialogOpen(false);
      setPendingFile(null);
      setCaption('');
    },
    onError: (e: any) => {
      toast({
        title: 'Uppladdning misslyckades',
        description: e?.message || 'Försök igen.',
        variant: 'destructive',
        action: (
          <Button size="sm" variant="outline" onClick={() => upload.mutate()}>Försök igen</Button>
        ) as any,
      });
    },
    onSettled: () => setUploading(false),
  });

  const remove = useMutation({
    mutationFn: async (photo: Photo) => {
      const path = getStoragePath(photo);
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const { error } = await supabase.from('hen_photos').delete().eq('id', photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hen-photos', henId] });
      toast({ title: 'Bilden är borttagen' });
      setConfirmDelete(null);
    },
    onError: () => toast({ title: 'Kunde inte ta bort bilden', variant: 'destructive' }),
  });

  // Lightbox keyboard
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1)));
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : Math.min(photos.length - 1, i + 1)));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, photos.length]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base text-foreground">Bilder</h3>
          <span className="text-xs text-muted-foreground">{photos.length} st</span>
        </div>
        <Button
          size="sm"
          className="rounded-xl h-8 text-xs gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-3.5 w-3.5" /> Lägg till bild
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelected(f);
            e.target.value = '';
          }}
        />
      </div>

      {!isPremium && photos.length > 0 && photos.length < FREE_LIMIT && (
        <p className="text-[10px] text-muted-foreground text-center">
          {photos.length}/{FREE_LIMIT} gratis bilder. Lås upp obegränsat med Plus.
        </p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFileSelected(f);
        }}
        className={`rounded-xl transition-all ${dragOver ? 'ring-2 ring-primary/40 bg-primary/5' : ''}`}
      >
        {isLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-32 rounded-xl shrink-0" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border/50 rounded-xl p-8 text-center hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm text-foreground font-medium">Lägg till första bilden av {henName}</p>
            <p className="text-xs text-muted-foreground mt-1">Dra och släpp eller klicka. JPEG, PNG eller WebP.</p>
          </button>
        ) : (
          <div className="space-y-5">
            {groups.map(([month, items]) => {
              const d = new Date(month + '-01');
              const label = d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
              return (
                <div key={month}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">{label}</p>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                    {items.map((p) => {
                      const globalIdx = photos.findIndex((x) => x.id === p.id);
                      return (
                        <div key={p.id} className="relative group shrink-0 snap-start">
                          <button
                            type="button"
                            onClick={() => setLightboxIndex(globalIdx)}
                            className="block rounded-xl overflow-hidden border border-border/50 hover:border-primary/40 transition-all"
                          >
                            <img
                              src={signedMap[p.id] || ''}
                              alt={p.caption || `Bild av ${henName}`}
                              loading="lazy"
                              className="h-32 w-32 object-cover bg-muted"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(p)}
                            className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-background/90 backdrop-blur border border-border/40 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            aria-label="Ta bort bild"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                          <p className="text-[10px] text-muted-foreground mt-1 px-0.5">
                            {new Date(p.taken_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(v) => { if (!uploading) setUploadDialogOpen(v); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">Ny bild av {henName}</DialogTitle>
            <DialogDescription className="text-xs">Lägg till valfri text och välj när bilden togs.</DialogDescription>
          </DialogHeader>
          {pendingFile && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-border/50">
                <img src={URL.createObjectURL(pendingFile)} alt="Förhandsvisning" className="w-full max-h-60 object-cover" />
              </div>
              <div>
                <Label className="text-xs">Datum</Label>
                <Input type="date" className="mt-1.5 rounded-xl" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} max={todayLocal()} />
              </div>
              <div>
                <Label className="text-xs">Bildtext (valfritt)</Label>
                <Input className="mt-1.5 rounded-xl" placeholder="T.ex. första gången utomhus" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setUploadDialogOpen(false)} disabled={uploading}>
              Avbryt
            </Button>
            <Button className="rounded-xl" onClick={() => upload.mutate()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ladda upp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free limit dialog */}
      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl text-center">
          <DialogHeader>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-warning/15 flex items-center justify-center mb-2">
              <Crown className="h-6 w-6 text-warning" />
            </div>
            <DialogTitle className="font-serif">Du har nått 5 fria foton</DialogTitle>
            <DialogDescription className="text-xs">
              Lås upp obegränsat antal bilder för {henName} med Plus. Befintliga bilder är alltid kvar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setLimitDialogOpen(false)}>Inte nu</Button>
            <Button className="rounded-xl" onClick={() => { setLimitDialogOpen(false); navigate('/app/premium'); }}>
              Lås upp med Plus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={(v) => { if (!v) setLightboxIndex(null); }}>
        <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden bg-black/95 border-none">
          {lightboxIndex !== null && photos[lightboxIndex] && (
            <div className="relative">
              <img
                src={signedMap[photos[lightboxIndex].id] || ''}
                alt={photos[lightboxIndex].caption || ''}
                className="w-full max-h-[80vh] object-contain bg-black"
              />
              <button
                onClick={() => setLightboxIndex(null)}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 flex items-center justify-center"
                aria-label="Stäng"
              >
                <X className="h-4 w-4" />
              </button>
              {lightboxIndex > 0 && (
                <button
                  onClick={() => setLightboxIndex(lightboxIndex - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 flex items-center justify-center"
                  aria-label="Föregående"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {lightboxIndex < photos.length - 1 && (
                <button
                  onClick={() => setLightboxIndex(lightboxIndex + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 flex items-center justify-center"
                  aria-label="Nästa"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                <p className="text-sm font-medium">
                  {new Date(photos[lightboxIndex].taken_at).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                {photos[lightboxIndex].caption && (
                  <p className="text-xs text-white/80 mt-1">{photos[lightboxIndex].caption}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Ta bort bild?</AlertDialogTitle>
            <AlertDialogDescription>Bilden tas bort permanent och kan inte återställas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Avbryt</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDelete && remove.mutate(confirmDelete)}>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
