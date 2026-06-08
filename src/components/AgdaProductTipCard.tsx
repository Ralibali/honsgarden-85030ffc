import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { trackAffiliateClick } from '@/lib/affiliateTracking';
import { scoreProducts, pickDailyFromTopN } from '@/lib/agdaProductScoring';
import { useCatalog, priceToNumber } from '@/hooks/useAffiliateProducts';
import { useFarmWeather } from '@/hooks/useFarmWeather';

const SNOOZE_KEY = 'hg_agda_tip_snooze_until';
const SNOOZE_DAYS = 7;

function isSnoozed(): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY));
    return !!until && until > Date.now();
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {}
}

export default function AgdaProductTipCard() {
  const { user } = useAuth();
  const isPlus = user?.subscription_status === 'premium' || (user as any)?.is_premium;
  const [hidden, setHidden] = useState(() => isSnoozed());

  const active = !isPlus && !hidden;

  const { data: hens = [] } = useQuery({
    queryKey: ['hens'],
    queryFn: () => api.getHens(),
    staleTime: 5 * 60_000,
    enabled: active,
  });
  const { data: eggs = [] } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
    staleTime: 5 * 60_000,
    enabled: active,
  });
  const { data: weather = null } = useFarmWeather(active);
  const catalog = useCatalog(active);

  const pick = useMemo(() => {
    if (!active) return null;
    const scored = scoreProducts({ hens: hens as any[], eggs: eggs as any[], weather }, catalog);
    return pickDailyFromTopN(scored, 5);
  }, [active, hens, eggs, weather, catalog]);

  if (!active || !pick) return null;
  const { product, reason } = pick;

  const handleClick = () => {
    trackAffiliateClick({
      product_id: product.id,
      advertiser: product.advertiser,
      source: 'app_widget',
      href: product.trackingUrl,
    });
  };

  const handleHide = () => {
    snooze();
    setHidden(true);
  };

  return (
    <Card className="max-w-4xl mx-auto border-accent/30 bg-gradient-to-br from-accent/8 via-card to-primary/5 shadow-sm relative overflow-hidden">
      <button
        type="button"
        onClick={handleHide}
        aria-label="Dölj i en vecka"
        className="absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition"
      >
        <X className="h-4 w-4" />
      </button>

      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <p className="font-serif text-base text-foreground">Agda tipsar</p>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 ml-auto">
            Annonslänk
          </span>
        </div>

        <div className="flex items-center gap-4">
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-lg bg-background/60 shrink-0"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.dataset.fallback !== '1') {
                img.dataset.fallback = '1';
                img.src = '/placeholder.svg';
              }
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm sm:text-base leading-snug line-clamp-2">
              {product.name}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {product.price}
              {product.priceOriginal && product.priceOriginal > (priceToNumber(product.price) ?? 0) && (
                <span className="ml-1.5 line-through text-muted-foreground/60">
                  {product.priceOriginal.toLocaleString('sv-SE')} kr
                </span>
              )}
              {' · '}
              {product.advertiser === 'p-lindberg' ? 'P. Lindberg' : 'Bonden.se'}
            </p>
            <a
              href={product.trackingUrl}
              target="_blank"
              rel="sponsored nofollow noopener"
              onClick={handleClick}
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary font-medium hover:underline"
            >
              Se hos annonsör <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground italic mt-3 leading-relaxed">
          {reason}
        </p>

        <p className="text-[11px] text-muted-foreground/70 mt-1.5 leading-relaxed">
          Vi får en liten provision om du köper – det kostar dig inget extra och hjälper oss
          hålla Hönsgården gratis.
        </p>
      </CardContent>
    </Card>
  );
}
