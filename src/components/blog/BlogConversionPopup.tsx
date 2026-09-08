import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isNativePlatform } from '@/lib/nativePlatform';
import { trackEvent } from '@/lib/analytics';
import { DIGITAL_PRODUCT_CATALOG } from '@/lib/digitalProducts';
import { selectBlogOffer, type BlogOffer } from '@/lib/blogOffers';

const SEEN_KEY = 'hg-blog-offer-v2';
const SESSION_KEY = 'hg-blog-offer-session-v2';
const LAST_VARIANT_KEY = 'hg-blog-offer-last-variant-v2';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN_READING_MS = 15_000;
let memoryShownAt = 0;

function recentlyShown() {
  if (memoryShownAt > 0 && Date.now() - memoryShownAt < COOLDOWN_MS) return true;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    const last = Number(localStorage.getItem(SEEN_KEY));
    return last > 0 && Date.now() - last < COOLDOWN_MS;
  } catch { return false; }
}

export default function BlogConversionPopup({ articleSlug, category }: { articleSlug: string; category?: string | null }) {
  const { loading, isAuthenticated } = useAuth();
  const eligible = !loading && !isAuthenticated && !isNativePlatform();
  const [offer, setOffer] = useState<BlogOffer | null>(null);
  const titleId = useId();

  useEffect(() => {
    setOffer(null);
    if (!eligible || recentlyShown()) return;
    const started = Date.now();
    let fired = false;
    const show = () => {
      if (fired || recentlyShown() || document.hidden || Date.now() - started < MIN_READING_MS) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-cookie-consent-banner]')) return;
      fired = true;
      let previous: string | null = null;
      try { previous = localStorage.getItem(LAST_VARIANT_KEY); } catch { /* optional */ }
      const next = selectBlogOffer(articleSlug, category, previous);
      memoryShownAt = Date.now();
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
        localStorage.setItem(SEEN_KEY, String(memoryShownAt));
        localStorage.setItem(LAST_VARIANT_KEY, next.id);
      } catch { /* The in-memory cap still prevents repeat offers. */ }
      setOffer(next);
      trackEvent('Blog Offer Shown', { product: next.product, variant: next.id });
      cleanup();
    };
    const onScroll = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      if (range > 0 && window.scrollY / range >= 0.45) show();
    };
    const onExit = (event: MouseEvent) => { if (event.clientY <= 0) show(); };
    const onVisible = () => { if (Date.now() - started >= 45_000) show(); else onScroll(); };
    const timer = window.setTimeout(show, 45_000);
    const readyTimer = window.setTimeout(onScroll, MIN_READING_MS);
    function cleanup() {
      window.clearTimeout(timer);
      window.clearTimeout(readyTimer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseleave', onExit);
      document.removeEventListener('visibilitychange', onVisible);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseleave', onExit);
    document.addEventListener('visibilitychange', onVisible);
    return cleanup;
  }, [eligible, articleSlug, category]);

  useEffect(() => {
    if (!offer || !eligible) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOffer(null);
        trackEvent('Blog Offer Clicked', { product: offer.product, variant: offer.id, action: 'dismiss' });
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [offer, eligible]);

  if (!eligible || !offer) return null;
  const product = DIGITAL_PRODUCT_CATALOG[offer.product];
  const act = (action: 'product' | 'sample' | 'dismiss') => {
    trackEvent('Blog Offer Clicked', { product: offer.product, variant: offer.id, action });
    setOffer(null);
  };
  return (
    <aside role="dialog" aria-modal="false" aria-labelledby={titleId} data-blog-product-popup={offer.id}
      className="fixed bottom-3 left-3 right-3 z-50 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-primary/20 bg-card p-5 shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[410px] sm:p-6">
      <button type="button" onClick={() => act('dismiss')} aria-label="Stäng erbjudandet"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <X className="h-5 w-5" aria-hidden />
      </button>
      <p className="pr-8 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Hönsgårdens butik · Digital PDF</p>
      <div className="mt-4 flex items-start gap-4">
        <img src={product.cover} alt={`${product.title} - omslag`} width={76} height={108} className="w-16 shrink-0 rounded border border-border shadow-sm sm:w-[76px]" />
        <div className="min-w-0">
          <h2 id={titleId} className="font-serif text-xl leading-tight text-foreground">{offer.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{offer.body}</p>
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{product.price} kr inkl. moms · engångsköp</p>
      <p className="mt-1 text-xs text-muted-foreground">{product.pages} sidor · ifyllbar och utskrivbar</p>
      <Link to={`/guider/${product.slug}`} onClick={() => act('product')} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
        Se guiden - {product.price} kr <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
        <a href={product.sample} target="_blank" rel="noopener noreferrer" onClick={() => act('sample')} className="inline-flex min-h-11 items-center text-sm text-primary underline">Gratis smakprov · {product.samplePages} sidor</a>
        <button type="button" onClick={() => act('dismiss')} className="min-h-11 px-2 text-xs text-muted-foreground underline">Fortsätt läsa</button>
      </div>
    </aside>
  );
}
