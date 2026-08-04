export type FeedRow = Record<string, string>;

/** CSV/TSV parser with quoted delimiters and line breaks. */
export function parseDelimited(text: string, delimiter: string, quote = '"'): FeedRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === quote) {
        if (text[i + 1] === quote) { field += quote; i += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === quote) quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }

  const headers = (rows.shift() ?? []).map((value) => value.replace(/^\uFEFF/, '').trim());
  return rows
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function decodeFeedText(value: string): string {
  return String(value ?? '')
    .replace(/&ouml;/gi, 'ö').replace(/&aring;/gi, 'å').replace(/&auml;/gi, 'ä')
    .replace(/&quot;|&rdquo;|&ldquo;/gi, '"').replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function normalizeFeedText(value: string): string {
  return decodeFeedText(value).toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slugifyFeedText(value: string): string {
  return normalizeFeedText(value).replace(/\s+/g, '-');
}

export function parseFeedMoney(value: string): number {
  const parsed = Number.parseFloat(String(value ?? '').replace(/\s/g, '').replace(/[^\d,.-]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatSek(value: number): string {
  return `${Math.round(value).toLocaleString('sv-SE')} kr`;
}
