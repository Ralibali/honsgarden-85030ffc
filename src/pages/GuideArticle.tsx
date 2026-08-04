import React, { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import BlogConversionPopup from '@/components/blog/BlogConversionPopup';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Egg, Loader2, BookOpen, CalendarDays, Clock } from 'lucide-react';
import ShareButtons from '@/components/ShareButtons';
import NewsletterSignup from '@/components/NewsletterSignup';
import ArticleCta from '@/components/blog/ArticleCta';
import StickySidebarCta from '@/components/blog/StickySidebarCta';
import { useAuth } from '@/hooks/useAuth';
import { AffiliateBannerRotator } from '@/components/AffiliateBannerRotator';
import { AffiliateProductBox } from '@/components/AffiliateProductBox';
import RecommendedProducts from '@/components/affiliate/RecommendedProducts';
import { trackAffiliateClick } from '@/lib/affiliateTracking';
import { renderBlogMarkdown, stripDuplicateTitleHeading, injectBreedFigures, heroForPost, slugifyHeading, isHtmlContent } from '@/lib/blogMarkdown';
const BlogComments = lazy(() => import('@/components/BlogComments'));

/**
 * Event-delegerar klick på affiliate-länkar inom artikelns prose-container
 * (glossary-länkar, inline-länkar i markdown etc). Loggar advertiser baserat på href.
 */
function handleProseAffiliateClick(
  e: React.MouseEvent<HTMLDivElement>,
  slug: string,
) {
  // Hoppa över synthetic 'click' triggad efter mousedown – vi loggar redan på mousedown
  if (e.type === 'click' && e.detail > 0) return;
  const target = e.target as HTMLElement | null;
  const anchor = target?.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;
  const href = anchor.href;
  if (!href) return;

  // Identifiera affiliate-länkar: sponsored rel ELLER känd tracking-domän
  const rel = (anchor.getAttribute('rel') || '').toLowerCase();
  const isSponsored = rel.includes('sponsored');
  const hrefLower = href.toLowerCase();
  let advertiser: string | null = null;
  if (hrefLower.includes('bonden.se') || hrefLower.includes('pin.bonden')) advertiser = 'bonden';
  else if (hrefLower.includes('p-lindberg')) advertiser = 'p-lindberg';
  else if (hrefLower.includes('adtraction')) advertiser = 'adtraction';
  else if (hrefLower.includes('awin')) advertiser = 'awin';
  else if (hrefLower.includes('tradedoubler')) advertiser = 'tradedoubler';

  if (!isSponsored && !advertiser) return;

  trackAffiliateClick({
    advertiser: advertiser || 'unknown',
    source: 'glossary',
    slug,
    href,
  });
}

const categoryLabels: Record<string, string> = {
  guide: 'Guide',
  recension: 'Recension',
  tips: 'Tips & tricks',
  halsa: 'Hälsa',
  nyborjare: 'Nybörjare',
  raser: 'Raser',
  tradgard: 'Trädgård & odling',
  hem: 'Hem & hållbarhet',
  friluftsliv: 'Friluftsliv & natur',
};

