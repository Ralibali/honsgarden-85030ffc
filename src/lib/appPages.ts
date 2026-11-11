// Shared by the app header and command palette. Match complete path segments.
export const appPages = [
  { path: '/app', label: 'Idag', section: 'today', emoji: '🏡', terms: 'dashboard startsida' },
  { path: '/app/eggs', label: 'Logga ägg', section: 'eggs', emoji: '🥚', terms: 'äggboken registrera historik' },
  { path: '/app/dagbok', label: 'Dagbok', section: 'diary', emoji: '📖' },
  { path: '/app/hens', label: 'Hönor och flockar', section: 'flock', emoji: '🐔' },
  { path: '/app/tasks', label: 'Uppgifter', section: 'yard', emoji: '🌿' },
  { path: '/app/feed', label: 'Foderjournal', section: 'feed', emoji: '🌾' },
  { path: '/app/feedback', label: 'Feedback', section: 'more', emoji: '💬' },
  { path: '/app/halsa', label: 'Hälsologg', section: 'health', emoji: '💚' },
  { path: '/app/avel', label: 'Avel och kläckning', section: 'breeding', emoji: '🐣' },
  { path: '/app/egg-sales', label: 'Agdas Bod', section: 'sales', emoji: '🧺' },
  { path: '/app/egg-sales/anpassa', label: 'Anpassa säljsidan', section: 'sales', emoji: '🧺' },
  { path: '/app/egg-sales/dashboard', label: 'Säljpanel', section: 'sales', emoji: '🧺' },
  { path: '/app/forsaljningsjournal', label: 'Försäljningsjournal', section: 'sales', emoji: '🧺' },
  { path: '/app/statistics', label: 'Statistik', section: 'insights', emoji: '📊' },
  { path: '/app/overview', label: 'Översikt', section: 'insights', emoji: '📊' },
  { path: '/app/rapporter', label: 'Rapporter', section: 'insights', emoji: '📊' },
  { path: '/app/year-report', label: 'Mitt hönsår', section: 'insights', emoji: '📊' },
  { path: '/app/weekly-report', label: 'Veckorapport', section: 'insights', emoji: '📊' },
  { path: '/app/agda', label: 'Agda AI', section: 'agda', emoji: '🐔' },
  { path: '/app/premium', label: 'Hönsgården Plus', section: 'premium', emoji: '✨' },
  { path: '/app/settings', label: 'Inställningar', section: 'settings', emoji: '⚙️' },
  { path: '/app/profile', label: 'Min profil', section: 'settings', emoji: '⚙️' },
  { path: '/app/reminders', label: 'Påminnelser', section: 'yard', emoji: '🔔' },
  { path: '/app/finance', label: 'Ekonomi', section: 'more', emoji: '🪙' },
  { path: '/app/lager', label: 'Lager', section: 'more', emoji: '📦' },
  { path: '/app/calendar', label: 'Säsongskalender', section: 'yard', emoji: '📅' },
  { path: '/app/weather', label: 'Väder och råd', section: 'yard', emoji: '🌤️' },
  { path: '/app/community', label: 'Community', section: 'more', emoji: '💬' },
  { path: '/app/news', label: 'Nyheter', section: 'more', emoji: '📰' },
  { path: '/app/butik', label: 'Butik', section: 'more', emoji: '🛍️' },
  { path: '/app/import', label: 'Importera data', section: 'settings', emoji: '📥' },
  { path: '/app/marknad/mina', label: 'Mina annonser', section: 'sales', emoji: '🧺' },
  { path: '/app/admin', label: 'Administration', section: 'more', emoji: '⚙️' },
  { path: '/app/growth-intelligence', label: 'Tillväxtanalys', section: 'more', emoji: '📊' },
];

export function getAppContext(pathname: string) {
  if (pathname.startsWith('/app/hens/')) return { section: 'hen-profile', label: 'Hönsprofil', emoji: '🐔' };
  if (pathname.startsWith('/app/weather/history/')) return { section: 'yard', label: 'Väderhistorik', emoji: '🌤️' };
  return appPages.find(page => page.path === pathname.replace(/\/$/, '')) ?? appPages[0];
}
