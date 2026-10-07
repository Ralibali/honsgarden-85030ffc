import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past 40vh
      const footer = document.querySelector('[data-landing-footer]');
      const footerVisible = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setVisible(window.scrollY > window.innerHeight * 0.4 && !footerVisible);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-background/95 backdrop-blur-md border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] animate-fade-in">
      <Button asChild className="w-full min-h-12 h-auto py-3 whitespace-normal text-sm gap-2 shadow-[0_-4px_20px_hsl(var(--primary)/0.2)]">
        <a href="/login?mode=register">
          Skapa konto – 7 dagar Premium gratis
          <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