function extractToc(content: string) {
  const source = content.replace(/<[^>]+>/g, (tag) => tag.startsWith('<h') || tag.startsWith('</h') ? tag : '');
  const headings: { id: string; text: string; level: number }[] = [];
  const markdownRegex = /^(##|###)\s+(.+)$/gm;
  let match;
  while ((match = markdownRegex.exec(content)) !== null) {
    const text = match[2].replace(/[#*_`]/g, '').trim();
    // "Innehåll"-rubriken renderas som TOC-kort, inte som egen rubrik – hoppa över den
    if (text && text.toLowerCase() !== 'innehåll') headings.push({ id: slugifyHeading(text), text, level: match[1].length });
  }
  const htmlRegex = /<h([23])[^>]*>([\s\S]*?)<\/h[23]>/gi;
  while ((match = htmlRegex.exec(source)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text && text.toLowerCase() !== 'innehåll' && !headings.some(h => h.id === slugifyHeading(text))) headings.push({ id: slugifyHeading(text), text, level: Number(match[1]) });
  }
  return headings.slice(0, 12);
}

/** Sanitize and render content – supports both raw HTML and Markdown */
function renderContent(
  content: string,
  postTitle: string,
  otherPosts?: { title: string; slug: string }[],
  glossary?: { keyword: string; url: string; rel: string }[]
): string {
  let raw = isHtmlContent(content) ? content : renderBlogMarkdown(content);
  // Ta bort inledande rubrik som bara upprepar artikelns titel
  raw = stripDuplicateTitleHeading(raw, postTitle);
  raw = raw.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h[23]>/gi, (full, level, attrs, inner) => {
    if (/\sid=/.test(attrs)) return full;
    const text = inner.replace(/<[^>]+>/g, '').trim();
    return `<h${level}${attrs} id="${slugifyHeading(text)}">${inner}</h${level}>`;
  });

  // Apply glossary links first (affiliate keywords → links)
  if (glossary && glossary.length > 0) {
    // Sort by keyword length descending so longer keywords match first
    const sorted = [...glossary].sort((a, b) => b.keyword.length - a.keyword.length);
    const linked = new Set<string>();

    for (const entry of sorted) {
      if (linked.has(entry.keyword.toLowerCase())) continue;
      const escaped = entry.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match keyword NOT already inside a tag, link, or attribute
      const regex = new RegExp(`(?<![<\\/a-zA-Z"=])\\b(${escaped})\\b(?![^<]*>)(?![^<]*<\\/a>)`, 'i');
      if (regex.test(raw)) {
        raw = raw.replace(regex, `<a href="${entry.url}" target="_blank" rel="${entry.rel}" class="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"  title="${entry.keyword}">$1</a>`);
        linked.add(entry.keyword.toLowerCase());
      }
    }
  }

  // Auto internal linking: extract contextual keywords from titles/slugs and match in content
  if (otherPosts && otherPosts.length > 0) {
    const linked = new Set<string>();
    const stopWords = new Set(['guide', 'allt', 'bästa', 'enkla', 'denna', 'dessa', 'tips', 'från', 'till', 'eller', 'sverige', 'hemma', 'första', 'andra', 'igång', 'behöver', 'säker']);

    // Build keyword → post mapping from titles
    const keywordMap: { keyword: string; slug: string; title: string }[] = [];
    for (const other of otherPosts) {
      // Use the first part of the title (before –) as a keyword phrase
      const parts = other.title.split(/\s*[–—|]\s*/);
      if (parts[0]) {
        keywordMap.push({ keyword: parts[0].trim(), slug: other.slug, title: other.title });
      }
      // Readable slug as keyword (e.g. "kompostera hemma")
      const slugPhrase = other.slug.replace(/-/g, ' ');
      keywordMap.push({ keyword: slugPhrase, slug: other.slug, title: other.title });
      // Extract meaningful individual words (5+ chars) as fallback
      const words = other.title.toLowerCase().split(/[\s–—,.:]+/).filter(w => w.length >= 5 && !stopWords.has(w));
      for (const word of words) {
        keywordMap.push({ keyword: word, slug: other.slug, title: other.title });
      }
    }

    // Sort by keyword length descending (prefer longer, more specific matches)
    keywordMap.sort((a, b) => b.keyword.length - a.keyword.length);

    for (const entry of keywordMap) {
      if (linked.size >= 5) break;
      if (linked.has(entry.slug)) continue;

      const escaped = entry.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `(?<![<\\/a-zA-Z"=])\\b(${escaped})\\b(?![^<]*>)(?![^<]*<\\/a>)(?![^<]*<\\/h[1-6]>)`,
        'i'
      );
      if (regex.test(raw)) {
        raw = raw.replace(
          regex,
          `<a href="/blogg/${entry.slug}" class="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity" title="${entry.title.replace(/"/g, '&quot;')}">$1</a>`
        );
        linked.add(entry.slug);
      }
    }
  }

  // Rasbilder efter matchande h3-rubriker (t.ex. "### 1. Hedemora" → bild på Hedemora)
  raw = injectBreedFigures(raw);

  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ['video', 'source', 'picture', 'details', 'summary'],
    ADD_ATTR: ['loading', 'target', 'rel', 'title', 'id'],
    FORBID_TAGS: ['iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}

export default function GuideArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const [readingProgress, setReadingProgress] = useState(0);

  // Fetch current post
  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['blog-post', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
      if (error) throw error;
      // Fetch author name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', data.author_id)
        .single();
      return { ...data, author_name: profile?.display_name || 'Hönsgården' };
    },
    enabled: !!slug,
  });

  // Fetch all published posts for internal linking + related posts
  const { data: allPosts = [] } = useQuery({
    queryKey: ['all-published-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, cover_image_url, feature_image_url, category, tags, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch glossary for auto-linking keywords – only those selected for this post
  const postGlossaryIds: string[] = (post as any)?.glossary_ids || [];
  const { data: glossary = [] } = useQuery({
    queryKey: ['link-glossary', postGlossaryIds],
    queryFn: async () => {
      if (postGlossaryIds.length === 0) return [];
      const { data, error } = await supabase
        .from('link_glossary')
        .select('keyword, url, rel')
        .eq('is_active', true)
        .in('id', postGlossaryIds);
      if (error) throw error;
      return data as { keyword: string; url: string; rel: string }[];
    },
    enabled: !!post,
  });

  const toc = useMemo(() => post ? extractToc(post.content) : [], [post]);
  const readingMinutes = post?.reading_time_minutes || Math.max(1, Math.ceil((post?.word_count || post?.content?.replace(/<[^>]+>/g, '').split(/\s+/).length || 0) / 220));

  useEffect(() => {
    const updateProgress = () => {
      const article = document.querySelector('article');
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = Math.max(1, article.scrollHeight - window.innerHeight * 0.6);
      const read = Math.min(total, Math.max(0, -rect.top));
      setReadingProgress(Math.round((read / total) * 100));
    };
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [post?.id]);

  const renderedArticleHtml = useMemo(() => {
    if (!post) return '';
    return renderContent(
      post.content,
      post.title,
      allPosts.filter(p => p.slug !== slug).map(p => ({ title: p.title, slug: p.slug })),
      glossary
    );
  }, [post, allPosts, glossary, slug]);

  const [articleIntroHtml, articleRestHtml] = useMemo(() => {
    if (!renderedArticleHtml) return ['', ''];
    const matches = [...renderedArticleHtml.matchAll(/<h2\b/gi)];
    const splitAt = matches[1]?.index ?? matches[0]?.index ?? -1;
    return splitAt > 0
      ? [renderedArticleHtml.slice(0, splitAt), renderedArticleHtml.slice(splitAt)]
      : [renderedArticleHtml, ''];
  }, [renderedArticleHtml]);

  // SEO - full OG, Twitter, hreflang, JSON-LD with Article + FAQ + Product + BreadcrumbList
  React.useEffect(() => {
    if (!post) return;
    const BASE = 'https://honsgarden.se';
    const fullUrl = `${BASE}/blogg/${post.slug}`;
    const pageTitle = `${post.title} | Hönsgården`;
    const pageDesc = post.meta_description || post.excerpt || '';
    const featureImage = heroForPost(post);
    const imageUrl = featureImage.startsWith('http') ? featureImage : `${BASE}${featureImage}`;

    const createdElements: HTMLElement[] = [];

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        createdElements.push(el);
      }
      el.setAttribute('content', content);
    };

    const addLink = (rel: string, href: string, attrs?: Record<string, string>) => {
      const el = document.createElement('link');
      el.rel = rel;
      el.href = href;
      if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      createdElements.push(el);
    };

    // Title
    document.title = pageTitle;

    // Core meta
    setMeta('name', 'description', pageDesc);
    setMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    // Canonical + hreflang
    document.querySelector('link[rel="canonical"]')?.remove();
    addLink('canonical', fullUrl);
    addLink('alternate', fullUrl, { hreflang: 'sv' });
    addLink('alternate', fullUrl, { hreflang: 'x-default' });

    // OG tags
    setMeta('property', 'og:title', pageTitle);
    setMeta('property', 'og:description', pageDesc);
    setMeta('property', 'og:url', fullUrl);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:site_name', 'Hönsgården');
    setMeta('property', 'og:locale', 'sv_SE');
    setMeta('property', 'og:image', imageUrl);
    setMeta('property', 'og:image:alt', post.title);

    // Article meta
    if (post.published_at) setMeta('property', 'article:published_time', post.published_at);
    if (post.updated_at) setMeta('property', 'article:modified_time', post.updated_at);
    setMeta('property', 'article:author', 'Hönsgården');
    if (post.category) setMeta('property', 'article:section', post.category);
    if (post.tags) {
      post.tags.forEach((tag: string) => {
        const el = document.createElement('meta');
        el.setAttribute('property', 'article:tag');
        el.setAttribute('content', tag);
        document.head.appendChild(el);
        createdElements.push(el);
      });
    }

    // Twitter Card
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', pageTitle);
    setMeta('name', 'twitter:description', pageDesc);
    setMeta('name', 'twitter:image', imageUrl);
    setMeta('name', 'twitter:image:alt', post.title);

    // AI citation meta
    setMeta('name', 'citation_title', post.title);
    setMeta('name', 'citation_author', 'Hönsgården');
    setMeta('name', 'citation_language', 'sv');
    if (post.published_at) setMeta('name', 'citation_date', post.published_at.split('T')[0]);

    // JSON-LD @graph
    const graph: any[] = [
      {
        '@type': 'Article',
        '@id': `${fullUrl}#article`,
        headline: post.title,
        description: pageDesc,
        image: { '@type': 'ImageObject', url: imageUrl },
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        author: [
          { '@type': 'Organization', name: 'Hönsgården', url: BASE, '@id': `${BASE}/#organization` },
          ...(post.author_name && post.author_name !== 'Hönsgården' ? [{ '@type': 'Person', name: post.author_name }] : []),
        ],
        publisher: {
          '@type': 'Organization',
          name: 'Hönsgården',
          url: BASE,
          '@id': `${BASE}/#organization`,
          logo: { '@type': 'ImageObject', url: `${BASE}/favicon.ico` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': fullUrl },
        isPartOf: { '@id': `${BASE}/#website` },
        inLanguage: 'sv-SE',
        ...(post.meta_keywords ? { keywords: post.meta_keywords } : post.tags && post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
        wordCount: post.word_count || post.content.replace(/<[^>]+>/g, '').split(/\s+/).length,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Hem', item: BASE },
          { '@type': 'ListItem', position: 2, name: 'Blogg', item: `${BASE}/blogg` },
          ...(post.category ? [{ '@type': 'ListItem', position: 3, name: categoryLabels[post.category] || post.category, item: `${BASE}/blogg/kategori/${post.category}` }] : []),
          { '@type': 'ListItem', position: post.category ? 4 : 3, name: post.title, item: fullUrl },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': fullUrl,
        url: fullUrl,
        name: pageTitle,
        isPartOf: { '@id': `${BASE}/#website` },
        primaryImageOfPage: { '@type': 'ImageObject', url: imageUrl },
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        inLanguage: 'sv-SE',
      },
    ];

    // Extract FAQ pairs from HTML content
    const faqPairs: { q: string; a: string }[] = [];
    const faqRegex = /<(?:div|dt)[^>]*class="faq-q"[^>]*>([\s\S]*?)<\/(?:div|dt)>\s*<(?:div|dd)[^>]*class="faq-a"[^>]*>([\s\S]*?)<\/(?:div|dd)>/gi;
    let match;
    while ((match = faqRegex.exec(post.content)) !== null) {
      const q = match[1].replace(/<[^>]+>/g, '').trim();
      const a = match[2].replace(/<[^>]+>/g, '').trim();
      if (q && a) faqPairs.push({ q, a });
    }
    const detailsRegex = /<summary[^>]*>([\s\S]*?)<\/summary>\s*([\s\S]*?)(?=<\/details>)/gi;
    while ((match = detailsRegex.exec(post.content)) !== null) {
      const q = match[1].replace(/<[^>]+>/g, '').trim();
      const a = match[2].replace(/<[^>]+>/g, '').trim();
      if (q && a) faqPairs.push({ q, a });
    }

    if (faqPairs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: faqPairs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      });
    }

    // Extract HowTo schema from ordered lists in guide/nyborjare category
    if (post.category === 'guide' || post.category === 'nyborjare' || post.category === 'tips') {
      // Look for <ol> with <li> items as steps
      const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
      let olMatch;
      const steps: { name: string; text: string }[] = [];
      while ((olMatch = olRegex.exec(post.content)) !== null) {
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch;
        while ((liMatch = liRegex.exec(olMatch[1])) !== null) {
          const text = liMatch[1].replace(/<[^>]+>/g, '').trim();
          if (text.length > 10) {
            const name = text.length > 80 ? text.substring(0, 80) + '…' : text;
            steps.push({ name, text });
          }
        }
      }
      // Fallback: look for h2/h3 + paragraph patterns as steps
      if (steps.length < 2) {
        const stepRegex = /<h[23][^>]*>(?:Steg\s*\d+[:\.\s]*|(\d+)[.\s]+)?([\s\S]*?)<\/h[23]>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
        let stepMatch;
        while ((stepMatch = stepRegex.exec(post.content)) !== null) {
          const name = (stepMatch[2] || '').replace(/<[^>]+>/g, '').trim();
          const text = (stepMatch[3] || '').replace(/<[^>]+>/g, '').trim();
          if (name && text) steps.push({ name, text });
        }
      }
      if (steps.length >= 2) {
        graph.push({
          '@type': 'HowTo',
          name: post.title,
          description: pageDesc,
          image: imageUrl,
          step: steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        });
      }
    }

    // Extract Product schema from product cards/tables in content
    const productRegex = /<(?:h4|span)[^>]*class="(?:product-card-title|pct-product-name)"[^>]*>([\s\S]*?)<\/(?:h4|span)>/gi;
    const priceRegex = /<span[^>]*class="(?:product-card-price|pct-price)"[^>]*>([\s\S]*?)<\/span>/gi;
    const productNames: string[] = [];
    const productPrices: string[] = [];
    while ((match = productRegex.exec(post.content)) !== null) {
      productNames.push(match[1].replace(/<[^>]+>/g, '').trim());
    }
    while ((match = priceRegex.exec(post.content)) !== null) {
      productPrices.push(match[1].replace(/<[^>]+>/g, '').trim());
    }
    if (productNames.length > 0) {
      const itemList = {
        '@type': 'ItemList',
        name: `Produkter i ${post.title}`,
        itemListElement: productNames.map((name, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name,
            ...(productPrices[i] ? {
              offers: {
                '@type': 'Offer',
                priceCurrency: 'SEK',
                price: productPrices[i].replace(/[^\d,]/g, '').replace(',', '.'),
                availability: 'https://schema.org/InStock',
              },
            } : {}),
          },
        })),
      };
      graph.push(itemList);
    }

    const jsonLd = { '@context': 'https://schema.org', '@graph': graph };
    let script = document.getElementById('json-ld-article') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'json-ld-article';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
      createdElements.push(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      document.title = 'Hönsgården';
      createdElements.forEach(el => el.remove());
      document.getElementById('json-ld-article')?.remove();
    };
  }, [post]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 px-4">
        <BookOpen className="h-10 w-10 text-muted-foreground/30" />
        <h1 className="font-serif text-xl text-foreground">Artikeln hittades inte</h1>
        <Link to="/blogg"><Button variant="outline" className="rounded-xl"><ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka till bloggen</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <BlogConversionPopup />
      <div className="fixed inset-x-0 top-0 z-50 h-1 bg-border/40" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${readingProgress}%` }} />
      </div>
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/blogg" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Blogg
          </Link>
          <Link to="/login">
            <Button size="sm" className="rounded-xl text-xs gap-1">
              <Egg className="h-3 w-3" /> Kom igång
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:py-12 lg:grid-cols-[minmax(0,720px)_240px]">
      <article className="w-full max-w-[720px]">
        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {post.category && (
            <Badge variant="secondary" className="text-[10px]">
              {categoryLabels[post.category] || post.category}
            </Badge>
          )}
          {post.published_at && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {new Date(post.published_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {readingMinutes} min läsning
          </span>
          {post.author_name && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">✍️</span>
              av <span className="font-medium text-foreground/80">{post.author_name}</span>
            </span>
          )}
          {post.updated_at && post.published_at && post.updated_at > post.published_at && (
            <span className="text-[10px] text-muted-foreground italic">
              (Uppdaterad {new Date(post.updated_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' })})
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-foreground leading-tight mb-4">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">{post.excerpt}</p>
        )}

        {/* Hero – egen omslagsbild eller kategori-fallback */}
        <img
          src={heroForPost(post)}
          alt={post.title}
          className="w-full rounded-2xl aspect-video object-cover mb-8"
          loading="lazy"
        />

        {/* Affiliate-disclosure – synligt över första CTA/annonslänk */}
        <p className="text-xs text-muted-foreground italic mb-4 mt-2">
          Vissa länkar i denna artikel är annonslänkar. Vi kan få ersättning om du handlar via dem, utan extra kostnad för dig.
        </p>

        {/* Content with auto internal links */}
        <div
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: articleIntroHtml }}
          onMouseDownCapture={(e) => handleProseAffiliateClick(e, post.slug)}
          onAuxClickCapture={(e) => handleProseAffiliateClick(e, post.slug)}
          onContextMenuCapture={(e) => handleProseAffiliateClick(e, post.slug)}
        />

        {!isAuthenticated && <ArticleCta category={post.category} variant="inline" />}

        {articleRestHtml && (
          <div
            className="prose-custom"
            dangerouslySetInnerHTML={{ __html: articleRestHtml }}
            onMouseDownCapture={(e) => handleProseAffiliateClick(e, post.slug)}
            onAuxClickCapture={(e) => handleProseAffiliateClick(e, post.slug)}
            onContextMenuCapture={(e) => handleProseAffiliateClick(e, post.slug)}
          />
        )}

        {/* Kontextuell produktbox – matchar mot hela artikeltexten */}
        <AffiliateProductBox
          slug={post.slug}
          title={post.title}
          content={`${post.excerpt || ''} ${articleIntroHtml || ''} ${articleRestHtml || ''}`}
        />

        {/* Rekommenderade produkter – bara på köp-intent-artiklar med tillräckligt många matchningar */}
        <RecommendedProducts
          slug={post.slug}
          title={post.title}
          content={`${post.excerpt || ''} ${articleIntroHtml || ''} ${articleRestHtml || ''}`}
          category={post.category}
          tags={post.tags}
          excerpt={post.excerpt}
        />

        {/* Roterande Bonden.se-banner – 25% av artiklarna får ingen, resten fördelas jämnt */}
        <AffiliateBannerRotator slug={post.slug} />

        {/* Tags + Share */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center justify-between gap-4 flex-wrap mt-8 pt-6 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              {post.tags.map(tag => (
                <Link key={tag} to={`/blogg/tagg/${encodeURIComponent(tag)}`}>
                  <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent">#{tag}</Badge>
                </Link>
              ))}
            </div>
            <ShareButtons
              url={`https://honsgarden.se/blogg/${post.slug}`}
              title={post.title}
              description={post.excerpt || ''}
            />
          </div>
        )}

        {/* Comments */}
        <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-8" />}>
          <BlogComments postId={post.id} />
        </Suspense>

        {/* Author box (E-E-A-T) */}
        <div className="mt-12 rounded-2xl border border-border/50 bg-card/70 p-5 sm:p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-xl shrink-0" aria-hidden="true">✍️</div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-base text-foreground">
              {post.author_name && post.author_name !== 'Hönsgården' ? post.author_name : 'Redaktionen på Hönsgården'}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Vi skriver praktiska guider om hönsskötsel, ägg, foder och hållbart liv på landet — alltid baserat på egen erfarenhet och svenska förhållanden.
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-2">
              {post.published_at && (
                <>Publicerad {new Date(post.published_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</>
              )}
              {post.updated_at && post.published_at && post.updated_at > post.published_at && (
                <> · Uppdaterad {new Date(post.updated_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</>
              )}
            </p>
          </div>
        </div>

        {/* Final CTA (logged-out only) */}
        {!isAuthenticated && (
          <div className="mt-8">
            <ArticleCta category={post.category} variant="final" />
          </div>
        )}

        {/* Newsletter signup */}
        <div className="mt-8">
          <NewsletterSignup
            title="Hönstips i inkorgen — en gång i månaden"
            description="Säsongsråd, nya guider och smarta tips för dig med höns. Inget spam, avsluta när du vill."
          />
        </div>

        {/* Related posts */}
        {(() => {
          const otherPosts = allPosts.filter(p => p.slug !== slug);
          if (otherPosts.length === 0) return null;

          // Score relevance: shared tags + same category
          const postTags = new Set(post.tags || []);
          const scored = otherPosts.map(p => {
            let score = 0;
            if (p.category === post.category) score += 2;
            (p.tags || []).forEach(t => { if (postTags.has(t)) score += 1; });
            return { ...p, score };
          });
          scored.sort((a, b) => b.score - a.score || (new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()));
          const related = scored.slice(0, 3);

          return (
            <div className="mt-14 pt-8 border-t border-border/50">
              <h2 className="font-serif text-xl text-foreground mb-5 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Fler artiklar
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {related.map(r => (
                  <Link key={r.id} to={`/blogg/${r.slug}`} className="group">
                    <div className="rounded-xl border border-border/50 overflow-hidden hover:shadow-md transition-all duration-300 h-full bg-card">
                      {(r.feature_image_url || r.cover_image_url) ? (
                        <div className="aspect-video overflow-hidden">
                          <img src={r.feature_image_url || r.cover_image_url || ''} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-primary/8 to-accent/8 flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-primary/30" />
                        </div>
                      )}
                      <div className="p-3 space-y-1">
                        <h3 className="font-serif text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                          {r.title}
                        </h3>
                        {r.excerpt && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{r.excerpt}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}
      </article>


      {(toc.length > 0 || !isAuthenticated) && (
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            {toc.length > 0 && (
              <nav className="rounded-2xl border border-border/50 bg-card/70 p-4" aria-label="Innehållsförteckning">
                <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">Innehåll</p>
                <ol className="space-y-2 text-sm">
                  {toc.map(item => (
                    <li key={item.id} className={item.level === 3 ? 'pl-3' : ''}>
                      <a href={`#${item.id}`} className="text-muted-foreground transition-colors hover:text-primary">{item.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            {!isAuthenticated && <StickySidebarCta />}
          </div>
        </aside>
      )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Hönsgården</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">Startsidan</Link>
            <Link to="/blogg" className="hover:text-foreground transition-colors">Blogg</Link>
            <Link to="/om-oss" className="hover:text-foreground transition-colors">Om oss</Link>
            <Link to="/verktyg/aggkalkylator" className="hover:text-foreground transition-colors">Äggkalkylator</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Villkor</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
