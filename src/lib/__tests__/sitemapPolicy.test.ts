import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  extractBlogArticlePosts,
  filterSitemapXml,
  isRobotsDisallowed,
  mergeBlogPosts,
  parseStarDisallows,
  pathMatchesDisallow,
  pathnameFromLoc,
} from '../sitemapPolicy';

const robotsTxt = readFileSync('public/robots.txt', 'utf8');
const committedSitemap = readFileSync('public/sitemap.xml', 'utf8');
const disallows = parseStarDisallows(robotsTxt);

describe('sitemapPolicy', () => {
  it('läser Disallow-regler från User-agent: * i robots.txt', () => {
    expect(disallows).toEqual([
      '/app',
      '/login',
      '/reset-password',
      '/inbjudan',
      '/karta/bekrafta',
      '/karta/hantera',
    ]);
  });

  it('blockerar /app och undersidor men inte /app-for-honsagare', () => {
    expect(pathMatchesDisallow('/app', '/app')).toBe(true);
    expect(pathMatchesDisallow('/app/', '/app')).toBe(true);
    expect(pathMatchesDisallow('/app/dashboard', '/app')).toBe(true);
    expect(pathMatchesDisallow('/app-for-honsagare', '/app')).toBe(false);
    expect(isRobotsDisallowed('https://honsgarden.se/app', disallows)).toBe(true);
    expect(isRobotsDisallowed('https://honsgarden.se/app-for-honsagare', disallows)).toBe(false);
    expect(isRobotsDisallowed('https://honsgarden.se/login', disallows)).toBe(true);
    expect(isRobotsDisallowed('https://honsgarden.se/blogg/bast-honsras-sverige', disallows)).toBe(false);
    expect(isRobotsDisallowed('https://honsgarden.se/salja-agg/goteborg', disallows)).toBe(false);
  });

  it('plockar artikel-sluggar från sitemap-XML, inte kategori/tagg', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>https://honsgarden.se/blogg</loc></url>
  <url><loc>https://honsgarden.se/blogg/kategori/raser</loc></url>
  <url><loc>https://honsgarden.se/blogg/bast-honsras-sverige</loc></url>
  <url><loc>https://honsgarden.se/blogg/foder-till-hons-guide</loc></url>
</urlset>`;
    expect(extractBlogArticlePosts(xml).map((post) => post.slug)).toEqual([
      'bast-honsras-sverige',
      'foder-till-hons-guide',
    ]);
  });

  it('slår ihop bloggposter från fetch och befintlig sitemap', () => {
    const merged = mergeBlogPosts(
      [{ slug: 'ny-artikel', title: 'Ny' }],
      extractBlogArticlePosts(committedSitemap),
    );
    expect(merged.some((post) => post.slug === 'bast-honsras-sverige')).toBe(true);
    expect(merged.some((post) => post.slug === 'ny-artikel')).toBe(true);
  });

  it('tolkar absoluta URL:er till pathname', () => {
    expect(pathnameFromLoc('https://honsgarden.se/app')).toBe('/app');
    expect(pathnameFromLoc('/login')).toBe('/login');
  });

  it('tar bort robots-blockerade URL:er ur sitemap-XML men behåller landningssidan', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url>
    <loc>https://honsgarden.se/app</loc>
  </url>
  <url>
    <loc>https://honsgarden.se/app-for-honsagare</loc>
  </url>
  <url>
    <loc>https://honsgarden.se/blogg/bast-honsras-sverige</loc>
  </url>
</urlset>
`;
    const filtered = filterSitemapXml(xml, disallows);
    expect(filtered).not.toContain('https://honsgarden.se/app</loc>');
    expect(filtered).toContain('https://honsgarden.se/app-for-honsagare');
    expect(filtered).toContain('https://honsgarden.se/blogg/bast-honsras-sverige');
  });
});
