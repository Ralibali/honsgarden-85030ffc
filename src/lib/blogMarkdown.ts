/**
 * Delad markdown-renderare för bloggen.
 *
 * VIKTIGT: Håll denna fil i sync med `src/lib/blogMarkdown.mjs` (samma logik).
 *  - .ts  används av React-appen (GuideArticle.tsx)
 *  - .mjs används av scripts/prerender-blog-posts.mjs (Node vid build)
 *
 * Stödjer: rubriker med ankarn-id, GFM-tabeller (med alignment),
 * grupperade punkt-/numrerade listor, TOC-kort (listor med enbart #ankare),
 * blockquotes, hr, bilder, länkar (affiliate-knappar), fet/kursiv/kod
 * samt råa HTML-block (t.ex. <a id="...">) som släpps igenom.
 */

const escapeHtml = (value = ''): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export const slugifyHeading = (text = ''): string => String(text)
  .toLowerCase()
  .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

export const isHtmlContent = (content = ''): boolean => {
  const trimmed = String(content).trim();
  return trimmed.startsWith('<') || trimmed.startsWith('<!');
};

/** Ta bort markdown-markörer ur en text (för rubrik-id:n). */
const stripInlineMarks = (text = ''): string => String(text).replace(/[#*_`]/g, '').trim();

/** Inline-formatering: escape först, sedan markdown → HTML. */
function inline(text: string): string {
  let s = escapeHtml(String(text));
  // Bilder (före länkar)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
  // Länkar
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, t, url) => {
    const u = String(url).trim();
    const isAffiliate = /adtraction|awin|tradedoubler|partner/i.test(u) || t.includes('→') || /köp/i.test(t);
    if (isAffiliate) {
      return `<a href="${u}" target="_blank" rel="noopener sponsored" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity no-underline">${t}</a>`;
    }
    const internal = u.startsWith('/') || u.startsWith('#');
    return `<a href="${u}"${internal ? '' : ' target="_blank" rel="noopener"'}>${t}</a>`;
  });
  // Fet, kursiv, kod
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

/** Är raden en tabell-separator? t.ex. |---|---:| :---: | */
const splitRow = (row: string): string[] => {
  let r = String(row).trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split('|').map((c) => c.trim());
};
const isSeparatorRow = (row: string): boolean => {
  const cells = splitRow(row);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
};
const alignOf = (cell: string): 'left' | 'right' | 'center' => {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
};

/** Är alla listpunkter enbart #ankarlänkar? Då är det en innehållsförteckning. */
const isTocItems = (items: string[]): boolean =>
  items.length >= 2 && items.every((t) => /^\[[^\]]+\]\(#[^)]+\)$/.test(t.trim()));

/**
 * Rendera markdown till HTML-sträng.
 */
export function renderBlogMarkdown(md = ''): string {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  const isBlockStart = (idx: number): boolean => {
    const line = lines[idx];
    return (
      /^#{1,4}\s+/.test(line) ||
      /^[-*]\s+/.test(line) ||
      /^\d+\.\s+/.test(line) ||
      /^>\s?/.test(line) ||
      /^\s*</.test(line) ||
      /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
      (/^\s*\|/.test(line) && idx + 1 < lines.length && isSeparatorRow(lines[idx + 1]))
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Rått HTML-block (t.ex. <a id="...">) – släpp igenom orört
    if (/^\s*</.test(line)) {
      const raw: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') { raw.push(lines[i]); i++; }
      out.push(raw.join('\n'));
      continue;
    }

    // Rubriker
    const headingMatch = line.match(/^(#{1,4})\s+(.+?)\s*#*\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const plain = stripInlineMarks(text).toLowerCase();
      // Hoppa över "## Innehåll" om nästa block är en TOC-lista –
      // nav-blocket får sin egen rubrik.
      if (level === 2 && plain === 'innehåll') {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && /^[-*]\s+/.test(lines[j])) {
          const items: string[] = [];
          let k = j;
          while (k < lines.length && /^[-*]\s+/.test(lines[k])) {
            items.push(lines[k].replace(/^[-*]\s+/, ''));
            k++;
          }
          if (isTocItems(items)) { i++; continue; }
        }
      }
      out.push(`<h${level} id="${slugifyHeading(stripInlineMarks(text))}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // Horisontell linje
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    // Tabell (GFM)
    if (/^\s*\|/.test(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headers = splitRow(line).map((c) => inline(c));
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]) && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]).map((c) => inline(c)));
        i++;
      }
      const th = headers.map((h, k) => `<th style="text-align:${aligns[k] || 'left'}">${h}</th>`).join('');
      const trs = rows
        .map((r) => `<tr>${r.map((c, k) => `<td style="text-align:${aligns[k] || 'left'}">${c}</td>`).join('')}</tr>`)
        .join('');
      out.push(`<div class="table-wrapper"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const qs: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        qs.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${qs.map((q) => inline(q)).join('<br />')}</blockquote>`);
      continue;
    }

    // Punktlista (TOC-kort om alla punkter är #ankare)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      if (isTocItems(items)) {
        const links = items.map((t) => {
          const m = t.trim().match(/^\[([^\]]+)\]\((#[^)]+)\)$/);
          return `<li><a href="${m![2]}">${inline(m![1])}</a></li>`;
        }).join('');
        out.push(`<nav class="blog-toc" aria-label="Innehåll"><p class="blog-toc-title">Innehåll</p><ol>${links}</ol></nav>`);
      } else {
        out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      }
      continue;
    }

    // Numrerad lista
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    // Stycke – samla tills tom rad eller nytt block
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(i)) {
      para.push(lines[i]);
      i++;
    }
    if (para.length > 0) out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/**
 * Ta bort en inledande rubrik i innehållet om den upprepar artikelns titel
 * (många äldre inlägg har titeln både som # rubrik och i post.title).
 */
export function stripDuplicateTitleHeading(html = '', postTitle = ''): string {
  const norm = (s: string) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!norm(postTitle)) return html;
  return html.replace(/^\s*<(h[12])\b[^>]*>([\s\S]*?)<\/\1>/i, (full, tag, inner) =>
    norm(inner) === norm(postTitle) ? '' : full,
  );
}

export interface BreedFigure {
  match: string;
  image: string;
  label: string;
  alt: string;
}

/**
 * Hönsraser med egna bilder – injiceras som <figure> efter matchande h3-rubrik.
 * match = söksträng (lowercase, substring av rubriktexten).
 */
export const BREED_FIGURES: BreedFigure[] = [
  { match: 'hedemora', image: '/blog-images/breeds/hedemora.jpg', label: 'Hedemora', alt: 'Hedemorahöna med tät mörk fjäderdräkt på grönt gräs' },
  { match: 'svarthöna', image: '/blog-images/breeds/svarthona.jpg', label: 'Bohuslän-Dals svarthöna', alt: 'Svartglänsande Bohuslän-Dals svarthöna' },
  { match: 'blommehöna', image: '/blog-images/breeds/blommehona.jpg', label: 'Skånsk blommehöna', alt: 'Blommig skånsk blommehöna i trädgård' },
  { match: 'öländsk dvärghöna', image: '/blog-images/breeds/olandsk-dvarghona.jpg', label: 'Öländsk dvärghöna', alt: 'Liten öländsk dvärghöna på gräs' },
  { match: 'gammalsvensk', image: '/blog-images/breeds/gammalsvensk-dvarghona.jpg', label: 'Gammalsvensk dvärghöna', alt: 'Gammalsvensk dvärghöna, Sveriges minsta hönsras' },
  { match: 'bovans', image: '/blog-images/breeds/bovans-goldline.jpg', label: 'Bovans Goldline', alt: 'Kastanjebrun Bovans Goldline-höna' },
  { match: 'hy-line', image: '/blog-images/breeds/hy-line-brown.jpg', label: 'Hy-Line Brown', alt: 'Brun Hy-Line Brown-höna på hönsgård' },
  { match: 'lohmann', image: '/blog-images/breeds/lohmann-brown.jpg', label: 'Lohmann Brown', alt: 'Brun Lohmann Brown-höna i dagsljus' },
  { match: 'maran', image: '/blog-images/breeds/maran.jpg', label: 'Maran', alt: 'Maran-höna med kopparfärgad halsfjädring' },
  { match: 'sussex', image: '/blog-images/breeds/sussex.jpg', label: 'Sussex', alt: 'Vit sussexhöna med svart hals- och stjärtfjädring' },
  { match: 'silkehöna', image: '/blog-images/breeds/silkehona.jpg', label: 'Silkehöna', alt: 'Vit fluffig silkehöna' },
  { match: 'silverudd', image: '/blog-images/breeds/silverudds-bla.jpg', label: 'Silverudds Blå', alt: 'Blågrå Silverudds Blå-höna' },
];

/**
 * Lägg in rasbilder direkt efter h3-rubriker vars text matchar en känd ras.
 * Max en bild per ras, och bara på h3-nivå (där raserna beskrivs).
 */
export function injectBreedFigures(html = ''): string {
  const used = new Set<string>();
  return html.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (full, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, '').toLowerCase();
    const breed = BREED_FIGURES.find((b) => !used.has(b.match) && text.includes(b.match));
    if (!breed) return full;
    used.add(breed.match);
    return `${full}<figure class="breed-figure"><img src="${breed.image}" alt="${breed.alt}" loading="lazy" /><figcaption>${breed.label}</figcaption></figure>`;
  });
}

/** Hero-bild per kategori för inlägg utan egen omslagsbild. */
export const CATEGORY_HERO: Record<string, string> = {
  raser: '/blog-images/chicken-breeds.jpg',
  halsa: '/blog-images/hen-health-check.jpg',
  nyborjare: '/blog-images/kopa-hons.jpg',
  guide: '/blog-images/hens-garden.jpg',
  tips: '/blog-images/hen-detail.jpg',
  recension: '/blog-images/honshus-2026-kopguide.jpg',
  tradgard: '/blog-images/odla-gronsaker.jpg',
  hem: '/blog-images/kompostera-hemma.jpg',
  friluftsliv: '/blog-images/packlista-vandring.jpg',
};

const DEFAULT_HERO = '/blog-images/hens-garden.jpg';

interface HeroPost {
  feature_image_url?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
}

/** Välj hero-bild: egen feature/cover först, annars kategori-default. */
export function heroForPost(post?: HeroPost | null): string {
  if (!post) return DEFAULT_HERO;
  return post.feature_image_url || post.cover_image_url || CATEGORY_HERO[(post.category || '').toLowerCase()] || DEFAULT_HERO;
}
