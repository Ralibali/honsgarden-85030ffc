import { useEffect } from 'react';

const BASE = 'https://honsgarden.se';
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow';

interface SeoOptions {
  title: string;
  description: string;
  path: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
  articleMeta?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
}

/**
 * Stabil SEO-hook. Uppdaterar metadata på plats i stället för att
 * skapa/förstöra noder per route-byte. Säkerställer:
 *   - exakt en canonical
 *   - exakt en robots
 *   - hreflang dupliceras inte
 *   - JSON-LD ersätts atomärt per sida
 * Ingen cleanup på unmount – nästa sida tar över taggarna.
 */
export function useSeo({
  title,
  description,
  path,
  ogType = 'website',
  ogImage,
  ogImageAlt,
  noindex,
  jsonLd,
  articleMeta,
}: SeoOptions) {
  useEffect(() => {
    const fullUrl = `${BASE}${path}`;

    const upsertMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const upsertLink = (rel: string, href: string, hreflang?: string) => {
      const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]:not([hreflang])`;
      let el = document.head.querySelector<HTMLLinkElement>(selector);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        if (hreflang) el.setAttribute('hreflang', hreflang);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Title
    document.title = title;

    // Core meta
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? NOINDEX_ROBOTS : DEFAULT_ROBOTS);

    // Canonical (en enda)
    upsertLink('canonical', fullUrl);

    // Hreflang (max ett per språk – uppdateras in-place)
    upsertLink('alternate', fullUrl, 'sv');
    upsertLink('alternate', fullUrl, 'x-default');

    // Open Graph
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', fullUrl);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:site_name', 'Hönsgården');
    upsertMeta('property', 'og:locale', 'sv_SE');
    if (ogImage) {
      const imgUrl = ogImage.startsWith('http') ? ogImage : `${BASE}${ogImage}`;
      upsertMeta('property', 'og:image', imgUrl);
      upsertMeta('property', 'og:image:alt', ogImageAlt || title);
      upsertMeta('property', 'og:image:type', 'image/jpeg');
      upsertMeta('property', 'og:image:width', '1200');
      upsertMeta('property', 'og:image:height', '630');
      upsertMeta('name', 'twitter:image', imgUrl);
      upsertMeta('name', 'twitter:image:alt', ogImageAlt || title);
    }

    // Twitter
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);

    // Article-specifik meta – rensa gamla article:tag innan vi skriver nya
    document.head.querySelectorAll('meta[property="article:tag"]').forEach((el) => el.remove());
    if (articleMeta) {
      if (articleMeta.publishedTime) upsertMeta('property', 'article:published_time', articleMeta.publishedTime);
      if (articleMeta.modifiedTime) upsertMeta('property', 'article:modified_time', articleMeta.modifiedTime);
      if (articleMeta.author) upsertMeta('property', 'article:author', articleMeta.author);
      if (articleMeta.section) upsertMeta('property', 'article:section', articleMeta.section);
      if (articleMeta.tags) {
        articleMeta.tags.forEach((tag) => {
          const el = document.createElement('meta');
          el.setAttribute('property', 'article:tag');
          el.setAttribute('content', tag);
          document.head.appendChild(el);
        });
      }
    }

    // AI citation meta
    upsertMeta('name', 'citation_title', title);
    upsertMeta('name', 'citation_author', 'Hönsgården');
    upsertMeta('name', 'citation_language', 'sv');

    // JSON-LD per sida – ersätts atomärt
    const existingScript = document.getElementById('json-ld-page') as HTMLScriptElement | null;
    if (jsonLd) {
      const data = Array.isArray(jsonLd)
        ? { '@context': 'https://schema.org', '@graph': jsonLd }
        : { '@context': 'https://schema.org', ...jsonLd };
      const script = existingScript ?? document.createElement('script');
      script.id = 'json-ld-page';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      if (!existingScript) document.head.appendChild(script);
    } else if (existingScript) {
      existingScript.remove();
    }
    // Ingen cleanup – nästa sida uppdaterar taggarna in-place.
  }, [title, description, path, ogType, ogImage, ogImageAlt, noindex, jsonLd, articleMeta]);
}
