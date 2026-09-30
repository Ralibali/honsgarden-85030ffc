// PostgREST returns at most 1000 rows per request. Large farms (per-hen egg
// logging, many hens) pass that quickly, which silently truncated reports.
// Pages through the whole result and keeps the `{ data, error }` shape.
// `build` must return a fresh query ordered by a unique column (`.order("id")`).
type Page<Row> = { data: Row[] | null; error: { message: string } | null };

export async function selectAll<Row>(
  build: () => { range(from: number, to: number): PromiseLike<Page<Row>> },
  pageSize = 1000,
): Promise<Page<Row>> {
  const rows: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
}
