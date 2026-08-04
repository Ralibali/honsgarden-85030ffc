import { useEffect, useState } from 'react';

interface RingProgressProps {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
  progressClassName?: string;
  children?: React.ReactNode;
  label?: string;
}

/**
 * Apple-watch style ring. Animates fill on mount + when value changes.
 * Uses currentColor on the progress stroke so callers can color via text-* classes.
 */
export function RingProgress({
  value,
  size = 96,
  stroke = 9,
  className = '',
  trackClassName = 'text-muted/30',
  progressClassName = 'text-primary',
  children,
  label,
}: RingProgressProps) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(clamped)}% av målet`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackClassName}
          stroke="currentColor"
          opacity={0.25}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={progressClassName}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

export default RingProgress;
