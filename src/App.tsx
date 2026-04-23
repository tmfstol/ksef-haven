import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConversationProvider } from "@elevenlabs/react";
import { useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Settings from "./pages/Settings";
import CreateInvoice from "./pages/CreateInvoice";
import Expenses from "./pages/Expenses";
import Projects from "./pages/Projects";
import Contacts from "./pages/Contacts";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import CommandCenter from "./pages/CommandCenter";
import Analytics from "./pages/Analytics";
import Workspace from "./pages/Workspace";
import Schedule from "./pages/Schedule";
import Estimates from "./pages/Estimates";
import EstimateBuilder from "./pages/EstimateBuilder";
import Catalog from "./pages/Catalog";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import { Loader2 } from "lucide-react";
import { VoiceAgentWidget } from "@/components/dashboard/VoiceAgentWidget";
import { useCompanies } from "@/hooks/useCompanies";
import { useHaviRealtime } from "@/hooks/useHaviRealtime";
import { LegalAcceptanceGate } from "@/components/legal/LegalAcceptanceGate";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthenticatedOverlay() {
  const { user } = useAuth();
  const { data: companies } = useCompanies();
  // Aktywna firma = pierwsza z is_active=true (taki sam wybór jak w webhooku Haviego)
  const activeCompanyId = companies?.find((c) => c.is_active)?.id ?? companies?.[0]?.id ?? null;
  useHaviRealtime(user ? activeCompanyId : null);
  if (!user) return null;
  return (
    <>
      <LegalAcceptanceGate />
      <VoiceAgentWidget />
    </>
  );
}

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to="/command-center" replace /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
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
        <Route path="/onboarding" element={<ProtectedRoute><Settings isOnboarding /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <AuthenticatedOverlay />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ConversationProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ConversationProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
