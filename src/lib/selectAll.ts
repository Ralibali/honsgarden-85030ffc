import type { PostgrestError } from '@supabase/supabase-js';

export const SELECT_ALL_PAGE_SIZE = 1000;

type Page<Row> = { data: Row[] | null; error: PostgrestError | null };
interface PageableQuery<Row> {
  range(from: number, to: number): PromiseLike<Page<Row>>;
}

/**
 * PostgREST returns at most 1000 rows per request, so totals and statistics
 * over growing tables were silently truncated for larger farms (e.g. per-hen
 * egg logging passes 1000 rows within weeks). This pages through the whole
 * result and keeps the `{ data, error }` shape of a plain query.
 *
 * `build` must return a fresh query ordered by a unique column (append
 * `.order('id')`), otherwise rows can shift between pages.
 */
export async function selectAll<Row>(build: () => PageableQuery<Row>): Promise<Page<Row>> {
  const rows: Row[] = [];
  for (let from = 0; ; from += SELECT_ALL_PAGE_SIZE) {
    const { data, error } = await build().range(from, from + SELECT_ALL_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < SELECT_ALL_PAGE_SIZE) return { data: rows, error: null };
  }
}
