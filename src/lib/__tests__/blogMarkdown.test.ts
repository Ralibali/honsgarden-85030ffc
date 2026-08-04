import { describe, it, expect } from 'vitest';
import {
  renderBlogMarkdown,
  stripDuplicateTitleHeading,
  injectBreedFigures,
  heroForPost,
  slugifyHeading,
} from '@/lib/blogMarkdown';

describe('renderBlogMarkdown', () => {
  it('renderar GFM-tabell med thead, tbody och alignment', () => {
    const md = `| Ras | Ägg/år | Pris |
|-----|-------:|-----:|
| Hedemora | 150–200 | 200–400 |
| Bovans | 300–320 | 150–250 |`;
    const html = renderBlogMarkdown(md);
    expect(html).toContain('<div class="table-wrapper"><table>');
    expect(html).toContain('<th style="text-align:left">Ras</th>');
    expect(html).toContain('<th style="text-align:right">Ägg/år</th>');
    expect(html).toContain('<td style="text-align:right">150–200</td>');
    // 1 header-rad + 2 body-rader
    expect((html.match(/<tr>/g) || []).length).toBe(3);
    // Inga råa pipe-tecken ska läcka ut som text
    expect(html).not.toContain('|---|');
  });

  it('grupperar punktlista i ett enda ul-element', () => {
    const html = renderBlogMarkdown('- ett\n- två\n- tre');
    expect((html.match(/<ul>/g) || []).length).toBe(1);
    expect((html.match(/<li>/g) || []).length).toBe(3);
  });

  it('renderar numrerad lista som ol', () => {
    const html = renderBlogMarkdown('1. första\n2. andra');
    expect(html).toContain('<ol>');
    expect((html.match(/<li>/g) || []).length).toBe(2);
  });

  it('gör TOC-kort av lista med enbart #ankare och döljer "Innehåll"-rubriken', () => {
    const md = `## Innehåll

- [Del ett](#del-ett)
- [Del två](#del-tva)

## Del ett`;
    const html = renderBlogMarkdown(md);
    expect(html).toContain('<nav class="blog-toc"');
    expect(html).toContain('href="#del-ett"');
    // Rubriken "Innehåll" ska inte renderas som egen h2 – nav:et har egen titel
    expect(html).not.toContain('>Innehåll</h2>');
    expect(html).toContain('blog-toc-title');
  });

  it('renderar vanlig lista med länkar som ul (inte TOC-kort)', () => {
    const md = '- [Extern](https://exempel.se)\n- Bara text';
    const html = renderBlogMarkdown(md);
    expect(html).toContain('<ul>');
    expect(html).not.toContain('blog-toc');
  });

  it('ger rubriker slugifierade id:n', () => {
    const html = renderBlogMarkdown('### 1. Hedemora');
    expect(html).toContain('<h3 id="1-hedemora">');
  });

  it('släpper igenom råa HTML-block orörda', () => {
    const html = renderBlogMarkdown('<a id="valja-ras"></a>');
    expect(html).toBe('<a id="valja-ras"></a>');
  });

  it('escapar HTML i vanlig stycketext', () => {
    const html = renderBlogMarkdown('Text med <script>alert(1)</script> inline');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renderar fet, kursiv och kod inline', () => {
    const html = renderBlogMarkdown('**fet** och *kursiv* samt `kod`');
    expect(html).toContain('<strong>fet</strong>');
    expect(html).toContain('<em>kursiv</em>');
    expect(html).toContain('<code>kod</code>');
  });

  it('ger affiliatelänkar knapp-styling och sponsored-rel', () => {
    const html = renderBlogMarkdown('[Köp här →](https://do.p-lindberg.se/t/t?a=1)');
    expect(html).toContain('rel="noopener sponsored"');
    expect(html).toContain('bg-primary');
  });

  it('ger interna länkar utan target=_blank', () => {
    const html = renderBlogMarkdown('[Läs mer](/blogg/annan-artikel)');
    expect(html).toContain('href="/blogg/annan-artikel"');
    expect(html).not.toContain('target="_blank"');
  });
});

describe('stripDuplicateTitleHeading', () => {
  it('tar bort inledande h1 som matchar post.title', () => {
    const html = '<h1 id="x">Vilka hönsraser passar bäst?</h1>\n<p>Text</p>';
    expect(stripDuplicateTitleHeading(html, 'Vilka hönsraser passar bäst?')).toBe('\n<p>Text</p>');
  });

  it('behåller h1 som INTE matchar titeln', () => {
    const html = '<h1 id="x">Något helt annat</h1>';
    expect(stripDuplicateTitleHeading(html, 'Vilka hönsraser passar bäst?')).toBe(html);
  });

  it('matchar oavsett HTML-taggar i rubriken', () => {
    const html = '<h1 id="x">Vilka <strong>hönsraser</strong> passar bäst?</h1>';
    expect(stripDuplicateTitleHeading(html, 'Vilka hönsraser passar bäst?')).toBe('');
  });
});

describe('injectBreedFigures', () => {
  it('lägger in rasbild efter matchande h3', () => {
    const html = '<h3 id="1-hedemora">1. Hedemora</h3><ul><li>Fakt</li></ul>';
    const result = injectBreedFigures(html);
    expect(result).toContain('<figure class="breed-figure">');
    expect(result).toContain('/blog-images/breeds/hedemora.jpg');
    expect(result.indexOf('</h3>')).toBeLessThan(result.indexOf('<figure'));
  });

  it('lägger bara in en bild per ras', () => {
    const html = '<h3>1. Hedemora</h3><h3>99. Hedemora igen</h3>';
    const result = injectBreedFigures(html);
    expect((result.match(/breed-figure/g) || []).length).toBe(1);
  });

  it('rör inte h3 utan rasnamn', () => {
    const html = '<h3>Vanliga frågor om foder</h3>';
    expect(injectBreedFigures(html)).toBe(html);
  });
});

describe('heroForPost', () => {
  it('prioriterar feature före cover före kategori före default', () => {
    expect(heroForPost({ feature_image_url: '/a.jpg', cover_image_url: '/b.jpg', category: 'raser' })).toBe('/a.jpg');
    expect(heroForPost({ cover_image_url: '/b.jpg', category: 'raser' })).toBe('/b.jpg');
    expect(heroForPost({ category: 'raser' })).toBe('/blog-images/chicken-breeds.jpg');
    // Kategorier i databasen kan ha versal begynnelsebokstav ("Raser")
    expect(heroForPost({ category: 'Raser' })).toBe('/blog-images/chicken-breeds.jpg');
    expect(heroForPost({ category: 'okand' })).toBe('/blog-images/hens-garden.jpg');
    expect(heroForPost(null)).toBe('/blog-images/hens-garden.jpg');
  });
});

describe('slugifyHeading', () => {
  it('hanterar svenska tecken', () => {
    expect(slugifyHeading('Öländsk dvärghöna – bäst!')).toBe('olandsk-dvarghona-bast');
  });
});
