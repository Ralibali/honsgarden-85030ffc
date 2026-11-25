import { breedGuideBullet } from '../data/breedGuides.mjs';
import { escapeHtml } from './prerenderTopicPages.mjs';
import { renderDigitalGuidePlacement } from './digitalGuidePlacements.mjs';
import { renderContextualShopPlacementHtml, shopPlacementForPath } from './contextualShopPlacements.mjs';

function renderBullet(text) {
  const bullet = breedGuideBullet(text);
  if (!bullet.href) return escapeHtml(bullet.text);
  return `<a class="underline" href="${escapeHtml(bullet.href)}">${escapeHtml(bullet.text)}</a>`;
}

function renderTable(rows) {
  if (!rows) return '';
  const columns = [
    ['namn', 'Ras'], ['ursprung', 'Ursprung'], ['vikt', 'Vikt'], ['agg_per_ar', 'Ägg/år'],
    ['aggfarg', 'Äggfärg'], ['temperament', 'Temperament'], ['passar', 'Passar'],
  ];
  return `<div class="table-scroll" role="region" aria-label="Jämförelsetabell, rulla i sidled" tabindex="0">
    <table class="text-left text-sm"><caption class="text-left text-xl font-serif mb-3">Stor jämförelsetabell</caption>
    <thead><tr>${columns.map(([, label]) => `<th scope="col" class="p-2">${label}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr class="border-t">${columns.map(([key]) => `<td class="p-2">${escapeHtml(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function renderBreedGuide(page) {
  const shop = shopPlacementForPath(page.path);
  const paragraphs = items => items.map(text => `<p class="mb-4">${escapeHtml(text)}</p>`).join('');
  return `<main id="main-content" tabindex="-1" class="container mx-auto max-w-4xl px-5 pt-24 pb-16 space-y-8">
    <nav aria-label="Brödsmulor"><a class="underline" href="/">Hem</a></nav>
    <header><h1 class="font-serif text-4xl mb-5">${escapeHtml(page.h1)}</h1>${paragraphs(page.intro)}</header>
    ${page.sections.map(section => `<section><h2 class="font-serif text-2xl mb-4">${escapeHtml(section.heading)}</h2>
      ${paragraphs(section.paragraphs)}
      ${section.bullets ? `<ul class="list-disc pl-5 space-y-2">${section.bullets.map(text => `<li>${renderBullet(text)}</li>`).join('')}</ul>` : ''}</section>`).join('')}
    ${renderTable(page.breedTable)}
    <section><h2 class="font-serif text-2xl mb-4">Vanliga frågor</h2>
      ${page.faq.map(item => `<h3 class="font-semibold">${escapeHtml(item.q)}</h3><p class="mb-4">${escapeHtml(item.a)}</p>`).join('')}</section>
    <nav aria-label="Läs vidare"><ul class="list-disc pl-5">${page.relatedLinks.map(link => `<li><a class="underline" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul></nav>
    ${renderDigitalGuidePlacement('breed')}${shop ? renderContextualShopPlacementHtml(shop) : ''}
  </main>`;
}
