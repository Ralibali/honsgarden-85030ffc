import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BREED_PRERENDER_PROFILES } from '@/data/honsraserBreedProfiles.mjs';
import { renderBreedTopicBody, renderDemoTopicBody, renderHomeTopicBody } from '@/lib/prerenderTopicPages';

const indexHtml = readFileSync('index.html', 'utf8');

describe('skip-to-content target', () => {
  it('index.html har skip-länk till #main-content', () => {
    expect(indexHtml).toContain('href="#main-content"');
    expect(indexHtml).toContain('Hoppa till innehåll');
  });

  it('renderHomeTopicBody gör #main-content fokuserbar med tabindex="-1"', () => {
    const html = renderHomeTopicBody();
    expect(html).toContain('id="main-content"');
    expect(html).toContain('tabindex="-1"');
  });

  it('renderDemoTopicBody gör #main-content fokuserbar med tabindex="-1"', () => {
    const html = renderDemoTopicBody();
    expect(html).toContain('id="main-content"');
    expect(html).toContain('tabindex="-1"');
  });

  it('renderBreedTopicBody gör #main-content fokuserbar med tabindex="-1"', () => {
    const breed = BREED_PRERENDER_PROFILES.find((item: { slug: string }) => item.slug === 'orpington');
    if (!breed) throw new Error('saknar rasprofil orpington');
    const html = renderBreedTopicBody(breed);
    expect(html).toContain('id="main-content"');
    expect(html).toContain('tabindex="-1"');
  });
});
