import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowLeft, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSeo } from '@/hooks/useSeo';
import { DemoAuthProvider } from '@/hooks/useAuth';
import { installDemoShim, uninstallDemoShim } from '@/lib/demoShim';
import DashboardV2 from '@/pages/DashboardV2';

const DEMO_USER_ID = 'demo-user';

/** Förhindra att onboarding-guide, checklista och dagsmodal täcker demon. */
function suppressOneTimeOverlays() {
  try {
    localStorage.setItem(`honsgarden-onboarding-done-${DEMO_USER_ID}`, '1');
    localStorage.setItem(`honsgarden-onboarding-checklist-dismissed-${DEMO_USER_ID}`, '1');
    localStorage.setItem(`u:${DEMO_USER_ID}:daily-summary-date`, new Date().toDateString());
  } catch {
    // Privat surfning – då får modalerna visas, inget kraschar.
  }
}

/**
 * /demo – den RIKTIGA produkten (samma dashboard som inloggade ser)
 * driven av fiktiv data från demogården "Lillgården". Inget sparas,
 * inget konto behövs.
 */
export default function DemoApp() {
  useSeo({
    title: 'Prova Hönsgården – se appen i aktion | Hönsgården',
    description: 'Utforska Hönsgårdens riktiga dashboard med exempeldata: ägglogg, flock, statistik, AI-råd och mål. Ingen registrering, inget sparas.',
    path: '/demo',
    noindex: true,
  });

  // Egen isolerad cache för demon – påverkar aldrig den riktiga appens data.
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
        },
      }),
    [],
  );

  // Kör INNAN dashboarden renderas: dölj engångs-modalerna.
  useMemo(suppressOneTimeOverlays, []);

  // Shimmen måste installeras SYNKRONISKT före första renderingen (annars hinner
  // dashboardens queries anropa det riktiga API:et), och återställas vid unmount.
  const [uninstall] = useState(() => installDemoShim(queryClient));
  void uninstall;
  useEffect(() => {
    installDemoShim(queryClient); // no-op om redan installerad (StrictMode-säkert)
    return () => uninstallDemoShim();
  }, [queryClient]);

  return (
    <DemoAuthProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-dvh bg-background">
          {/* Demo-banner */}
          <div className="sticky top-0 z-50 border-b border-primary/20 bg-background/90 backdrop-blur-md">
            <div className="px-4 md:px-6 lg:px-8 py-2.5 flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Tillbaka</span>
              </a>
              <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
                <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 shrink-0">
                  <Sparkles className="h-3 w-3" /> Demo
                </Badge>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Du ser den riktiga appen med exempeldata från Lillgården – inget sparas
                </p>
              </div>
              <Button asChild size="sm" className="rounded-xl shrink-0 shadow-[0_4px_16px_hsl(var(--primary)/0.3)]">
                <a href="/login?mode=register">Skapa konto gratis</a>
              </Button>
            </div>
          </div>

          {/* Den riktiga dashboarden, precis som inloggade ser den */}
          <div className="px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-24">
            <DashboardV2 />
          </div>

          {/* Fast CTA längst ner */}
          <div className="fixed bottom-0 inset-x-0 z-40 p-3 bg-background/95 backdrop-blur border-t border-border">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Gillar du vad du ser?</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Lock className="h-3 w-3 shrink-0" /> Din egen data sparas säkert – gratis att börja
                </p>
              </div>
              <Button asChild className="rounded-xl shrink-0">
                <a href="/login?mode=register">Kom igång gratis</a>
              </Button>
            </div>
          </div>
        </div>
      </QueryClientProvider>
    </DemoAuthProvider>
  );
}
