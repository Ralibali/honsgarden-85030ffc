/** Largest number of hens that can be added in one go from the hen dialog. */
export const MAX_HEN_BATCH = 500;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Names for a batch of hens: "Höna 01", "Höna 02", … Numbering continues
 * after the highest existing "<prefix> N" so a second batch never repeats
 * names, and numbers are zero-padded so the list sorts naturally.
 */
export function batchHenNames(prefix: string, quantity: number, existingNames: string[]): string[] {
  const base = prefix.trim();
  const count = Math.min(MAX_HEN_BATCH, Math.max(0, Math.trunc(quantity)));
  if (!base || count === 0) return [];
  const pattern = new RegExp(`^${escapeRegExp(base)} (\\d+)$`);
  const highest = existingNames.reduce((max, name) => {
    const match = pattern.exec(name.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const width = Math.max(2, String(highest + count).length);
  return Array.from({ length: count }, (_, i) => `${base} ${String(highest + i + 1).padStart(width, '0')}`);
}
