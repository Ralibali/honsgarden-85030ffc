import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}

/**
 * Smoothly animates a number from its previous value to the new one.
 * Uses requestAnimationFrame with easeOutQuart for a satisfying feel.
 */
export function CountUp({ value, duration = 800, className, decimals = 0, suffix = '', prefix = '' }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

export default CountUp;
