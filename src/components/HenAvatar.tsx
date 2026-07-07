import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { isNativePlatform, pickImageNative } from '@/lib/nativeImagePicker';

interface HenAvatarProps {
  henId: string;
  henType: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  showProfileActions?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'w-9 h-9 text-lg',
  md: 'w-11 h-11 text-2xl',
  lg: 'w-20 h-20 text-4xl',
};

const ICON_SIZES = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

const supportsWebpEncode = (() => {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
})();

interface CompressedImage {
  blob: Blob;
  extension: 'webp' | 'jpg';
  contentType: 'image/webp' | 'image/jpeg';
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function loadHTMLImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Kunde inte läsa bilden. Prova att välja en JPG/PNG-bild eller ta en ny bild med kameran.'));
    };
    img.src = objectUrl;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, mime: 'image/webp' | 'image/jpeg', quality: number): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else {
          try {
            resolve(dataUrlToBlob(canvas.toDataURL(mime, quality)));
          } catch {
            reject(new Error('Bilden kunde inte komprimeras på den här enheten.'));
          }
        }
      }, mime, quality);
      return;
    }

    try {
      resolve(dataUrlToBlob(canvas.toDataURL(mime, quality)));
    } catch {
      reject(new Error('Bilden kunde inte komprimeras på den här enheten.'));
    }
  });
}

async function compressImage(file: File): Promise<CompressedImage> {
  const TARGET = Math.min(512, Math.round(128 * Math.min(window.devicePixelRatio || 1, 4)));

  let bitmap: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;

  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
      width = (bitmap as ImageBitmap).width;
      height = (bitmap as ImageBitmap).height;
    } catch {
      bitmap = await loadHTMLImage(file);
      width = (bitmap as HTMLImageElement).naturalWidth;
      height = (bitmap as HTMLImageElement).naturalHeight;
    }
  } else {
    bitmap = await loadHTMLImage(file);
    width = (bitmap as HTMLImageElement).naturalWidth;
    height = (bitmap as HTMLImageElement).naturalHeight;
  }

  if (!width || !height) throw new Error('Bilden verkar sakna mått. Prova en annan bild.');

  const min = Math.min(width, height);
  const sx = (width - min) / 2;
  const sy = (height - min) / 2;

  let currentSize = min;
  let source: CanvasImageSource = bitmap as CanvasImageSource;
  let srcX = sx;
  let srcY = sy;

  while (currentSize > TARGET * 2) {
    const next = Math.max(TARGET, Math.floor(currentSize / 2));
    const tmp = document.createElement('canvas');
    tmp.width = next;
    tmp.height = next;
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) break;
    tmpCtx.imageSmoothingEnabled = true;
    tmpCtx.imageSmoothingQuality = 'medium';
    tmpCtx.drawImage(source, srcX, srcY, currentSize, currentSize, 0, 0, next, next);
    source = tmp;
    srcX = 0;
    srcY = 0;
    currentSize = next;
  }

  const canvas = document.createElement('canvas');
  canvas.width = TARGET;
  canvas.height = TARGET;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Din webbläsare stödjer inte bildbehandling.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, srcX, srcY, currentSize, currentSize, 0, 0, TARGET, TARGET);

  if (typeof (bitmap as ImageBitmap).close === 'function') (bitmap as ImageBitmap).close();

  const contentType = supportsWebpEncode ? 'image/webp' : 'image/jpeg';
  const extension = supportsWebpEncode ? 'webp' : 'jpg';
  const quality = supportsWebpEncode ? 0.82 : 0.86;
  const blob = await canvasToBlob(canvas, contentType, quality);

  return { blob, extension, contentType };
}

