import { escapeHtml } from './prerenderTopicPages.mjs';

/** The same public copy as React, available before JavaScript runs. */
export function renderSeoLandingBody(page) {
  const secondaryPath = page.secondaryCta.includes('foder') ? '/foderkostnad-hons'
    : page.secondaryCta.includes('ägg') ? '/agglogg'
    : page.secondaryCta.includes('hönskalender') ? '/honskalender' : '/app-for-honsagare';
  const list = (items) => `<ul class="list-disc pl-5 space-y-2">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return `<main id="main-content" class="container mx-auto max-w-4xl px-5 pt-24 pb-16 space-y-8">
    <nav><a class="underline" href="/">Hönsgården</a> · <a class="underline" href="/blogg">Guider om höns</a></nav>
    <header><p>${escapeHtml(page.eyebrow)}</p><h1 class="font-serif text-4xl my-5">${escapeHtml(page.h1)}</h1>
      <p class="text-lg leading-relaxed">${escapeHtml(page.intro)}</p>
      <p class="my-5"><a class="underline text-primary" href="/login?mode=register">${escapeHtml(page.primaryCta)}</a> · <a class="underline" href="${secondaryPath}">${escapeHtml(page.secondaryCta)}</a></p>
      ${list(page.heroBullets)}</header>
    ${page.sections.map(section => `<section><h2 class="font-serif text-2xl mb-3">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
    <section><h2 class="font-serif text-2xl mb-3">Råd från hönsgården</h2>${list(page.practicalTips)}</section>
    <section><h2 class="font-serif text-2xl mb-3">Vanliga frågor</h2>${page.faq.map(item => `<div class="my-4"><h3 class="font-semibold">${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p></div>`).join('')}</section>
    <p><a class="underline text-primary" href="/login?mode=register">Skapa konto gratis</a></p>
  </main>`;
}
