import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import { Loader2 } from "lucide-react";
import { VoiceAgentLauncher } from "@/components/dashboard/VoiceAgentLauncher";
import { useCompanies } from "@/hooks/useCompanies";
import { useHaviRealtime } from "@/hooks/useHaviRealtime";
import { LegalAcceptanceGate } from "@/components/legal/LegalAcceptanceGate";
import CookieConsentBanner from "@/components/CookieConsentBanner";

// Public pages — light, lazy
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Bezpieczenstwo = lazy(() => import("./pages/Bezpieczenstwo"));
const Status = lazy(() => import("./pages/Status"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ProgramDoFakturKsef = lazy(() => import("./pages/seo/ProgramDoFakturKsef"));
const DarmowyProgramDoFaktur = lazy(() => import("./pages/seo/DarmowyProgramDoFaktur"));
const KosztorysBudowlanyOnline = lazy(() => import("./pages/seo/KosztorysBudowlanyOnline"));
const KartyPracyOnline = lazy(() => import("./pages/seo/KartyPracyOnline"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));

// Authenticated app — heavy, lazy (KSeF, kosztorysy, CRM nie ładują się na landingu)
const Index = lazy(() => import("./pages/Index"));
const Settings = lazy(() => import("./pages/Settings"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Projects = lazy(() => import("./pages/Projects"));
const Contacts = lazy(() => import("./pages/Contacts"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Workspace = lazy(() => import("./pages/Workspace"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Estimates = lazy(() => import("./pages/Estimates"));
const EstimateBuilder = lazy(() => import("./pages/EstimateBuilder"));
const Catalog = lazy(() => import("./pages/Catalog"));
const Timesheets = lazy(() => import("./pages/Timesheets"));
const Payments = lazy(() => import("./pages/Payments"));
const Documents = lazy(() => import("./pages/Documents"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthenticatedOverlay() {
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  const activeCompanyId = companies?.find((c) => c.is_active)?.id ?? companies?.[0]?.id ?? null;
  useHaviRealtime(user ? activeCompanyId : null);
  if (!user) return null;
  return (
    <>
      <LegalAcceptanceGate />
      <VoiceAgentLauncher />
    </>
  );
}

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={user ? <Navigate to="/command-center" replace /> : <Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/bezpieczenstwo" element={<Bezpieczenstwo />} />
          <Route path="/status" element={<Status />} />
          <Route path="/checkout/return" element={<CheckoutReturn />} />
          <Route path="/program-do-faktur-ksef" element={<ProgramDoFakturKsef />} />
          <Route path="/darmowy-program-do-faktur" element={<DarmowyProgramDoFaktur />} />
          <Route path="/kosztorys-budowlany-online" element={<KosztorysBudowlanyOnline />} />
          <Route path="/karty-pracy-online" element={<KartyPracyOnline />} />
          <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/command-center" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/estimates" element={<ProtectedRoute><Estimates /></ProtectedRoute>} />
          <Route path="/estimates/:id" element={<ProtectedRoute><EstimateBuilder /></ProtectedRoute>} />
          <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
          <Route path="/timesheets" element={<ProtectedRoute><Timesheets /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><Settings isOnboarding /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <AuthenticatedOverlay />
      <CookieConsentBanner />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
