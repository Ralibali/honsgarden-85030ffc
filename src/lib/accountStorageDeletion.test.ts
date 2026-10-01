import { describe, expect, it } from 'vitest';
import { deleteAccountPhotos } from '../../supabase/functions/_shared/account-storage-deletion';

describe('account storage erasure', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  it('enumerates every page and nested directory before removing, and never targets another user', async () => {
    const files = Array.from({ length: 201 }, (_, i) => ({ name: `file-${String(i).padStart(3, '0')}`, id: `id-${i}` }));
    files.push({ name: 'nested', id: null as unknown as string });
    const actions: string[] = [], deleted: string[] = [];
    const bucket = {
      list: async (prefix: string, options: { offset: number; limit: number }) => {
        actions.push('list');
        const entries = prefix === userId ? files : [{ name: 'inside.jpg', id: 'nested-file' }];
        return { data: entries.slice(options.offset, options.offset + options.limit), error: null };
      },
      remove: async (paths: string[]) => { actions.push('remove'); deleted.push(...paths); return { error: null }; },
    };
    await deleteAccountPhotos(bucket, userId);
    expect(deleted).toHaveLength(202);
    expect(deleted).toContain(`${userId}/nested/inside.jpg`);
    expect(deleted.every(path => path.startsWith(`${userId}/`))).toBe(true);
    expect(actions.slice(actions.indexOf('remove'))).not.toContain('list');
  });
  it('stops without deleting on an enumeration error or invalid path', async () => {
    let removed = false;
    const bucket = { list: async () => ({ data: [{ name: '../other-user/file', id: 'x' }], error: null }), remove: async () => { removed = true; return { error: null }; } };
    await expect(deleteAccountPhotos(bucket, userId)).rejects.toThrow('Invalid storage path');
    expect(removed).toBe(false);
    await expect(deleteAccountPhotos(bucket, '../other-user')).rejects.toThrow('Invalid user ID');
  });
  it('does not claim success when file deletion fails', async () => {
    const bucket = { list: async () => ({ data: [{ name: 'file', id: 'x' }], error: null }), remove: async () => ({ error: new Error('storage unavailable') }) };
    await expect(deleteAccountPhotos(bucket, userId)).rejects.toThrow('storage unavailable');
  });
});
