import { useState } from 'react';
import { ExternalLink, Sprout } from 'lucide-react';
import { pickBannerForSlug } from '@/data/affiliateProducts';
import { AffiliateLink } from '@/components/AffiliateLink';

interface Props {
  /** Slugen för artikeln – avgör vilken banner som visas (deterministiskt, för jämn rotation). */
  slug: string;
}

/**
 * Roterar Bonden.se-bannrar deterministiskt per slug.
 * 25% av artiklarna får INGEN banner (för att inte överbelasta).
 * Resterande ~75% fördelas jämnt över de tre bannerformaten.
 * Visar produktkort som fallback om bilden inte laddas.
 */
export function AffiliateBannerRotator({ slug }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const banner = pickBannerForSlug(slug);
  if (!banner) return null;

  const trackingProps = {
    bannerId: banner.id,
    advertiser: 'bonden',
    source: 'banner' as const,
    slug,
  };

  const TextCard = (
    <AffiliateLink
      href={banner.href}
      {...trackingProps}
      aria-label={banner.alt}
      className="group flex items-center gap-4 w-full max-w-md p-4 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Sprout className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Annons</p>
        <p className="text-sm font-semibold text-foreground">Bonden.se – allt för gården</p>
        <p className="text-xs text-muted-foreground">Foder, utrustning &amp; tillbehör</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </AffiliateLink>
  );

  const ImageLink = (
    <AffiliateLink href={banner.href} {...trackingProps} aria-label={banner.alt}>
      <img
        src={banner.imgSrc}
        alt={banner.alt}
        width={banner.width}
        height={banner.height}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="max-w-full h-auto rounded-md border border-border/40"
      />
    </AffiliateLink>
  );

  return (
    <div className="my-10 flex justify-center">
      {/* Mobil: alltid textkort */}
      <div className="md:hidden w-full flex justify-center">{TextCard}</div>

      {/* Desktop: bild med fallback */}
      <div className="hidden md:flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Annons</span>
        {imgFailed ? TextCard : ImageLink}
      </div>
    </div>
  );
}

export default AffiliateBannerRotator;
