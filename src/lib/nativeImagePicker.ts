import { Capacitor } from '@capacitor/core';

export type PickSource = 'camera' | 'photos' | 'prompt';

export function isNativePlatform(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/**
 * Öppnar iOS/Android-kamera eller fotobibliotek via Capacitor Camera.
 * Returnerar en File som är kompatibel med befintliga upload-flöden,
 * eller null om vi inte kör natively (så webbläsare kan fortsätta använda <input type="file">).
 */
export async function pickImageNative(source: PickSource = 'prompt'): Promise<File | null> {
  if (!isNativePlatform()) return null;
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

  const src =
    source === 'camera'
      ? CameraSource.Camera
      : source === 'photos'
      ? CameraSource.Photos
      : CameraSource.Prompt;

  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: src,
    saveToGallery: false,
    correctOrientation: true,
  });

  const uri = photo.webPath ?? photo.path;
  if (!uri) return null;
  const res = await fetch(uri);
  const blob = await res.blob();
  const ext = (photo.format || blob.type.split('/').pop() || 'jpg').replace('jpeg', 'jpg');
  const type = blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
  return new File([blob], `photo-${Date.now()}.${ext}`, { type });
}

/**
 * Native multi-select (iOS 14+ / Android). Faller tillbaka till single vid fel.
 */
export async function pickImagesNative(limit = 8): Promise<File[] | null> {
  if (!isNativePlatform()) return null;
  try {
    const { Camera } = await import('@capacitor/camera');
    const result = await Camera.pickImages({ quality: 85, limit });
    const files: File[] = [];
    for (const p of result.photos) {
      const uri = p.webPath ?? p.path;
      if (!uri) continue;
      const res = await fetch(uri);
      const blob = await res.blob();
      const ext = (p.format || blob.type.split('/').pop() || 'jpg').replace('jpeg', 'jpg');
      const type = blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
      files.push(new File([blob], `photo-${Date.now()}-${files.length}.${ext}`, { type }));
    }
    return files;
  } catch {
    const single = await pickImageNative('photos');
    return single ? [single] : [];
  }
}
