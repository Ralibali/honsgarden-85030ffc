import { Check } from 'lucide-react';
const freeFeatures = ['Äggloggning', 'Upp till 10 hönor', 'Hälsologg', 'Grundstatistik', 'Dagbok', 'Mobilvänlig PWA'];
const plusFeatures = ['Allt i Gratis', 'Obegränsat antal hönor', 'Agda AI', 'Avancerad statistik', 'Foder och ekonomi', 'Smarta rapporter', 'Påminnelser', 'Kläckningsstöd'];


export default function PublicPricing() { return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <PricingCard plan="free" title="Gratis" price="0 kr" desc="För att komma igång ordentligt" features={freeFeatures} cta="Skapa konto gratis" />
              <PricingCard plan="plus_monthly" title="Plus – Månad" price="39 kr/mån" desc="För mer statistik och smartare stöd" features={plusFeatures} cta="Prova 7 dagar gratis" />
              <PricingCard plan="plus_annual" highlighted title="Plus – År" price="299 kr/år" desc="Bästa värdet – ca 25 kr/mån" features={plusFeatures} cta="Prova 7 dagar – välj år" />
            </div>

); }
function PricingCard({ plan, title, price, desc, features, cta, highlighted = false }: { plan: 'free' | 'plus_monthly' | 'plus_annual'; title: string; price: string; desc: string; features: string[]; cta: string; highlighted?: boolean }) {
  return (
    <article
      className={`hg-tile hg-tile--hover p-6 sm:p-8 flex flex-col ${highlighted ? 'hg-tile--deep' : ''}`}
    >
      {highlighted && (
        <span className="hg-chip absolute -top-3 left-6 text-[11px] font-semibold" style={{ background: '#f4f1e6', color: '#22392b' }}>
          Spara 169 kr
        </span>
      )}
      <h3 className="text-xl mb-1">{title}</h3>
      <p className="text-sm mb-6" style={{ color: highlighted ? 'rgba(255,255,255,.8)' : 'var(--hg-ink-soft)' }}>{desc}</p>
      <p className="text-4xl mb-6" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>{price}</p>
      <ul className="space-y-2.5 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-sm">
            <Check className="h-4 w-4 shrink-0" style={{ color: highlighted ? '#b9d0b0' : 'var(--hg-sage-deep)' }} />
            {f}
          </li>
        ))}
      </ul>
      <a
        href={`/login?mode=register&plan=${plan}${plan === 'free' ? '' : '&trial=7d'}`}
        className={`mt-auto inline-flex items-center justify-center h-12 min-h-[48px] px-6 text-base font-medium rounded-full ${highlighted ? '' : 'hg-cta-ghost'}`}
        style={highlighted ? { background: '#f4f1e6', color: '#22392b' } : undefined}
      >
        {cta}
      </a>
    </article>
  );
}

