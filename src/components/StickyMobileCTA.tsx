import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';
import { useBottomInset } from '@/hooks/useBottomInset';
const KEY = 'honsgarden-promo-dismissed';
export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const bannerRef = useBottomInset(visible && !dismissed, 'promo');
  useEffect(() => {
    const onScroll = () => {
      const footer = document.querySelector('[data-landing-footer]');
      const cookie = document.querySelector('[data-cookie-consent-banner]');
      const footerVisible = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setVisible(window.innerWidth < 640 && window.scrollY > window.innerHeight * .4 && !footerVisible && !cookie);
    };
    const observer = new MutationObserver(onScroll);
    observer.observe(document.body, { childList: true, subtree: true });
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  if (!visible || dismissed) return null;
  return <div ref={bannerRef} className="fixed bottom-0 inset-x-0 z-40 flex items-center gap-2 border-t border-border bg-background p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:hidden">
    <Button asChild className="h-auto min-h-12 flex-1 whitespace-normal py-3 text-sm gap-2"><a href="/login?mode=register&plan=plus_annual&trial=7d">Prova Plus gratis i 7 dagar<ArrowRight className="h-4 w-4 shrink-0" /></a></Button>
    <button type="button" aria-label="Stäng erbjudandet" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border" onClick={() => { setDismissed(true); try { localStorage.setItem(KEY, '1'); } catch { /* Session-only if storage blocked */ } }}><X className="h-5 w-5" /></button>
  </div>;
}
