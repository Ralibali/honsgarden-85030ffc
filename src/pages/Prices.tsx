import LandingNavbar from '@/components/LandingNavbar';
import LandingFooter from '@/components/LandingFooter';
import PublicPricing from '@/components/PublicPricing';
import { useSeo } from '@/hooks/useSeo';
import '@/honsgarden-home-v3.css';

export default function Prices() {
  useSeo({ title: 'Priser – Gratis och Plus | Hönsgården', description: 'Börja gratis. Plus kostar 39 kr/mån eller 299 kr/år. Nya konton får prova Plus i 7 dagar utan kortuppgifter.', path: '/priser' });
  return <div className="hg-home-v3 min-h-screen"><LandingNavbar /><main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-5 pb-16 pt-28"><h1 className="font-serif text-4xl mb-4">Välj det som passar din hönsgård</h1><p className="text-muted-foreground mb-12">Börja gratis. Nya konton får 7 dagar med Plus utan kortuppgifter. Du väljer själv om du vill köpa Plus efter provperioden.</p><section aria-labelledby="plans-heading"><h2 id="plans-heading" className="sr-only">Jämför planer</h2><PublicPricing /></section><section className="mt-12 max-w-2xl space-y-5"><h2 className="text-2xl font-serif">Bra att veta</h2><p>Alla priser är inklusive moms. Årsplanen kostar 299 kr per år, jämfört med 468 kr för tolv månadsbetalningar.</p><p>Efter provperioden kan du fortsätta med Gratis. Ditt val här startar ingen betalning.</p></section></main><LandingFooter /></div>;
}
