import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bird, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Funktioner', href: '/#funktioner' },
  { label: 'Priser', href: '/priser' },
  { label: 'Marknad', href: '/marknad' },
  { label: 'Äggkalkylator', href: '/verktyg/aggkalkylator' },
  { label: 'Blogg', href: '/blogg' },
];

/** Trattmätning: klick på navbarens registrerings-CTA. */
function trackNavbarCta() {
  void import('@/lib/analytics').then(({ trackEvent }) =>
    trackEvent('CTA Register Clicked', { source: 'landing_navbar' }),
  );
}

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !navRef.current?.contains(event.target)) setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      ref={navRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMobileOpen(false);
      }}
      className={`fixed top-0 left-0 right-0 ${mobileOpen ? 'z-[61]' : 'z-50'} transition-colors duration-300 ${
        scrolled
          ? 'bg-background/85 backdrop-blur-md border-b border-border/50 shadow-sm'
          : 'bg-background/95 border-b border-border/50'
      }`}
      aria-label="Huvudnavigation"
    >
      <div className="container max-w-6xl mx-auto px-5 sm:px-6 flex items-center justify-between h-16">
        <a href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <Bird className="h-4 w-4 text-primary" />
          </span>
          <span className="font-serif text-lg text-foreground">Hönsgården</span>
        </a>

        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          <Button asChild variant="ghost" size="sm">
            <a href="/login?mode=login">Logga in</a>
          </Button>
          <Button asChild size="sm" className="rounded-xl shadow-[0_4px_16px_hsl(var(--primary)/0.3)]" onClick={trackNavbarCta}>
            <a href="/login?mode=register">Kom igång gratis</a>
          </Button>
        </div>

        <button
          className="lg:hidden min-h-11 min-w-11 p-2 text-foreground"
          ref={menuButton}
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Stäng meny' : 'Öppna meny'}
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        id="landing-mobile-menu"
        hidden={!mobileOpen}
        className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-border/50 bg-background lg:hidden"
      >
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 space-y-2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm text-muted-foreground hover:text-foreground min-h-11 py-3"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="min-h-11 flex-1">
              <a href="/login?mode=login">Logga in</a>
            </Button>
            <Button asChild size="sm" className="min-h-11 flex-1" onClick={trackNavbarCta}>
              <a href="/login?mode=register">Kom igång gratis</a>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
