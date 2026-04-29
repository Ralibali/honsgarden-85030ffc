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

const PwaUpdatePrompt = React.lazy(() => import("./components/PwaUpdatePrompt"));

import Index from "./pages/IndexUpdated";
import Login from "./pages/Login";

const AppLayout = React.lazy(() => import("./components/AppLayout"));
const Dashboard = React.lazy(() => import("./pages/DashboardV2"));
const Eggs = React.lazy(() => import("./pages/Eggs"));
const Hens = React.lazy(() => import("./pages/Hens"));
const Finance = React.lazy(() => import("./pages/Finance"));
const Statistics = React.lazy(() => import("./pages/Statistics"));
const Feed = React.lazy(() => import("./pages/Feed"));
const Reminders = React.lazy(() => import("./pages/Reminders"));
const Hatching = React.lazy(() => import("./pages/Hatching"));
const DailyTasks = React.lazy(() => import("./pages/DailyTasks"));
const SettingsPage = React.lazy(() => import("./pages/Settings"));
const Feedback = React.lazy(() => import("./pages/Feedback"));
const Premium = React.lazy(() => import("./pages/Premium"));
const Community = React.lazy(() => import("./pages/Community"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Admin = React.lazy(() => import("./pages/Admin"));
const Terms = React.lazy(() => import("./pages/Terms"));
const HenProfile = React.lazy(() => import("./pages/HenProfile"));
const WeeklyReport = React.lazy(() => import("./pages/WeeklyReport"));
const SmartFarmReport = React.lazy(() => import("./pages/SmartFarmReport"));
const Guides = React.lazy(() => import("./pages/Guides"));
const GuideArticle = React.lazy(() => import("./pages/GuideArticle"));
const BlogCategory = React.lazy(() => import("./pages/BlogCategory"));
const BlogTag = React.lazy(() => import("./pages/BlogTag"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const About = React.lazy(() => import("./pages/About"));
const EggCalculator = React.lazy(() => import("./pages/EggCalculator"));
const AcceptInvite = React.lazy(() => import("./pages/AcceptInvite"));
const Agda = React.lazy(() => import("./pages/Agda"));
const Overview = React.lazy(() => import("./pages/Overview"));
const Import = React.lazy(() => import("./pages/Import"));
const SeasonalCalendar = React.lazy(() => import("./pages/SeasonalCalendar"));
const SeoLandingPage = React.lazy(() => import("./pages/SeoLandingPage"));
const EggSales = React.lazy(() => import("./pages/EggSalesProV7"));
const PublicEggSale = React.lazy(() => import("./pages/PublicEggSaleV3"));
const PublicReview = React.lazy(() => import("./pages/PublicReview"));
const News = React.lazy(() => import("./pages/News"));
const Weather = React.lazy(() => import("./pages/Weather"));
const WeatherHistoryDetail = React.lazy(() => import("./pages/WeatherHistoryDetail"));
const SaljaAgg = React.lazy(() => import("./pages/SaljaAgg"));
const SaljaAggOrt = React.lazy(() => import("./pages/SaljaAggOrt"));

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

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <span className="text-2xl">🥚</span>
      <span className="text-sm text-muted-foreground">Laddar...</span>
    </div>
  </div>
);

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
  return null;
}

const AppRoutes = () => (
  <BrowserRouter>
    <PageTracker />
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/app-for-honsagare" element={<SeoLandingPage pageKey="app-for-honsagare" />} />
        <Route path="/agglogg" element={<SeoLandingPage pageKey="agglogg" />} />
        <Route path="/honskalender" element={<SeoLandingPage pageKey="honskalender" />} />
        <Route path="/foderkostnad-hons" element={<SeoLandingPage pageKey="foderkostnad-hons" />} />
        <Route path="/klackningskalender" element={<SeoLandingPage pageKey="klackningskalender" />} />
        <Route path="/borja-med-hons" element={<SeoLandingPage pageKey="borja-med-hons" />} />
        <Route path="/salja-agg" element={<SaljaAgg />} />
        <Route path="/salja-agg/:ort" element={<SaljaAggOrt />} />
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
