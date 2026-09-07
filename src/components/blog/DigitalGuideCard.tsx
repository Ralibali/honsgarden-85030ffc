import { Link } from 'react-router-dom';
import { isNativePlatform } from '@/lib/nativePlatform';
import { trackEvent } from '@/lib/analytics';
import { GUIDE_COVER_PATH, GUIDE_SAMPLE_URL } from '@/lib/digitalGuide';
import { DIGITAL_GUIDE_COPY, DIGITAL_GUIDE_PATH } from '@/lib/digitalGuidePlacements.mjs';

type Audience = 'beginner' | 'breed';
type Placement = 'blog_index' | 'blog_article' | 'beginner_guide' | 'breed_guide';

export default function DigitalGuideCard({ audience = 'beginner', placement }: {
  audience?: Audience;
  placement: Placement;
}) {
  if (isNativePlatform()) return null;
  const copy = DIGITAL_GUIDE_COPY[audience];
  const track = (action: 'product' | 'sample') => trackEvent('Guide CTA Clicked', { placement, audience, action });

  return (
    <aside data-digital-guide={audience} aria-label="Hönsgårdens PDF-guide" className="my-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <div className="flex items-start gap-4 sm:gap-6">
        <img src={GUIDE_COVER_PATH} alt="Omslaget till Mina första höns" width={120} height={170} loading="lazy" className="h-auto w-20 shrink-0 rounded border border-border shadow-sm sm:w-28" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vår PDF-guide · 24 sidor</p>
          <h2 className="mt-2 font-serif text-xl text-foreground sm:text-2xl">{copy.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-foreground">199 kr inkl. moms · engångsköp · ifyllbar och utskrivbar PDF</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link to={DIGITAL_GUIDE_PATH} onClick={() => track('product')} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          Se guiden – 199 kr
        </Link>
        <a href={GUIDE_SAMPLE_URL} target="_blank" rel="noopener noreferrer" onClick={() => track('sample')} className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary underline">
          Gratis smakprov · 4 sidor
        </a>
      </div>
    </aside>
  );
}
