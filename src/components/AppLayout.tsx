import React, { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { MobileNav } from './MobileNav';
import { QuickEggFAB } from './QuickEggFAB';
import CommandPalette from './CommandPalette';
import AppComingSoonDialog from './AppComingSoonDialog';
import { SuspenseFallback } from '@/components/SuspenseFallback';
import { Menu, Feather, Search } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { usePwaInstallTracking } from '@/hooks/usePwaInstallTracking';
import OfflineBanner from './OfflineBanner';


export default function AppLayout() {
  usePwaInstallTracking();
  // Ensure app routes are not indexed by search engines.
  // Inget cleanup – nästa publika sida uppdaterar robots via useSeo.
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
      <div className="min-h-screen flex w-full noise-bg">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          {/* Desktop header */}
          <header className="hidden md:flex items-center justify-between border-b border-border/60 px-5 bg-background/60 backdrop-blur-xl sticky top-0 z-30 pt-safe-top min-h-12">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
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

          {/* Mobile header */}
          <header className="flex md:hidden items-center justify-between border-b border-border/60 px-4 bg-background/70 backdrop-blur-xl sticky top-0 z-30 pt-safe-top min-h-14 py-2">
            <div className="w-8" />
            <div className="flex items-center gap-2">
              <Feather className="h-4 w-4 text-primary" />
              <span className="font-serif text-lg text-foreground">Hönsgården</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
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
              <Outlet />
            </Suspense>
          </main>
        </div>

        <MobileNav />
        <QuickEggFAB />
        <CommandPalette />
        <AppComingSoonDialog />
      </div>
    </SidebarProvider>
  );
}
