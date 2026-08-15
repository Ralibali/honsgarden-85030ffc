import React from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`honsgarden-empty-state ${className}`}>
      <div className="honsgarden-empty-state__mark">
        {Icon ? <Icon className="h-6 w-6" aria-hidden="true" /> : <span className="text-2xl" aria-hidden="true">{emoji || '🐔'}</span>}
      </div>
      <p className="honsgarden-empty-state__eyebrow">Här börjar något</p>
      <h3 className="font-serif text-xl text-foreground">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button className="rounded-xl w-full sm:w-auto gap-1.5" onClick={onAction}>
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <Button variant="ghost" className="rounded-xl w-full sm:w-auto text-muted-foreground" onClick={onSecondaryAction}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
