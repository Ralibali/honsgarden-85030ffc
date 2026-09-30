import { describe, expect, it, vi } from 'vitest';
import { selectAll, SELECT_ALL_PAGE_SIZE } from '@/lib/selectAll';
import { batchHenNames, MAX_HEN_BATCH } from '@/lib/henBatch';

function pagedQuery(total: number) {
  const range = vi.fn(async (from: number, to: number) => ({
    data: Array.from({ length: Math.max(0, Math.min(total, to + 1) - from) }, (_, i) => ({ id: from + i })),
    error: null,
  }));
  return { build: () => ({ range }), range };
}

describe('selectAll', () => {
  it('reads every page beyond the 1000-row API cap', async () => {
    const { build, range } = pagedQuery(2 * SELECT_ALL_PAGE_SIZE + 5);
    const { data, error } = await selectAll(build);
    expect(error).toBeNull();
    expect(data).toHaveLength(2005);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('stops after a short first page', async () => {
    const { build, range } = pagedQuery(3);
    expect((await selectAll(build)).data).toHaveLength(3);
    expect(range).toHaveBeenCalledTimes(1);
  });

  it('asks for one more page when the total is an exact multiple of the page size', async () => {
    const { build, range } = pagedQuery(SELECT_ALL_PAGE_SIZE);
    expect((await selectAll(build)).data).toHaveLength(1000);
    expect(range).toHaveBeenCalledTimes(2);
  });

  it('returns the error instead of partial data', async () => {
    let call = 0;
    const build = () => ({
      range: async () => (call++ === 0
        ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }
        : { data: null, error: { message: 'timeout', details: '', hint: '', code: '57014', name: 'PostgrestError' } }),
    });
    const result = await selectAll(build);
    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('timeout');
  });
});

describe('batchHenNames', () => {
  it('numbers a new batch with zero padding', () => {
    expect(batchHenNames('Höna', 3, [])).toEqual(['Höna 01', 'Höna 02', 'Höna 03']);
    expect(batchHenNames('Höna', 120, []).at(-1)).toBe('Höna 120');
    expect(batchHenNames('Höna', 120, [])[0]).toBe('Höna 001');
  });

  it('continues after existing numbered hens instead of repeating names', () => {
    expect(batchHenNames('Höna', 2, ['Höna 07', 'Greta', 'Höna 3', 'Hönan 99'])).toEqual(['Höna 08', 'Höna 09']);
  });

  it('treats special characters in the prefix literally', () => {
    expect(batchHenNames('Box (A)', 1, ['Box (A) 4', 'Box AA 9'])).toEqual(['Box (A) 05']);
  });

  it('caps the batch size and ignores empty prefixes', () => {
    expect(batchHenNames('Höna', 10_000, [])).toHaveLength(MAX_HEN_BATCH);
    expect(batchHenNames('  ', 5, [])).toEqual([]);
    expect(batchHenNames('Höna', 0, [])).toEqual([]);
  });
});
