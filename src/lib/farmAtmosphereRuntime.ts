type FarmDaypart = 'night' | 'morning' | 'day' | 'evening';

const GREETING_RE = /^(God morgon|God förmiddag|God eftermiddag|God kväll|God natt|Hej)(.*)$/;

function getDaypart(date = new Date()): FarmDaypart {
  const hour = date.getHours();
  if (hour >= 22 || hour < 5) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

function getGreeting(daypart: FarmDaypart): string {
  if (daypart === 'night') return 'God natt';
  if (daypart === 'morning') return 'God morgon';
  if (daypart === 'evening') return 'God kväll';
  return 'Hej';
}

function markDashboardAndCorrectGreeting(daypart: FarmDaypart) {
  const headingCandidates = document.querySelectorAll<HTMLHeadingElement>('h1');

  for (const heading of headingCandidates) {
    const text = heading.textContent?.trim() ?? '';
    const match = text.match(GREETING_RE);
    if (!match) continue;

    const dashboard = heading.closest<HTMLElement>('.max-w-2xl');
    if (!dashboard) continue;

    dashboard.classList.add('hg-dashboard-today');
    heading.parentElement?.classList.add('hg-today-hero');

    const next = `${getGreeting(daypart)}${match[2]}`;
    if (text !== next) heading.textContent = next;
  }
}

function markCookieSheet() {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div')).filter((element) => {
    const text = element.textContent ?? '';
    return text.includes('Cookies och statistik') && text.includes('Acceptera statistik') && text.includes('Endast nödvändiga');
  });

  if (!candidates.length) return;

  // Pick the innermost matching container so we style the actual consent card,
  // not a full-screen portal/root wrapper.
  const card = candidates.find((candidate) =>
    !candidates.some((other) => other !== candidate && candidate.contains(other)),
  ) ?? candidates[candidates.length - 1];

  card.classList.add('hg-cookie-sheet');
}

function syncFarmAtmosphere() {
  const daypart = getDaypart();
  document.documentElement.dataset.localDaypart = daypart;

  // Give the public hero a correct local fallback immediately. The weather hook
  // may later refine dusk/day using sunrise and sunset for the visitor location.
  if (!document.documentElement.dataset.heroTime) {
    document.documentElement.dataset.heroTime = daypart === 'night' ? 'night' : daypart === 'evening' ? 'dusk' : 'day';
  }

  markDashboardAndCorrectGreeting(daypart);
  markCookieSheet();
}

export function installFarmAtmosphereRuntime() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let frame = 0;
  const scheduleSync = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      syncFarmAtmosphere();
    });
  };

  syncFarmAtmosphere();

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('popstate', scheduleSync);
  window.setInterval(syncFarmAtmosphere, 30_000);
}
