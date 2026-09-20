// Narrow SDK surface keeps the ownership and pagination logic testable without credentials.
export interface DiaryCleanupClient {
  from(table: string): { select(columns: string): { eq(column: string, value: string): { order(column: string): { range(from: number, to: number): PromiseLike<{ data: { image_paths?: string[] }[] | null; error: unknown }> } } } };
  storage: { from(bucket: string): {
    list(folder: string, options: { limit: number; offset: number; sortBy: { column: string; order: string } }): PromiseLike<{ data: { id?: string | null; name: string }[] | null; error: unknown }>;
    remove(paths: string[]): PromiseLike<{ error: unknown }>;
  } };
}

export async function cleanupDiaryPhotos(client: DiaryCleanupClient, userId: string): Promise<void> {
  const paths = new Set<string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('health_logs').select('image_paths')
      .eq('user_id', userId).order('id').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data ?? []) for (const path of row.image_paths ?? []) paths.add(path);
    if (!data || data.length < 500) break;
  }
  const folders = [userId];
  while (folders.length) {
    const folder = folders.pop()!;
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.storage.from('diary-photos').list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      for (const item of data ?? []) {
        const path = `${folder}/${item.name}`;
        if (item.id) paths.add(path); else folders.push(path);
      }
      if (!data || data.length < 1000) break;
    }
  }
  const files = [...paths];
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await client.storage.from('diary-photos').remove(files.slice(i, i + 100));
    if (error) throw error;
  }
}
