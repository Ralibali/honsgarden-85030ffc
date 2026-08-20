import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Lucide from 'lucide-react';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const APP_SHELL_FILES = [
  'pages/DashboardV3.tsx',
  'components/AppLayout.tsx',
  'components/AppSidebar.tsx',
  'components/MobileNav.tsx',
  'components/NotificationBell.tsx',
  'components/QuickEggFAB.tsx',
  'components/CommandPalette.tsx',
  'components/AppComingSoonDialog.tsx',
  'components/OfflineBanner.tsx',
  'components/AchievementUnlockOverlay.tsx',
  'components/TrialExpiryBanner.tsx',
  'components/dashboard/QuickEggLogCard.tsx',
  'components/dashboard/OnboardingChecklistCard.tsx',
  'components/dashboard/HenRaceCard.tsx',
  'components/dashboard/StreakRescueCard.tsx',
];

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkTsx(full));
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

function lucideNamedImports(source: string): string[] {
  const names: string[] = [];
  const blocks = source.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g);
  for (const block of blocks) {
    for (const raw of block[1].split(',')) {
      const part = raw.trim();
      if (!part || part.startsWith('type ')) continue;
      const [exported] = part.split(/\s+as\s+/).map((s) => s.trim());
      if (exported) names.push(exported);
    }
  }
  return names;
}

function collectFromFiles(relFiles: string[]): { file: string; icon: string }[] {
  const found: { file: string; icon: string }[] = [];
  for (const rel of relFiles) {
    const file = path.join(ROOT, rel);
    const icons = lucideNamedImports(readFileSync(file, 'utf8'));
    for (const icon of icons) found.push({ file: rel, icon });
  }
  return found;
}

describe('lucide-react icons used by /app and ui', () => {
  const uiFiles = walkTsx(path.join(ROOT, 'components/ui')).map((abs) =>
    path.relative(ROOT, abs).replace(/\\/g, '/'),
  );

  const usages = [
    ...collectFromFiles(uiFiles),
    ...collectFromFiles(APP_SHELL_FILES),
  ];

  it('hittar lucide-importer i ui- och /app-skalet', () => {
    expect(usages.length).toBeGreaterThan(10);
    expect(usages.some((u) => u.file.endsWith('dialog.tsx') && u.icon === 'X')).toBe(true);
    expect(usages.some((u) => u.file.endsWith('accordion.tsx') && u.icon === 'ChevronDown')).toBe(true);
    expect(usages.some((u) => u.file.endsWith('sidebar.tsx') && u.icon === 'PanelLeft')).toBe(true);
  });

  it('varje namngiven import finns som export i installerad lucide-react (inte undefined.default)', () => {
    const missing = usages.filter(({ icon }) => {
      const value = (Lucide as Record<string, unknown>)[icon];
      return value == null;
    });

    expect(
      missing,
      missing.map((m) => `${m.icon} from ${m.file}`).join(', ') || 'none',
    ).toEqual([]);
  });

  it('chunkar inte lucide-react ensamt som vendor-icons (Vite default-reexport-krasch)', () => {
    const vite = readFileSync('vite.config.ts', 'utf8');
    expect(vite).not.toMatch(/["']vendor-icons["']\s*:\s*\[\s*["']lucide-react["']/);
  });
});
