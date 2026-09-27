import imageCompression from 'browser-image-compression';
import { supabase } from '@/integrations/supabase/client';

export const DIARY_IMAGE_LIMIT = 5;
export const DIARY_BUCKET = 'diary-photos';
export function validateDiaryFile(file: File): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Välj en bild i JPG-, PNG- eller WebP-format.';
  if (file.size > 20 * 1024 * 1024) return 'Bilden får vara högst 20 MB före komprimering.';
  return null;
}
export async function uploadDiaryImage(entryId: string, file: File): Promise<string> {
  const validation = validateDiaryFile(file);
  if (validation) throw new Error(validation);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Logga in igen för att ladda upp bilder.');
  const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/jpeg' });
  const path = `${session.user.id}/${entryId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(DIARY_BUCKET).upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error('Bilden kunde inte laddas upp. Försök igen.');
  return path;
}
export async function removeDiaryImages(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(DIARY_BUCKET).remove(paths);
  if (error) throw error;
}
export async function signDiaryImages(paths: string[]): Promise<Record<string, string>> {
  const remote = paths.filter(path => !path.startsWith('data:'));
  const result: Record<string, string> = Object.fromEntries(paths.filter(path => path.startsWith('data:')).map(path => [path, path]));
  if (!remote.length) return result;
  const { data, error } = await supabase.storage.from(DIARY_BUCKET).createSignedUrls(remote, 600);
  if (error || data?.some(item => item.error)) throw new Error('Bilderna kunde inte hämtas.');
  for (const item of data ?? []) if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
  return result;
}
