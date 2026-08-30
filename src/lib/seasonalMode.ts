/**
 * Säsongs-motor (Swarm J).
 *
 * Svenska höns året runt: dagsljuset styr värpningen, så vintern
 * (november–mars) är lugnperioden. Motorn är deterministisk och
 * testbar — inga nätverksanrop.
 */

import { trackEvent } from '@/lib/analytics';

export type SeasonalMode = 'winter' | 'spring' | 'summer' | 'autumn';

/**
 * Meteorologiska höns-säsonger för svenskt klimat:
 *  - winter: nov–mar (korta dagar, minskad/pausad värpning är normalt)
 *  - spring: apr–maj (värpningen drar igång, kläckningssäsong)
 *  - summer: jun–aug (högsäsong)
 *  - autumn: sep–okt (ruggning, värpningen avtar)
 */
export function getSeasonalMode(date: Date = new Date()): SeasonalMode {
  const month = date.getMonth(); // 0 = januari, lokal tid
  if (month >= 10 || month <= 2) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

export interface SeasonalGuidance {
  mode: SeasonalMode;
  title: string;
  body: string;
  /** Intern länk att fördjupa sig i. */
  ctaHref: string;
  ctaLabel: string;
}

/**
 * Fast, mänskligt skriven svensk copy per säsong. Inga påhittade siffror —
 * påståendena är vedertagna (mindre dagsljus → mindre värpning).
 */
export function getSeasonalGuidance(mode: SeasonalMode): SeasonalGuidance {
  switch (mode) {
    case 'winter':
      return {
        mode,
        title: 'Vinterlugnet är helt normalt',
        body: 'När dagarna blir korta värper många hönor mindre – eller pausar helt. Det är helt normalt: det är inte fel på dina hönor och inte på din loggning. Ljuset styr värpningen, och den kommer tillbaka i vår. Se till att vattnet inte fryser och att hönshuset är dragfritt, så klarar flocken vintern fint.',
        ctaHref: '/honskalender',
        ctaLabel: 'Se hönsårets vinterrutiner',
      };
    case 'spring':
      return {
        mode,
        title: 'Våren drar igång värpningen',
        body: 'Längre dagar betyder fler ägg. Våren är också kläckningssäsong – om du planerar kycklingar är det här läget att förbereda. Passa på att göra en ordentlig vårstädning av hönshuset.',
        ctaHref: '/klackningskalender',
        ctaLabel: 'Planera årets kläckning',
      };
    case 'summer':
      return {
        mode,
        title: 'Högsäsong i hönsgården',
        body: 'Sommaren ger mest ägg om året. Håll koll på vatten och skugga under heta dagar – värme stressar hönor mer än kyla. Överskottet kan du sälja lokalt om du vill.',
        ctaHref: '/salja-agg',
        ctaLabel: 'Sälja sommarens äggöverskott',
      };
    case 'autumn':
      return {
        mode,
        title: 'Ruggning och lugnare tempo',
        body: 'På hösten ruggar många hönor – de tappar fjädrar och värper mindre medan den nya fjäderdräkten växer ut. Det är jobbigt för hönorna men helt normalt. Lite extra protein i fodret hjälper fjädrarna.',
        ctaHref: '/honskalender',
        ctaLabel: 'Se höstens skötselråd',
      };
  }
}

const SEASON_MODE_FLAG = 'hg_seasonal_mode_v1';

/**
 * Skickar 'Seasonal Mode Changed' en gång per enhet och säsongsskifte.
 * Mäter hur många aktiva enheter som upplever respektive säsongs-läge.
 */
export function trackSeasonalModeIfChanged(mode: SeasonalMode): void {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(SEASON_MODE_FLAG) === mode) return;
    localStorage.setItem(SEASON_MODE_FLAG, mode);
    trackEvent('Seasonal Mode Changed', { mode });
  } catch {
    // localStorage kan vara blockerat i privat läge
  }
}
