import { useState } from "react";
import { RefreshCw, Search, Wifi, WifiOff, Loader2, Settings, Zap, LogOut, FilePlus, Receipt, FolderOpen, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/company";
import { useAuth } from "@/hooks/useAuth";

interface SyncParams {
  dateFrom?: string;
  dateTo?: string;
}

interface DashboardHeaderProps {
  isConnected: boolean;
  isSyncing: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSync: (params?: SyncParams) => void;
  onSyncAll?: (params?: SyncParams) => void;
  isSyncingAll?: boolean;
  activeCompany?: Company | null;
}

export function DashboardHeader({
  isConnected,
  isSyncing,
  searchQuery,
  onSearchChange,
  onSync,
  onSyncAll,
  isSyncingAll,
  activeCompany,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [syncDateFrom, setSyncDateFrom] = useState<Date | undefined>(undefined);
  const [syncDateTo, setSyncDateTo] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const buildParams = (): SyncParams | undefined => {
    const params: SyncParams = {};
    if (syncDateFrom) params.dateFrom = syncDateFrom.toISOString().split("T")[0];
    if (syncDateTo) params.dateTo = syncDateTo.toISOString().split("T")[0];
    return Object.keys(params).length > 0 ? params : undefined;
  };

  const handleSync = () => onSync(buildParams());
  const handleSyncAll = () => onSyncAll?.(buildParams());

  return (
    <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
      {/* Status połączenia */}
      <div className="flex items-center gap-2 text-sm">
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4 text-success" />
            <span className="text-muted-foreground">
              <span className="text-success font-medium">Baza danych online</span>
            </span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-destructive" />
            <span className="text-destructive font-medium">Rozłączono</span>
          </>
        )}
      </div>

      {/* Aktywna firma */}
      {activeCompany && (
        <>
          <div className="h-5 w-px bg-border/60" />
          <div className="text-sm flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {activeCompany.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="font-semibold text-foreground">{activeCompany.name}</span>
              <span className="text-muted-foreground ml-1.5">NIP: {activeCompany.nip}</span>
            </div>
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

      {/* Nowa faktura */}
      <Button
        variant="outline"
        onClick={() => navigate("/invoices/new")}
        className="rounded-xl px-4 gap-2"
        title="Utwórz nową fakturę"
      >
        <FilePlus className="h-4 w-4" />
        Nowa faktura
      </Button>

      {/* Wydatki */}
      <Button
        variant="outline"
        onClick={() => navigate("/expenses")}
        className="rounded-xl px-4 gap-2"
        title="Zarządzaj wydatkami"
      >
        <Receipt className="h-4 w-4" />
        Wydatki
      </Button>

      {/* Projekty */}
      <Button
        variant="outline"
        onClick={() => navigate("/projects")}
        className="rounded-xl px-4 gap-2"
        title="Foldery inwestycji"
      >
        <FolderOpen className="h-4 w-4" />
        Projekty
      </Button>

      {/* Ustawienia */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/settings")}
        className="rounded-xl"
        title="Ustawienia"
      >
        <Settings className="h-4 w-4" />
      </Button>

      {/* Wyloguj */}
      <Button
        variant="ghost"
        size="icon"
        onClick={signOut}
        className="rounded-xl text-muted-foreground hover:text-destructive"
        title="Wyloguj"
      >
        <LogOut className="h-4 w-4" />
      </Button>

      {/* Sync All */}
      {onSyncAll && (
        <Button
          variant="outline"
          onClick={handleSyncAll}
          disabled={isSyncingAll}
          className="rounded-xl px-4 gap-2"
        >
          {isSyncingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Sync. wszystkich
        </Button>
      )}

      {/* Synchronizacja */}
      <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            title="Filtruj daty synchronizacji"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Zakres dat do synchronizacji</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Od</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-xs rounded-lg", !syncDateFrom && "text-muted-foreground")}>
                      {syncDateFrom ? format(syncDateFrom, "dd.MM.yyyy") : "Domyślnie"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={syncDateFrom} onSelect={setSyncDateFrom} locale={pl} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Do</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-xs rounded-lg", !syncDateTo && "text-muted-foreground")}>
                      {syncDateTo ? format(syncDateTo, "dd.MM.yyyy") : "Dzisiaj"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={syncDateTo} onSelect={setSyncDateTo} locale={pl} className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {(syncDateFrom || syncDateTo) && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setSyncDateFrom(undefined); setSyncDateTo(undefined); }}>
                Wyczyść (domyślnie 3 miesiące)
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        onClick={handleSync}
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
