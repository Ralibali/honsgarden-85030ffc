/**
 * Read-only verification of the latest editorial release on the real domain.
 * node scripts/verify-editorial-live.mjs [--wait=600] [--browser]
 * Browser mode needs playwright installed; see editorial-live.yml.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { isRobotsDisallowed, parseStarDisallows } from '../src/lib/sitemapPolicy.mjs';

const release = JSON.parse(await readFile('content/editorial/live-release.json', 'utf8'));
const origin = release.origin;
const normalize = (text) => String(text || '').replace(/\s+/g, ' ').trim();
const fragmentText = (html) => normalize(JSDOM.fragment(html).textContent);
const waitSeconds = Number(process.argv.find((arg) => arg.startsWith('--wait='))?.split('=')[1] || 0);
const deadline = Date.now() + Math.min(Math.max(waitSeconds, 0), 900) * 1000;
const report = { checked_at: '', origin, pages: [], redirects: [], browser: [] };
const output = 'artifacts/editorial-live';
await mkdir(output, { recursive: true });

async function request(path, redirect = 'follow') {
  return fetch(new URL(path, origin), {
    redirect,
    signal: AbortSignal.timeout(20000),
    headers: { 'user-agent': 'Honsgarden-Editorial-Verification/1.0', 'cache-control': 'no-cache' },
  });
}

async function inspect() {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(message); };
  const sitemapResponse = await request('/sitemap.xml');
  const sitemap = await sitemapResponse.text();
  check(sitemapResponse.status === 200, 'sitemap HTTP ' + sitemapResponse.status);
  const robotsResponse = await request('/robots.txt');
  const robots = await robotsResponse.text();
  check(robotsResponse.status === 200, 'robots.txt HTTP ' + robotsResponse.status);
  const disallows = parseStarDisallows(robots);
  const checkedLinks = new Set();
  report.pages = [];
  report.redirects = [];
  for (const article of release.articles) {
    const path = '/blogg/' + article.slug;
    const response = await request(path, 'manual');
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const text = normalize(doc.body.textContent);
    const h1s = [...doc.querySelectorAll('h1')].map((node) => normalize(node.textContent));
    const canonical = [...doc.querySelectorAll('link[rel="canonical"]')].map((node) => node.href);
    const metaRobots = [...doc.querySelectorAll('meta[name="robots"]')].map((node) => node.content).join(',');
    check(response.status === 200, path + ' HTTP ' + response.status);
    check(h1s.length === 1 && h1s[0] === article.title, path + ' incorrect H1: ' + JSON.stringify(h1s));
    check(canonical.length === 1 && canonical[0] === origin + path, path + ' incorrect canonical');
    check(!/noindex|none/i.test(metaRobots + ',' + response.headers.get('x-robots-tag')), path + ' noindex');
    check(!isRobotsDisallowed(path, disallows), path + ' blocked by robots.txt');
    check(sitemap.includes('<loc>' + origin + path + '</loc>'), path + ' missing in sitemap');
    for (const marker of article.markers_html) {
      check(text.includes(fragmentText(marker)), path + ' missing reviewed text in raw HTML');
    }
    const hero = doc.querySelector('article img');
    let heroStatus = null;
    if (hero?.getAttribute('src')) {
      const image = await request(hero.getAttribute('src'));
      heroStatus = image.status;
      check(image.status === 200 && /^image\//.test(image.headers.get('content-type') || ''), path + ' broken hero image');
      await image.arrayBuffer();
    } else check(false, path + ' missing hero image');
    for (const link of article.cta_paths) {
      check([...doc.querySelectorAll('a[href]')].some((a) => new URL(a.getAttribute('href'), origin).pathname === new URL(link, origin).pathname), path + ' missing link ' + link);
      if (checkedLinks.has(link)) continue;
      checkedLinks.add(link);
      const target = await request(link);
      const targetHtml = await target.text();
      const targetDom = new JSDOM(targetHtml);
      const headings = normalize([...targetDom.window.document.querySelectorAll('h1')].map((node) => node.textContent).join(' '));
      check(target.status === 200 && headings.length > 0 && !/404|hittades inte|sidan finns inte/i.test(headings), link + ' broken link or soft 404');
      targetDom.window.close();
    }
    report.pages.push({ path, status: response.status, h1: h1s, canonical, hero_status: heroStatus });
    dom.window.close();
  }
  for (const [path, target] of Object.entries(release.redirects)) {
    const response = await request(path, 'manual');
    const location = response.headers.get('location');
    check([301, 308].includes(response.status) && location && new URL(location, origin).pathname === target, path + ' missing permanent redirect to ' + target);
    check(!sitemap.includes('<loc>' + origin + path + '</loc>'), path + ' still in sitemap');
    report.redirects.push({ path, status: response.status, location });
  }
  return errors;
}

let errors = [];
for (;;) {
  try { errors = await inspect(); } catch (error) { errors = [error.message]; }
  if (!errors.length || Date.now() >= deadline) break;
  console.log('Waiting for deployment: ' + JSON.stringify(errors));
  await new Promise((resolve) => setTimeout(resolve, Math.min(30000, Math.max(0, deadline - Date.now()))));
}

if (!errors.length && process.argv.includes('--browser')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      for (const article of release.articles) {
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        try {
          await page.goto(origin + '/blogg/' + article.slug, { waitUntil: 'networkidle', timeout: 45000 });
          await page.locator('h1').first().waitFor();
          const headings = await page.locator('h1').allTextContents();
          const bodyText = normalize(await page.locator('body').innerText());
          const checks = {
            slug: article.slug, width: viewport.width,
            h1: headings.length === 1 && normalize(headings[0]) === article.title,
            reviewed_text: article.markers_html.every((marker) => bodyText.includes(fragmentText(marker))),
            hero_loaded: await page.locator('article img').first().evaluate((img) => img.complete && img.naturalWidth > 0),
            no_horizontal_overflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
            page_errors: pageErrors,
          };
          await page.screenshot({ path: output + '/' + article.slug + '-' + viewport.width + '.png', fullPage: true });
          report.browser.push(checks);
          if (!checks.h1 || !checks.reviewed_text || !checks.hero_loaded || !checks.no_horizontal_overflow || pageErrors.length) errors.push('Browser failed: ' + JSON.stringify(checks));
        } catch (error) { errors.push(article.slug + ' browser ' + viewport.width + ': ' + error.message); }
        await page.close();
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
report.checked_at = new Date().toISOString();
report.errors = errors;
await writeFile(output + '/report.json', JSON.stringify(report, null, 2) + '\n');
console.log('EDITORIAL_LIVE:' + JSON.stringify(report));
if (errors.length) process.exitCode = 1;
