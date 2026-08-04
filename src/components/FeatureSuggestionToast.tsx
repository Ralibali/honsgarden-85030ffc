import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';

interface Suggestion {
  emoji: string;
  title: string;
  description: string;
  route: string;
  storageKey: string;
}

const suggestions: Suggestion[] = [
  {
    emoji: '🌾',
    title: 'Spåra foderkostnader',
    description: 'Se vad varje ägg kostar dig!',
    route: '/app/feed',
    storageKey: 'suggestion-feed-dismissed',
  },
  {
    emoji: '💰',
    title: 'Koll på ekonomin',
    description: 'Logga försäljning & se vinst per ägg.',
    route: '/app/finance',
    storageKey: 'suggestion-finance-dismissed',
  },
  {
    emoji: '📋',
    title: 'Dagliga uppgifter',
    description: 'Skapa rutiner & få påminnelser.',
    route: '/app/tasks',
    storageKey: 'suggestion-chores-dismissed',
  },
];

interface FeatureSuggestionToastProps {
  show: boolean;
  /** Which features the user has NOT used yet */
  unusedFeatures: ('feed' | 'finance' | 'chores')[];
  onDismiss: () => void;
}

export function FeatureSuggestionToast({ show, unusedFeatures, onDismiss }: FeatureSuggestionToastProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  // Pick a random unused feature that hasn't been dismissed
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    if (!show || unusedFeatures.length === 0) return;

    const featureMap: Record<string, Suggestion> = {
      feed: suggestions[0],
      finance: suggestions[1],
      chores: suggestions[2],
    };

    const available = unusedFeatures
      .map(f => featureMap[f])
      .filter(s => !readScoped(user?.id, s.storageKey));

    if (available.length === 0) {
      onDismiss();
      return;
    }

    const pick = available[Math.floor(Math.random() * available.length)];
    setSuggestion(pick);

    // Delay showing by 1.5s (after egg animation)
    const t = setTimeout(() => setVisible(true), 1500);
    // Auto-dismiss after 8s
    const t2 = setTimeout(() => { setVisible(false); onDismiss(); }, 9500);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [show, unusedFeatures, user?.id]);

  const dismiss = () => {
    if (suggestion) writeScoped(user?.id, suggestion.storageKey, '1');
    setVisible(false);
    onDismiss();
  };

  const goTo = () => {
    if (suggestion) {
      writeScoped(user?.id, suggestion.storageKey, '1');
      navigate(suggestion.route);
    }
    setVisible(false);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {visible && suggestion && (
        <motion.div
          className="fixed bottom-24 md:bottom-20 left-4 right-4 md:left-auto md:right-6 md:max-w-xs z-[80]"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="bg-card border border-border/60 rounded-2xl shadow-xl p-4 flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5">{suggestion.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{suggestion.description}</p>
              <button
                onClick={goTo}
                className="text-xs font-medium text-primary hover:underline mt-2 inline-block"
              >
                Prova nu →
              </button>
            </div>
            <button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-0.5">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