export default function HenAvatar({
  henId,
  henType,
  imageUrl,
  size = 'md',
  editable = false,
  showProfileActions = false,
  className = '',
}: HenAvatarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pendingImageUrlRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(imageUrl || '');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!pendingImageUrlRef.current) {
      setDisplayUrl(imageUrl || '');
      return;
    }

    if (!imageUrl) return;

    setDisplayUrl(imageUrl);
    pendingImageUrlRef.current = null;
  }, [imageUrl]);

  const emoji = henType === 'rooster' ? '🐓' : '🐔';
  const sizeClass = SIZES[size];
  const iconClass = ICON_SIZES[size];

  const openImagePicker = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    if (!uploading) setPickerOpen(true);
  };

  const openGallery = async () => {
    setPickerOpen(false);
    if (isNativePlatform()) {
      try {
        const file = await pickImageNative('photos');
        if (file) await processFile(file);
      } catch (err: any) {
        if (err?.message && !/cancel/i.test(err.message)) {
          toast({ title: 'Kunde inte öppna bildbibliotek', description: err.message, variant: 'destructive' });
        }
      }
      return;
    }
    window.setTimeout(() => galleryInputRef.current?.click(), 0);
  };

  const openCamera = async () => {
    setPickerOpen(false);
    if (isNativePlatform()) {
      try {
        const file = await pickImageNative('camera');
        if (file) await processFile(file);
      } catch (err: any) {
        if (err?.message && !/cancel/i.test(err.message)) {
          toast({ title: 'Kunde inte öppna kamera', description: err.message, variant: 'destructive' });
        }
      }
      return;
    }
    window.setTimeout(() => cameraInputRef.current?.click(), 0);
  };

  const processFile = async (file: File) => {
    if (!user) return;

    if (!file.type.startsWith('image/') && !/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name)) {
      toast({ title: 'Endast bilder', description: 'Välj en bildfil, till exempel JPG, PNG eller WebP.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    setProgress(5);
    setProgressLabel('Förbereder bild…');
    const previewUrl = URL.createObjectURL(file);
    setDisplayUrl(previewUrl);

    try {
      setProgressLabel('Komprimerar…');
      setProgress(25);
      const compressed = await compressImage(file);
      setProgress(55);
      setProgressLabel('Laddar upp…');

      const oldWebpPath = `${user.id}/${henId}.webp`;
      const oldJpgPath = `${user.id}/${henId}.jpg`;
      const path = `${user.id}/${henId}.${compressed.extension}`;

      await supabase.storage.from('hen-images').remove([oldWebpPath, oldJpgPath]);

      const { error: uploadError } = await supabase.storage
        .from('hen-images')
        .upload(path, compressed.blob, {
          contentType: compressed.contentType,
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;
      setProgress(80);
      setProgressLabel('Sparar…');

      const { data: signedData, error: signedErr } = await supabase.storage
        .from('hen-images')
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signedErr) throw signedErr;

      const publicUrl = `${signedData.signedUrl}&v=${Date.now()}`;
      pendingImageUrlRef.current = publicUrl;
      const updatedHen = await api.updateHen(henId, { image_url: publicUrl } as any);
      const nextImageUrl = updatedHen.image_url || publicUrl;

      setDisplayUrl(nextImageUrl);
      queryClient.setQueryData(['hen-profile', henId], (old: any) => old ? { ...old, ...updatedHen, image_url: nextImageUrl } : updatedHen);
      queryClient.setQueryData(['hens'], (old: any) => Array.isArray(old) ? old.map((hen) => hen.id === henId ? { ...hen, ...updatedHen, image_url: nextImageUrl } : hen) : old);
      queryClient.invalidateQueries({ queryKey: ['hen-profile', henId] });
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      setProgress(100);
      setProgressLabel('Klar!');
      toast({ title: 'Bild uppladdad! 📷' });
    } catch (err: any) {
      pendingImageUrlRef.current = null;
      setDisplayUrl(imageUrl || '');
      toast({
        title: 'Uppladdning misslyckades',
        description: err?.message || 'Bilden kunde inte laddas upp. Prova en JPG/PNG-bild eller ta en ny bild med kameran.',
        variant: 'destructive',
      });
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploading(false);
      setTimeout(() => {
        setProgress(0);
        setProgressLabel('');
      }, 600);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerOpen(false);
    if (!user) return;
    setUploading(true);
    try {
      const webpPath = `${user.id}/${henId}.webp`;
      const jpgPath = `${user.id}/${henId}.jpg`;
      await supabase.storage.from('hen-images').remove([webpPath, jpgPath]);
      await api.updateHen(henId, { image_url: null } as any);
      pendingImageUrlRef.current = null;
      setDisplayUrl('');
      queryClient.invalidateQueries({ queryKey: ['hens'] });
      queryClient.invalidateQueries({ queryKey: ['hen-profile', henId] });
      toast({ title: 'Bild borttagen' });
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const bgClass = henType === 'rooster' ? 'bg-warning/10' : 'bg-accent/10';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`${sizeClass} rounded-xl overflow-hidden flex items-center justify-center ${bgClass} ${editable && showProfileActions ? 'cursor-pointer' : ''}`}
        onClick={editable && showProfileActions ? () => openImagePicker() : undefined}
        onKeyDown={editable && showProfileActions ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') openImagePicker(e);
        } : undefined}
        role={editable && showProfileActions ? 'button' : undefined}
        tabIndex={editable && showProfileActions ? 0 : undefined}
        aria-label={editable && showProfileActions ? (displayUrl ? 'Byt bild' : 'Ladda upp bild') : undefined}
      >
        {displayUrl ? (
          <img
            key={displayUrl}
            src={displayUrl}
            alt="Höna"
            className="w-full h-full object-cover"
            loading="lazy"
            onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'block'; }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span>{emoji}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 backdrop-blur-sm" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={progressLabel || 'Laddar upp bild'}>
            <Loader2 className={`${iconClass} animate-spin text-primary`} />
            {size === 'lg' && <span className="text-[10px] font-medium text-foreground/80">{progress}%</span>}
          </div>
        )}
      </div>

      {uploading && size === 'lg' && (
        <div className="mt-2 w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div>
          {progressLabel && <p className="mt-1 text-center text-xs text-muted-foreground">{progressLabel}</p>}
        </div>
      )}

      {editable && (
        <>
          <input ref={galleryInputRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={handleFileChange} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileChange} />

          {!showProfileActions && (
            <button type="button" onClick={openImagePicker} disabled={uploading} className={`absolute -bottom-1 -right-1 ${size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'} rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50`} aria-label={displayUrl ? 'Byt bild' : 'Ladda upp bild'}>
              {uploading ? <Loader2 className={`${iconClass} animate-spin`} /> : <Camera className={iconClass} />}
            </button>
          )}

          {displayUrl && !uploading && !showProfileActions && (
            <button type="button" onClick={handleRemove} className={`absolute -top-1 -right-1 ${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} rounded-full bg-destructive text-destructive-foreground shadow-md flex items-center justify-center hover:bg-destructive/90 transition-colors`} aria-label="Ta bort bild">
              <X className={iconClass} />
            </button>
          )}

          {showProfileActions && (
            <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
              <button type="button" onClick={openImagePicker} disabled={uploading} className="inline-flex h-11 sm:h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 sm:px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {displayUrl ? 'Byt bild' : 'Lägg till bild'}
              </button>
              {displayUrl && (
                <button type="button" onClick={handleRemove} disabled={uploading} className="inline-flex h-11 sm:h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 sm:px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                  <X className="h-4 w-4" />
                  Ta bort
                </button>
              )}
            </div>
          )}

          {pickerOpen && (
            <div className="fixed inset-0 z-[80] bg-foreground/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setPickerOpen(false)}>
              <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-4 sm:p-5 animate-fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Välj bildkälla">
                <div className="text-center mb-4">
                  <p className="font-serif text-lg text-foreground">Välj bild på hönan</p>
                  <p className="text-xs text-muted-foreground mt-1">Ta en ny bild eller välj en du redan har sparad.</p>
                </div>
                <div className="space-y-2">
                  <button type="button" onClick={openCamera} className="w-full min-h-12 rounded-2xl bg-primary text-primary-foreground px-4 py-3 flex items-center justify-center gap-2 font-medium active:scale-[0.98] transition-transform">
                    <Camera className="h-4 w-4" />
                    Ta bild
                  </button>
                  <button type="button" onClick={openGallery} className="w-full min-h-12 rounded-2xl border border-border bg-background px-4 py-3 flex items-center justify-center gap-2 font-medium text-foreground hover:bg-muted active:scale-[0.98] transition-colors">
                    <ImagePlus className="h-4 w-4" />
                    <span className="sm:hidden">Välj från galleri</span>
                    <span className="hidden sm:inline">Välj bild från datorn</span>
                  </button>
                  {displayUrl && (
                    <button type="button" onClick={handleRemove} className="w-full min-h-12 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 flex items-center justify-center gap-2 font-medium text-destructive hover:bg-destructive/10 active:scale-[0.98] transition-colors">
                      <X className="h-4 w-4" />
                      Ta bort bild
                    </button>
                  )}
                  <button type="button" onClick={() => setPickerOpen(false)} className="w-full min-h-11 rounded-2xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                    Avbryt
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
