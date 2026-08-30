/**
 * Demo → verklighet-överlämning (Swarm F).
 *
 * När en besökare i /demo försöker använda en riktig appfunktion
 * (navigerar till /app/...) träffar de inloggningsväggen. Den här
 * modulen fångar det ögonblicket och mappar det mot funnel-eventen
 * Demo Feature Used / Demo To Signup.
 *
 * Allt är rent och testbart: själva mappningen är en ren funktion och
 * trackern tar emot history-objektet så den kan testas utan DOM.
 */

import type { AnalyticsDemoFeature } from '@/lib/analytics';

/** Mappar en /app/-sökväg till demots feature-begrepp (låg kardinalitet). */
export function mapAppPathToDemoFeature(pathname: string): AnalyticsDemoFeature | undefined {
  const path = String(pathname).split('?')[0];
  if (!path.startsWith('/app')) return undefined;
  if (/^\/app\/eggs/.test(path)) return 'egg_log';
  if (/^\/app\/hens/.test(path)) return 'hens';
  if (/^\/app\/(calendar|tasks|reminders|hatching)/.test(path)) return 'calendar';
  if (/^\/app\/(community|marknad)/.test(path)) return 'marketplace';
  if (/^\/app\/agda/.test(path)) return 'agda_preview';
  if (/^\/app\/(statistics|overview|weekly-report|year-report|smart-report)/.test(path)) {
    return 'reports_preview';
  }
  return undefined;
}

export interface DemoNavigationEvents {
  /** Fires första gången per feature under en demosejour. */
  onFeatureUsed: (feature: AnalyticsDemoFeature) => void;
  /** Fires en gång när besökaren först lämnar demon mot appen/signup. */
  onHandoff: () => void;
}

/**
 * Lyssnar på SPA-navigering genom att linda history.pushState under demots
 * livstid. Returnerar en uninstall-funktion som återställer originalet.
 * Täcker både <Link>-klick och programmatiska navigate()-anrop.
 */
export function trackDemoNavigation(
  events: DemoNavigationEvents,
  historyObj: History = window.history,
): () => void {
  const seenFeatures = new Set<AnalyticsDemoFeature>();
  let handoffFired = false;
  const original = historyObj.pushState;

  historyObj.pushState = function patchedPushState(
    this: History,
    data: unknown,
    unused: string,
    url?: string | URL | null,
  ) {
    try {
      const path = url == null ? '' : String(url);
      const feature = mapAppPathToDemoFeature(path);
      if (feature && !seenFeatures.has(feature)) {
        seenFeatures.add(feature);
        events.onFeatureUsed(feature);
      }
      if (path.startsWith('/app') && !handoffFired) {
        handoffFired = true;
        events.onHandoff();
      }
    } catch {
      // Instrumentering får aldrig störa navigeringen.
    }
    return original.call(this, data, unused, url);
  } as History['pushState'];

  return () => {
    if (historyObj.pushState !== original) historyObj.pushState = original;
  };
}
