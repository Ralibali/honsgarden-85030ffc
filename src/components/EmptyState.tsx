import React from 'react';
import { LucideIcon } from 'lucide-react';
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
    <div className={`rounded-2xl border border-dashed border-border/70 bg-card/60 p-6 sm:p-8 text-center ${className}`}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        {Icon ? <Icon className="h-7 w-7" aria-hidden="true" /> : <span className="text-2xl" aria-hidden="true">{emoji || '🐔'}</span>}
      </div>
      <h3 className="font-serif text-lg text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button className="rounded-xl w-full sm:w-auto" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondaryAction && (
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={onSecondaryAction}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
