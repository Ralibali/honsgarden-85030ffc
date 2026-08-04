import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSeo } from '@/hooks/useSeo';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Egg, Mail, MapPin, Shield, Heart, ArrowRight, Users, Award, BarChart3, ReceiptText, Bot, Check } from 'lucide-react';
import VisitorWelcomePopup from '@/components/VisitorWelcomePopup';
import { brandName, isInternationalDomain } from '@/lib/brand';

const valueIcons = [Heart, BarChart3, ReceiptText, Users, Bot, Shield];

export default function About() {
  const { t, i18n } = useTranslation('about');
  const brand = brandName();
  const intl = isInternationalDomain();
  const lang = intl ? (i18n.language?.startsWith('en') ? 'en-US' : 'sv-SE') : 'sv-SE';

  useSeo({
    title: t('seo.title'),
    description: t('seo.description'),
    path: '/om-oss',
    ogImage: 'https://honsgarden.se/blog-images/hens-garden.jpg',
    jsonLd: [
      {
        '@type': 'AboutPage',
        '@id': 'https://honsgarden.se/om-oss',
        name: t('seo.title'),
        description: t('seo.description'),
        url: 'https://honsgarden.se/om-oss',
        isPartOf: { '@id': 'https://honsgarden.se/#website' },
        inLanguage: lang,
      },
      {
        '@type': 'Organization',
        '@id': 'https://honsgarden.se/#organization',
        name: brand,
        url: 'https://honsgarden.se',
        logo: { '@type': 'ImageObject', url: 'https://honsgarden.se/favicon.ico', width: 512, height: 512 },
        email: 'info@auroramedia.se',
        foundingDate: '2024',
        address: { '@type': 'PostalAddress', addressCountry: 'SE' },
        sameAs: [],
      },
    ],
  });

  const offering = t('offering.items', { returnObjects: true }) as string[];
  const values = t('values.items', { returnObjects: true }) as { title: string; desc: string }[];

  return (
    <div className="min-h-dvh bg-background">
      <VisitorWelcomePopup />

      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-xl">🐔</span>
            <span className="font-serif text-lg text-foreground">{brand}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/salja-agg" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">{t('nav.sell_eggs')}</Link>
            <Link to="/blogg" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">{t('nav.blog')}</Link>
            <Link to="/login">
              <Button size="sm" className="rounded-xl text-xs gap-1">
                <Egg className="h-3 w-3" /> {t('nav.get_started')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-16">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-medium mb-4">
            <Heart className="h-3.5 w-3.5" /> {t('header.badge', { brand })}
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-foreground mb-4 leading-tight">
            {t('header.title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('header.subtitle')}
          </p>
        </div>

        <section className="mb-14 sm:mb-20">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-10">
            <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-4 flex items-center gap-2">
              <span className="text-2xl">📖</span> {t('why.title', { brand })}
            </h2>
            <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              <p>{t('why.p1')}</p>
              <p>{t('why.p2')}</p>
              <p>{t('why.p3')}</p>
            </div>
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">{t('offering.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offering.map((item) => (
              <div key={item} className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">{t('values.title')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {values.map((v, i) => {
              const Icon = valueIcons[i] ?? Heart;
              return (
                <div key={v.title} className="p-5 rounded-2xl bg-card border border-border">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-serif text-base text-foreground mb-1">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">{t('team.title')}</h2>
          <div className="max-w-md mx-auto">
            <div className="p-6 rounded-2xl bg-card border border-border text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mx-auto mb-4">
                🐔
              </div>
              <h3 className="font-serif text-lg text-foreground">{t('team.name')}</h3>
              <p className="text-xs text-primary font-medium mb-3">{t('team.role')}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('team.bio')}</p>
            </div>
          </div>
        </section>

        <section className="mb-14 sm:mb-20">
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-6 text-center">{t('contact.title')}</h2>
          <div className="max-w-md mx-auto bg-card border border-border rounded-2xl p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('contact.email_label')}</p>
                  <a href="mailto:info@auroramedia.se" className="text-sm text-primary hover:underline">info@auroramedia.se</a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('contact.country_label')}</p>
                  <p className="text-sm text-foreground">{t('contact.country_value')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('contact.founded_label')}</p>
                  <p className="text-sm text-foreground">{t('contact.founded_value')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="text-center bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-3xl p-8 sm:p-12 border border-border/30">
          <span className="text-3xl mb-3 block">🥚</span>
          <h2 className="font-serif text-xl sm:text-2xl text-foreground mb-2">
            {t('cta.title')}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
            {t('cta.subtitle')}
          </p>
          <Link to="/login?mode=register">
            <Button size="lg" className="rounded-xl gap-2">
              <Egg className="h-4 w-4" /> {t('cta.button')} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/50 mt-16 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} {brand}</span>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">{t('footer.home')}</Link>
            <Link to="/salja-agg" className="hover:text-foreground transition-colors">{t('footer.sell_eggs')}</Link>
            <Link to="/blogg" className="hover:text-foreground transition-colors">{t('footer.blog')}</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
