// CTR is the share of distinct measured placements that received a click.
// Repeated clicks are retained in the raw click count.
type Event = {
  session_id: string | null; created_at: string; product_id: string | null;
  advertiser: string | null; slug: string | null; section_title: string | null;
  path: string | null; source: string | null;
};

export function placementRates<T extends Event>(impressions: T[], clicks: T[], group: (row: T) => string | null) {
  const exposures = new Map<string, { group: string; first: string; clicked: boolean }>();
  const identity = (row: T) => JSON.stringify([
    row.session_id, row.path, row.slug, row.section_title, row.product_id, row.advertiser, row.source,
  ]);
  for (const row of impressions) {
    const key = group(row);
    if (!key || !row.session_id || row.session_id === 'no-storage') continue;
    const id = identity(row);
    const existing = exposures.get(id);
    if (!existing || row.created_at < existing.first) exposures.set(id, { group: key, first: row.created_at, clicked: false });
  }
  for (const row of clicks) {
    const exposure = exposures.get(identity(row));
    if (exposure && row.created_at >= exposure.first) exposure.clicked = true;
  }
  const groups = new Map<string, { seen: number; clicked: number }>();
  for (const exposure of exposures.values()) {
    const count = groups.get(exposure.group) ?? { seen: 0, clicked: 0 };
    count.seen++;
    if (exposure.clicked) count.clicked++;
    groups.set(exposure.group, count);
  }
  return new Map(Array.from(groups, ([key, count]) => [key, count.clicked / count.seen]));
}

export function formatCtr(rate: number | null | undefined) {
  return rate == null ? '–' : (rate * 100).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' %';
}
