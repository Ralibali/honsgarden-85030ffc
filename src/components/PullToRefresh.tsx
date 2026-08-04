import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hapticTap, hapticSuccess } from '@/lib/haptics';

const THRESHOLD = 72; // px som krävs för att trigga uppdatering

/**
 * Pull-to-refresh för touch-enheter: dra nedåt högst upp på sidan
 * för att hämta färsk data (invaliderar alla React Query-frågor).
 * Osynlig på desktop – inga touch-events avfyras där.
 */
export default function PullToRefresh({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && e.touches.length === 1) {
        startY.current = e.touches[0].clientY;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const resisted = Math.min(dy * 0.45, THRESHOLD * 1.6);
        setPull(resisted);
        // Motstå browserns egen gummibandseffekt bara när vi faktiskt drar
        if (resisted > 8 && e.cancelable) e.preventDefault();
      } else if (pull !== 0) {
        setPull(0);
      }
    };

    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pull >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        hapticTap();
        queryClient.invalidateQueries().finally(() => {
          hapticSuccess();
          // Låt indikatorn synas en kort stund för bekräftelse
          setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 650);
        });
      } else {
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [pull, refreshing, queryClient]);

  const visible = pull > 4 || refreshing;
  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <>
      <div
        aria-hidden={!visible}
        className="pointer-events-none fixed left-1/2 top-3 z-40 -translate-x-1/2 transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card border border-border shadow-lg"
          style={{
            transform: `translateY(${refreshing ? 8 : Math.min(pull * 0.5, 40)}px)`,
            transition: refreshing ? 'transform 0.2s ease' : undefined,
          }}
        >
          {refreshing ? (
            <span className="text-lg animate-spin inline-block" style={{ animationDuration: '0.9s' }}>🥚</span>
          ) : (
            <span
              className="text-lg inline-block transition-transform"
              style={{ transform: `rotate(${progress * 360}deg)`, opacity: 0.4 + progress * 0.6 }}
            >
              🥚
            </span>
          )}
        </div>
      </div>
      {children}
    </>
  );
}
