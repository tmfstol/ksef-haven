import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { useHasModule, ModuleKey, MODULE_LABELS } from "@/hooks/useModulePermissions";

interface RequireModuleProps {
  module: ModuleKey;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireModule({ module, children, fallback }: RequireModuleProps) {
  const { allowed, loading } = useHasModule(module);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-center px-6">
        <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground mb-1">Brak dostępu</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Nie masz uprawnień do modułu „{MODULE_LABELS[module]}". Skontaktuj się z administratorem firmy.
        </p>
        <Navigate to="/dashboard" replace />
      </div>
    );
  }

  return <>{children}</>;
}
