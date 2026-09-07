import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getQueue } from '@/lib/offlineQueue';

export default function OfflineBanner() {
  const { isOnline, pendingCount, legacyCount, syncing, syncError, retrySync } = useOnlineStatus();

  if (syncError || legacyCount > 0 || (isOnline && pendingCount > 0 && !syncing)) {
    return (
      <div role="status" className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 text-sm flex flex-wrap items-center justify-center gap-3">
        <span>{syncError || (pendingCount > 0 ? `${pendingCount} loggningar väntar på synk.` : '')}
          {legacyCount > 0 && ` ${legacyCount} äldre loggningar saknar kontokoppling och finns kvar på enheten. Exportera dem för att kontrollera och registrera dem på rätt konto.`}
        </span>
        {isOnline && <button className="underline font-semibold" disabled={syncing} onClick={() => void retrySync()}>{syncing ? 'Synkar…' : 'Försök synka igen'}</button>}
        {legacyCount > 0 && <button className="underline font-semibold" onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(getQueue(), null, 2)], { type: 'application/json' }));
          const link = document.createElement('a'); link.href = url; link.download = 'aldre-aggloggningar.json'; link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Exportera äldre loggningar</button>}
      </div>
    );
  }

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
