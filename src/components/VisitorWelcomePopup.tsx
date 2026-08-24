import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X, Egg } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'visitor-welcome-dismissed';
const COOKIE_CONSENT_KEY = 'cookie-consent';

export default function VisitorWelcomePopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    // Wait for cookie consent to be handled first
    const checkReady = () => {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) return false; // Cookie consent not yet handled
      return true;
    };

    // Trigger on 50% scroll depth (not timer)
    const onScroll = () => {
      if (!checkReady()) return;
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent >= 0.5) {
        setShow(true);
        window.removeEventListener('scroll', onScroll);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] z-50"
        >
          <div className="relative bg-card border border-border rounded-2xl shadow-lg p-5 pr-10">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Stäng"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🐔</span>
              <div className="space-y-1.5">
                <h3 className="font-serif text-sm text-foreground leading-snug">
                  Hej, hönsägare! 👋
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Logga ägg med ett tryck, håll koll på flocken och se om du går plus. <strong>Helt gratis</strong> – klart på 10 sekunder!
                </p>
                <div className="flex items-center gap-2 pt-1.5">
                  <Link to="/login?mode=register" onClick={dismiss}>
                    <Button size="sm" className="rounded-xl text-xs gap-1 h-8">
                      <Egg className="h-3 w-3" /> Skapa konto gratis
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
