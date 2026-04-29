import React from 'react';
import { Bird } from 'lucide-react';
import NewsletterSignup from '@/components/NewsletterSignup';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Produkt',
    links: [
      { label: 'Allt Hönsgården erbjuder', href: '/#funktioner' },
      { label: 'Priser', href: '/#priser' },
      { label: 'App för hönsägare', href: '/app-for-honsagare' },
      { label: 'Digital ägglogg', href: '/agglogg' },
      { label: 'Hönskalender', href: '/honskalender' },
      { label: 'Foderkostnad för höns', href: '/foderkostnad-hons' },
      { label: 'Kläckningskalender', href: '/klackningskalender' },
      { label: 'Sälj ägg med Agda', href: '/salja-agg' },
    ],
  },
  {
    title: 'Guider & verktyg',
    links: [
      { label: 'Äggkalkylator', href: '/verktyg/aggkalkylator' },
      { label: 'Börja med höns', href: '/borja-med-hons' },
      { label: 'Höns & ägg-guider', href: '/blogg' },
      { label: 'Hur många ägg lägger en höna?', href: '/blogg/hur-manga-agg-lagger-en-hona' },
      { label: 'Nybörjarguide – skaffa höns', href: '/blogg/hobbyhons-nyborjarguide' },
    ],
  },
  {
    title: 'I appen',
    links: [
      { label: 'Dashboard', href: '/app' },
      { label: 'Agdas äggbod', href: '/app/egg-sales' },
      { label: 'Community', href: '/app/community' },
      { label: 'Väder', href: '/app/weather' },
      { label: 'Feedback', href: '/app/feedback' },
      { label: 'Premium', href: '/app/premium' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Hjälp', href: 'mailto:info@auroramedia.se' },
      { label: 'Kontakt', href: 'mailto:info@auroramedia.se' },
      { label: 'Om Hönsgården', href: '/om-oss' },
      { label: 'Integritetspolicy', href: '/terms' },
      { label: 'Villkor', href: '/terms' },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="relative z-10 bg-[#1c2e1a] text-white/80">
      <div className="container max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bird className="h-5 w-5 text-[#7cb36b]" aria-hidden="true" />
              <span className="font-serif text-lg text-white">Hönsgården</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-4">
              Svensk app för hönsägare som samlar ägglogg, flock, statistik, foderkostnad, kalender, väder, community, AI-stöd och Agdas äggbod för lokal äggförsäljning.
            </p>
            <p className="text-xs text-white/60">© {new Date().getFullYear()} Hönsgården</p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-serif text-sm text-white mb-3">{col.title}</h3>
              <nav className="space-y-2">
                {col.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="block text-sm text-white/60 hover:text-white transition-colors"
                    {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-white/10">
          <div className="max-w-md">
            <NewsletterSignup variant="inline" />
          </div>
        </div>
      </div>
    </footer>
  );
}
