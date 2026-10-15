import { writeFileSync } from 'node:fs';

/** Separate app/404 shells prevent private or missing URLs inheriting home SEO. */
export function writeHostingPages(template, brand) {
  const clean = template
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']+)["']|property=["']og:[^"']+["'])[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["'](?:canonical|alternate)["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');
  const shell = clean.replace('</head>', `<title>${brand}</title><meta name="robots" content="noindex, follow"></head>`);
  writeFileSync('dist/app.html', shell);
  const notFound = clean.replace('</head>', `<title>Sidan hittades inte | ${brand}</title><meta name="robots" content="noindex, follow"></head>`)
    .replace('<div id="root"></div>', `<div id="root"><main style="max-width:60rem;margin:4rem auto;padding:1.5rem;font-family:system-ui"><nav><a href="/">${brand}</a> · <a href="/blogg">Blogg</a></nav><h1>404 – sidan hittades inte</h1><p>Adressen finns inte. Kontrollera länken eller gå till startsidan.</p><a href="/">Till startsidan</a></main></div>`);
  writeFileSync('dist/404.html', notFound);
}
