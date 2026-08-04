import React from 'react';
import { Bird } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import NewsletterSignup from '@/components/NewsletterSignup';
import { brandName } from '@/lib/brand';

interface FooterLink {
  labelKey: string;
  href: string;
  external?: boolean;
}

const columns: { titleKey: string; links: FooterLink[] }[] = [
  {
    titleKey: 'columns.product',
    links: [
      { labelKey: 'links.all_features', href: '/#funktioner' },
      { labelKey: 'links.pricing', href: '/#priser' },
      { labelKey: 'links.app_for_owners', href: '/app-for-honsagare' },
      { labelKey: 'links.digital_egg_log', href: '/agglogg' },
      { labelKey: 'links.chicken_calendar', href: '/honskalender' },
      { labelKey: 'links.feed_cost', href: '/foderkostnad-hons' },
      { labelKey: 'links.hatching_calendar', href: '/klackningskalender' },
      { labelKey: 'links.sell_eggs_agda', href: '/salja-agg' },
    ],
  },
  {
    titleKey: 'columns.guides',
    links: [
      { labelKey: 'links.egg_calculator', href: '/verktyg/aggkalkylator' },
      { labelKey: 'links.starting_chickens', href: '/borja-med-hons' },
      { labelKey: 'links.chicken_egg_guides', href: '/blogg' },
      { labelKey: 'links.how_many_eggs', href: '/blogg/hur-manga-agg-lagger-en-hona' },
      { labelKey: 'links.beginner_guide', href: '/blogg/hobbyhons-nyborjarguide' },
    ],
  },
  {
    titleKey: 'columns.in_app',
    links: [
      { labelKey: 'links.dashboard', href: '/app' },
      { labelKey: 'links.agda_shop', href: '/app/egg-sales' },
      { labelKey: 'links.community', href: '/app/community' },
      { labelKey: 'links.weather', href: '/app/weather' },
      { labelKey: 'links.feedback', href: '/app/feedback' },
      { labelKey: 'links.premium', href: '/app/premium' },
    ],
  },
  {
    titleKey: 'columns.support',
    links: [
      { labelKey: 'links.help', href: 'mailto:info@auroramedia.se' },
      { labelKey: 'links.contact', href: 'mailto:info@auroramedia.se' },
      { labelKey: 'links.about', href: '/om-oss' },
      { labelKey: 'links.privacy', href: '/integritet' },
      { labelKey: 'links.terms', href: '/terms' },
    ],
  },
];

export default function LandingFooter() {
  const { t } = useTranslation('footer');
  const brand = brandName();
  return (
    <footer className="relative z-10 bg-[#1c2e1a] text-[#d4e8ce]">
      <div className="container max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bird className="h-5 w-5 text-[#7cb36b]" aria-hidden="true" />
              <span className="font-serif text-lg text-white">{brand}</span>
            </div>
            <p className="text-sm text-[#a8c9a0] leading-relaxed mb-4">
              {t('tagline')}
            </p>
            <p className="text-xs text-[#a8c9a0]">{t('copyright', { year: new Date().getFullYear(), brand })}</p>
          </div>

          {columns.map((col) => {
            const title = t(col.titleKey);
            return (
              <div key={col.titleKey}>
                <h3 className="font-serif text-sm text-[#e8f5e4] mb-3">{title}</h3>
                <nav className="space-y-2" aria-label={title}>
                  {col.links.map((link) => (
                    <a
                      key={link.labelKey}
                      href={link.href}
                      className="block text-sm text-[#a8c9a0] hover:text-white transition-colors"
                      {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {t(link.labelKey)}
                    </a>
                  ))}
                </nav>
              </div>
            );
          })}
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
