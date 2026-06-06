import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import React, { Suspense } from "react";
import CookieConsent from "./components/CookieConsent";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePageTracking, useAutoClickTracking } from "@/hooks/useTracking";
import { usePwaInstallTracking } from "@/hooks/usePwaInstallTracking";
import { SuspenseFallback } from "./components/SuspenseFallback";

import { lazyWithRetry } from "@/lib/lazyWithRetry";
import SettingsPage from "./pages/Settings";

const PwaUpdatePrompt = lazyWithRetry(() => import("./components/PwaUpdatePrompt"));

import Index from "./pages/IndexUpdated";
import Login from "./pages/Login";

const AppLayout = lazyWithRetry(() => import("./components/AppLayout"));
const Dashboard = lazyWithRetry(() => import("./pages/DashboardV2"));
const Eggs = lazyWithRetry(() => import("./pages/Eggs"));
const Hens = lazyWithRetry(() => import("./pages/Hens"));
const Finance = lazyWithRetry(() => import("./pages/Finance"));
const Statistics = lazyWithRetry(() => import("./pages/Statistics"));
const Feed = lazyWithRetry(() => import("./pages/Feed"));
const Reminders = lazyWithRetry(() => import("./pages/Reminders"));
const Hatching = lazyWithRetry(() => import("./pages/Hatching"));
const DailyTasks = lazyWithRetry(() => import("./pages/DailyTasks"));
const Feedback = lazyWithRetry(() => import("./pages/Feedback"));
const Premium = lazyWithRetry(() => import("./pages/Premium"));
const Community = lazyWithRetry(() => import("./pages/Community"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Terms = lazyWithRetry(() => import("./pages/Terms"));
const HenProfile = lazyWithRetry(() => import("./pages/HenProfile"));
const WeeklyReport = lazyWithRetry(() => import("./pages/WeeklyReport"));
const SmartFarmReport = lazyWithRetry(() => import("./pages/SmartFarmReport"));
const Guides = lazyWithRetry(() => import("./pages/Guides"));
const GuideArticle = lazyWithRetry(() => import("./pages/GuideArticle"));
const BlogCategory = lazyWithRetry(() => import("./pages/BlogCategory"));
const BlogTag = lazyWithRetry(() => import("./pages/BlogTag"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const About = lazyWithRetry(() => import("./pages/About"));
const EggCalculator = lazyWithRetry(() => import("./pages/EggCalculator"));
const AcceptInvite = lazyWithRetry(() => import("./pages/AcceptInvite"));
const Agda = lazyWithRetry(() => import("./pages/Agda"));
const Overview = lazyWithRetry(() => import("./pages/Overview"));
const Import = lazyWithRetry(() => import("./pages/Import"));
const SeasonalCalendar = lazyWithRetry(() => import("./pages/SeasonalCalendar"));
const SeoLandingPage = lazyWithRetry(() => import("./pages/SeoLandingPage"));
const HonsrasLanding = lazyWithRetry(() => import("./pages/HonsrasLanding"));
const EggSales = lazyWithRetry(() => import("./pages/EggSalesProV7"));
const PublicEggSale = lazyWithRetry(() => import("./pages/PublicEggSaleV3"));
const PublicReview = lazyWithRetry(() => import("./pages/PublicReview"));
const News = lazyWithRetry(() => import("./pages/News"));
const Weather = lazyWithRetry(() => import("./pages/Weather"));
const WeatherHistoryDetail = lazyWithRetry(() => import("./pages/WeatherHistoryDetail"));
const SaljaAgg = lazyWithRetry(() => import("./pages/SaljaAgg"));
const SaljaAggOrt = lazyWithRetry(() => import("./pages/SaljaAggOrt"));
const Health = lazyWithRetry(() => import("./pages/Health"));
const Breeding = lazyWithRetry(() => import("./pages/Breeding"));
const Inventory = lazyWithRetry(() => import("./pages/Inventory"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const MarketplaceMap = lazyWithRetry(() => import("./pages/MarketplaceMap"));
const DemoApp = lazyWithRetry(() => import("./pages/DemoApp"));


const GuiderRedirect = () => {
  const { slug } = useParams<{ slug?: string }>();
  const target = slug ? `/blogg/${slug}` : '/blogg';
  return <Navigate to={target} replace />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const LoadingFallback = () => <SuspenseFallback fullScreen />;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CacheClearer() {
  const { user } = useAuth();
  const prevUserId = React.useRef<string | null>(user?.id ?? null);

  React.useEffect(() => {
    if (user?.id !== prevUserId.current) {
      queryClient.clear();
      prevUserId.current = user?.id ?? null;
    }
  }, [user?.id]);

  return null;
}

function PageTracker() {
  usePageTracking();
  useAutoClickTracking();
  usePwaInstallTracking();
  return null;
}

const AppRoutes = () => (
  <BrowserRouter>
    <PageTracker />
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/index" element={<Navigate to="/" replace />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/app-for-honsagare" element={<SeoLandingPage pageKey="app-for-honsagare" />} />
        <Route path="/agglogg" element={<SeoLandingPage pageKey="agglogg" />} />
        <Route path="/honskalender" element={<SeoLandingPage pageKey="honskalender" />} />
        <Route path="/foderkostnad-hons" element={<SeoLandingPage pageKey="foderkostnad-hons" />} />
        <Route path="/klackningskalender" element={<SeoLandingPage pageKey="klackningskalender" />} />
        <Route path="/borja-med-hons" element={<SeoLandingPage pageKey="borja-med-hons" />} />
        <Route path="/honsraser" element={<HonsrasLanding slug="honsraser" />} />
        <Route path="/honsraser-lista" element={<HonsrasLanding slug="honsraser-lista" />} />
        <Route path="/dvarghons" element={<HonsrasLanding slug="dvarghons" />} />
        <Route path="/skansk-blommehona" element={<HonsrasLanding slug="skansk-blommehona" />} />
        <Route path="/salja-agg" element={<SaljaAgg />} />
        <Route path="/salja-agg/:ort" element={<SaljaAggOrt />} />
        <Route path="/karta" element={<MarketplaceMap />} />
        <Route path="/demo" element={<DemoApp />} />
        <Route path="/s/agg" element={<PublicEggSale />} />
        <Route path="/s/:slug" element={<PublicEggSale />} />
        <Route path="/r/:token" element={<PublicReview />} />
        <Route path="/login" element={<Login />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/om-oss" element={<About />} />
        <Route path="/verktyg/aggkalkylator" element={<EggCalculator />} />
        <Route path="/inbjudan/:token" element={<AcceptInvite />} />
        <Route path="/guider" element={<GuiderRedirect />} />
        <Route path="/guider/:slug" element={<GuiderRedirect />} />
        <Route path="/blogg" element={<Guides />} />
        <Route path="/blogg/kategori/:category" element={<BlogCategory />} />
        <Route path="/blogg/tagg/:tag" element={<BlogTag />} />
        <Route path="/blogg/:slug" element={<GuideArticle />} />
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Navigate to="/app" replace />} />
          <Route path="eggs" element={<Eggs />} />
          <Route path="hens" element={<Hens />} />
          <Route path="feed" element={<Feed />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="hatching" element={<Hatching />} />
          <Route path="tasks" element={<DailyTasks />} />
          <Route path="finance" element={<Finance />} />
          <Route path="egg-sales" element={<EggSales />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="overview" element={<Overview />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="premium" element={<Premium />} />
          <Route path="community" element={<Community />} />
          <Route path="admin" element={<Admin />} />
          <Route path="hens/:henId" element={<HenProfile />} />
          <Route path="weekly-report" element={<WeeklyReport />} />
          <Route path="smart-report" element={<SmartFarmReport />} />
          <Route path="agda" element={<Agda />} />
          <Route path="import" element={<Import />} />
          <Route path="calendar" element={<SeasonalCalendar />} />
          <Route path="news" element={<News />} />
          <Route path="weather" element={<Weather />} />
          <Route path="weather/history/:date" element={<WeatherHistoryDetail />} />
          <Route path="halsa" element={<Health />} />
          <Route path="avel" element={<Breeding />} />
          <Route path="lager" element={<Inventory />} />
          <Route path="rapporter" element={<Reports />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <CacheClearer />
          <AppRoutes />
          <CookieConsent />
          <Suspense fallback={null}>
            <PwaUpdatePrompt />
          </Suspense>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
