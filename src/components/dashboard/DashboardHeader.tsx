import { RefreshCw, Search, Wifi, WifiOff, Loader2, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  isConnected: boolean;
  isSyncing: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSync: () => void;
  companyNip?: string;
}

export function DashboardHeader({
  isConnected,
  isSyncing,
  searchQuery,
  onSearchChange,
  onSync,
  companyNip,
}: DashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
      {/* Status połączenia */}
      <div className="flex items-center gap-2 text-sm">
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">
              <span className="text-success font-medium">Połączono</span>
              <span className="hidden sm:inline ml-1.5 text-muted-foreground/70">\\TB-AFS</span>
            </span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-destructive font-medium">Rozłączono</span>
          </>
        )}
      </div>

      {/* Aktywny NIP */}
      {companyNip && (
        <>
          <div className="h-5 w-px bg-border/60" />
          <div className="text-sm">
            <span className="text-muted-foreground">NIP:</span>{" "}
            <span className="font-semibold text-foreground">{companyNip}</span>
          </div>
        </>
      )}

      <div className="h-5 w-px bg-border/60" />

      {/* Wyszukiwarka */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Szukaj faktur..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
      </div>

      <div className="flex-1" />

      {/* Ustawienia */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/settings")}
        className="rounded-xl"
      >
        <Settings className="h-4 w-4" />
      </Button>

      {/* Synchronizacja */}
      <Button
        onClick={onSync}
        disabled={isSyncing}
        className="rounded-xl px-5 gap-2 shadow-sm"
      >
        {isSyncing ? (
          <Loader2 className="h-4 w-4 animate-spin-slow" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {isSyncing ? "Synchronizuję..." : "Synchronizuj z KSeF"}
      </Button>
    </header>
  );
}
