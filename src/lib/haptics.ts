import { Capacitor } from '@capacitor/core';

/**
 * Haptisk feedback i native-appen (iOS/Android).
 * På webben blir alla anrop tysta no-ops – säkert att kalla överallt.
 * Biblioteket laddas dynamiskt så att det inte tynger webbundeln.
 */

async function withHaptics(fn: (h: typeof import('@capacitor/haptics').Haptics) => Promise<void>) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics } = await import('@capacitor/haptics');
    await fn(Haptics);
  } catch {
    /* haptics ska aldrig störa huvudflödet */
  }
}

/** Lätt knack – vid knapptryck som ändrar data (t.ex. +1 ägg). */
export const hapticTap = () =>
  withHaptics(async (Haptics) => {
    const { ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  });

/** Bekräftande "plopp" – när något lyckas (ägg loggat, klarering). */
export const hapticSuccess = () =>
  withHaptics(async (Haptics) => {
    const { NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  });
