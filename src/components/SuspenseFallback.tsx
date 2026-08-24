import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';
import { isStandalonePwa, recoverStalePwaShell } from '@/lib/pwaUpdate';

interface Props {
  /** Visa watchdog-knapp efter X ms. Default 8000. */
  timeoutMs?: number;
  /** True om fallback används i App.tsx-toppen (full-screen),
   *  False om den används inuti AppLayout (padding i main). */
  fullScreen?: boolean;
}

export function SuspenseFallback({ timeoutMs = 8000, fullScreen = false }: Props) {
  const [tookTooLong, setTookTooLong] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTookTooLong(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  useEffect(() => {
    if (!tookTooLong || !isStandalonePwa()) return;

    const key = 'pwa_stale_shell_recovered_v1';
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, Date.now().toString());
      void recoverStalePwaShell('automatic-suspense-timeout');
    } catch {
      void recoverStalePwaShell('automatic-suspense-timeout');
    }
  }, [tookTooLong]);

  const handleReload = () => {
    // Rensa retry-flaggan så lazyWithRetry/preloadError-handler kan reagera igen
    try {
      sessionStorage.removeItem('chunk_reload_attempted_v1');
      sessionStorage.removeItem('pwa_stale_shell_recovered_v1');
    } catch {
      // ignore
    }
    if (isStandalonePwa()) {
      void recoverStalePwaShell('suspense-timeout');
    } else {
      window.location.reload();
    }
  };

  const wrapper = fullScreen
    ? 'min-h-screen flex items-center justify-center'
    : 'flex items-center justify-center py-20';

  return (
    <div className={wrapper}>
      <div className="flex flex-col items-center gap-3">
        <span className="text-2xl">🥚</span>
        {!tookTooLong ? (
          <span className="text-sm text-muted-foreground">Laddar...</span>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground">
              Det här tar längre tid än vanligt
            </p>
            <Button onClick={handleReload} variant="outline" size="sm">
              <RotateCw className="h-4 w-4 mr-2" />
              Ladda om sidan
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Om problemet kvarstår, prova att stänga och öppna appen igen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
