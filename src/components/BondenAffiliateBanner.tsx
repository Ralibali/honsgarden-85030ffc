import { useState } from 'react';
import { ExternalLink, Sprout } from 'lucide-react';

/**
 * Affiliate-banner för Bonden.se via Adtraction.
 * - Desktop (md+): 160x600 skyscraper-bild
 * - Mobil: kompakt textkort (skyscraper fungerar dåligt på små skärmar)
 * - Fallback om bilden inte laddas: textkort på alla skärmar
 */
export function BondenAffiliateBanner() {
  const [imgFailed, setImgFailed] = useState(false);
  const href = 'https://pin.bonden.se/t/t?a=1960530789&as=2056181186&t=2&tk=1';
  const imgSrc = 'https://track.adtraction.com/t/t?a=1960530789&as=2056181186&t=1&tk=1&i=1';

  const TextCard = (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      aria-label="Annons från Bonden.se"
      className="group flex items-center gap-4 w-full max-w-md p-4 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/40 hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Sprout className="h-6 w-6 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Annons</p>
        <p className="text-sm font-semibold text-foreground">Bonden.se – allt för gården</p>
        <p className="text-xs text-muted-foreground">Foder, utrustning &amp; tillbehör för hönsägare</p>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </a>
  );

  return (
    <div className="my-10 flex justify-center">
      {/* Mobil: alltid textkort */}
      <div className="md:hidden w-full flex justify-center">{TextCard}</div>

      {/* Desktop: bild, faller tillbaka till textkort vid fel */}
      <div className="hidden md:flex justify-center">
        {imgFailed ? (
          TextCard
        ) : (
          <a
            href={href}
            target="_blank"
            rel="sponsored noopener noreferrer"
            aria-label="Annons från Bonden.se"
          >
            <img
              src={imgSrc}
              alt="Bonden.se – annons"
              width={160}
              height={600}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="max-w-full h-auto rounded-md"
            />
          </a>
        )}
      </div>
    </div>
  );
}

export default BondenAffiliateBanner;
