// Rena hjälpare för admin-affiliate-analytics så vi kan enhetstesta
// hur `days`-parametern parsas oavsett om den kommer via query eller body.

export function resolveDays(input: {
  queryParam?: string | null;
  body?: unknown;
}): { days: number; sinceMs: number } {
  const q = input.queryParam;
  const b = (input.body ?? null) as Record<string, unknown> | null;
  let raw: unknown = q;
  if ((raw === null || raw === "" || raw === undefined) && b && "days" in b) {
    raw = (b as Record<string, unknown>).days;
  }
  const num = Number(raw);
  const days = Number.isFinite(num) && num > 0 ? Math.min(365, Math.max(1, Math.floor(num))) : 30;
  return { days, sinceMs: days * 24 * 60 * 60 * 1000 };
}
