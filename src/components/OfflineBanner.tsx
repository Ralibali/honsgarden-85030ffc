import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing } = useOnlineStatus();

  if (!isOnline) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs sm:text-sm px-4 py-2 flex items-center justify-center gap-2">
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
        <span>
          Du är offline — äggloggning fungerar ändå 🐔
          {pendingCount > 0 && (
            <> · Sparat offline ({pendingCount}) – synkas automatiskt</>
          )}
        </span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-primary/10 border-b border-primary/20 text-primary text-xs sm:text-sm px-4 py-2 flex items-center justify-center gap-2">
        <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
        <span>
          {syncing
            ? `Synkar ${pendingCount} loggning${pendingCount === 1 ? '' : 'ar'}…`
            : `Sparat offline (${pendingCount}) – synkas automatiskt`}
        </span>
      </div>
    );
  }

  return null;
}
