import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PullToRefresh from '@/components/PullToRefresh';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { MobileNav } from './MobileNav';
import { QuickEggFAB } from './QuickEggFAB';
import CommandPalette from './CommandPalette';
import AppComingSoonDialog from './AppComingSoonDialog';
import { SuspenseFallback } from './SuspenseFallback';
import { Menu, Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { usePwaInstallTracking } from '@/hooks/usePwaInstallTracking';
import { useAchievementRewards } from '@/hooks/useAchievementRewards';
import AchievementUnlockOverlay from '@/components/AchievementUnlockOverlay';
import OfflineBanner from './OfflineBanner';

function getAppContext(pathname: string): { section: string; label: string; emoji: string } {
  if (pathname === '/app') return { section: 'today', label: 'Idag', emoji: '🏡' };
  if (pathname.startsWith('/app/eggs')) return { section: 'eggs', label: 'Ägg', emoji: '🥚' };
  if (pathname.startsWith('/app/hens/')) return { section: 'hen-profile', label: 'Hönsprofil', emoji: '🐔' };
  if (pathname.startsWith('/app/hens')) return { section: 'flock', label: 'Flocken', emoji: '🐔' };
  if (pathname.startsWith('/app/tasks')) return { section: 'yard', label: 'Gården', emoji: '🌿' };
  if (pathname.startsWith('/app/feed')) return { section: 'feed', label: 'Foder', emoji: '🌾' };
  if (pathname.startsWith('/app/halsa')) return { section: 'health', label: 'Hälsa', emoji: '💚' };
  if (pathname.startsWith('/app/avel')) return { section: 'breeding', label: 'Avel', emoji: '🐣' };
  if (pathname.startsWith('/app/egg-sales')) return { section: 'sales', label: 'Äggboden', emoji: '🧺' };
  if (pathname.startsWith('/app/statistics') || pathname.startsWith('/app/overview') || pathname.startsWith('/app/rapporter')) {
    return { section: 'insights', label: 'Insikter', emoji: '✨' };
  }
  if (pathname.startsWith('/app/agda')) return { section: 'agda', label: 'Agda', emoji: '🐔' };
  if (pathname.startsWith('/app/premium')) return { section: 'premium', label: 'Plus', emoji: '✨' };
  if (pathname.startsWith('/app/settings') || pathname.startsWith('/app/profile')) return { section: 'settings', label: 'Inställningar', emoji: '⚙️' };
  return { section: 'more', label: 'Hönsgården', emoji: '🌱' };
}

export default function AppLayout() {
  usePwaInstallTracking();
  useAchievementRewards();
  const location = useLocation();
  const appContext = getAppContext(location.pathname);

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
  }, []);

  return (
    <SidebarProvider>
      <div className="honsgarden-app-shell min-h-dvh flex w-full noise-bg" data-app-section={appContext.section}>
        <AppSidebar />

        <div className="flex-1 flex flex-col min-h-dvh overflow-x-hidden">
          <header className="hidden md:flex items-center justify-between border-b border-border/60 px-5 bg-background/60 backdrop-blur-xl sticky top-0 z-30 pt-safe-top min-h-12">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              <div className="app-desktop-context flex items-center gap-2.5 leading-none">
                <span className="app-context-emoji" aria-hidden="true">{appContext.emoji}</span>
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">Hönsgården</span>
                  <strong className="block mt-1 text-sm font-medium text-foreground">{appContext.label}</strong>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 hover:bg-muted border border-border rounded-lg px-3 py-1.5 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Sök...</span>
                <kbd className="ml-2 bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
              </button>
              <NotificationBell />
            </div>
          </header>

          <header className="flex md:hidden items-center justify-between border-b border-border/30 px-4 bg-background/55 backdrop-blur-xl sticky top-0 z-30 pt-safe-top min-h-12 py-1.5">
            <div className="flex items-center gap-2 min-w-0" aria-label="Hönsgården">
              <span className="text-lg leading-none" aria-hidden="true">🐔</span>
              <strong className="font-serif text-[17px] font-medium tracking-[-0.02em] text-foreground truncate">Hönsgården</strong>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
                aria-label="Sök"
              >
                <Search className="h-4.5 w-4.5" />
              </button>
              <NotificationBell />
            </div>
          </header>

          <OfflineBanner />

          <main
            id="main-content"
            className="flex-1 px-4 md:px-6 lg:px-8 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-6 md:pb-8 relative z-10"
          >
            <Suspense fallback={<SuspenseFallback />}>
              <PullToRefresh>
                <Outlet />
              </PullToRefresh>
            </Suspense>
          </main>
        </div>

        <MobileNav />
        <QuickEggFAB />
        <CommandPalette />
        <AppComingSoonDialog />
        <AchievementUnlockOverlay />
      </div>
    </SidebarProvider>
  );
}
