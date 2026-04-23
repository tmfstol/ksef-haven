import { useState } from "react";
import { RefreshCw, Search, Wifi, WifiOff, Loader2, Settings, Zap, LogOut, FilePlus, Receipt, FolderOpen, CalendarIcon, Menu, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import logoFacturo from "@/assets/logo-facturo.png";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Company } from "@/types/company";
import { useAuth } from "@/hooks/useAuth";
import { useIsTabletOrBelow } from "@/hooks/use-mobile";

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
  companies?: Company[];
  activeCompanyId?: string | null;
  onSelectCompany?: (id: string) => void;
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
  companies,
  activeCompanyId,
  onSelectCompany,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isMobile = useIsTabletOrBelow();
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

  if (isMobile) {
    return (
      <header className="glass-panel border-b border-border/50 px-4 py-3 space-y-3">
        {/* Top row: company selector + sync */}
        <div className="flex items-center gap-2">
          {companies && companies.length > 1 && onSelectCompany ? (
            <Select value={activeCompanyId || ""} onValueChange={(v) => onSelectCompany(v)}>
              <SelectTrigger className="flex-1 h-9 rounded-xl text-sm">
                <SelectValue placeholder="Wybierz firmę" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : activeCompany ? (
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {activeCompany.name.charAt(0)}
              </div>
              <span className="text-sm font-semibold truncate">{activeCompany.name}</span>
            </div>
          ) : <div className="flex-1" />}

          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <Wifi className="h-3.5 w-3.5 text-success" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
            <Button size="sm" onClick={handleSync} disabled={isSyncing} className="rounded-xl h-8 px-3 gap-1.5 text-xs">
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Pobierz
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Szukaj faktur..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-secondary/50 border-0 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </header>
    );
  }

  // Desktop header
  return (
    <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4">
      <Link to="/" className="flex items-center gap-2 mr-2 hover:opacity-80 transition-opacity">
        <img src={logoFacturo} alt="Facturo" className="h-7 w-7 rounded-lg object-contain" />
        <span className="text-sm font-bold tracking-tight text-foreground">Facturo</span>
      </Link>
      <div className="h-5 w-px bg-border/60" />
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

      <Button variant="outline" onClick={() => navigate("/command-center")} className="rounded-xl px-4 gap-2" title="Centrum dowodzenia">
        <LayoutDashboard className="h-4 w-4" /> Centrum
      </Button>
      <Button variant="outline" onClick={() => navigate("/invoices/new")} className="rounded-xl px-4 gap-2" title="Utwórz nową fakturę">
        <FilePlus className="h-4 w-4" /> Nowa faktura
      </Button>
      <Button variant="outline" onClick={() => navigate("/expenses")} className="rounded-xl px-4 gap-2" title="Zarządzaj wydatkami">
        <Receipt className="h-4 w-4" /> Wydatki
      </Button>
      <Button variant="outline" onClick={() => navigate("/projects")} className="rounded-xl px-4 gap-2" title="Foldery inwestycji">
        <FolderOpen className="h-4 w-4" /> Projekty
      </Button>
      <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="rounded-xl" title="Ustawienia">
        <Settings className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={signOut} className="rounded-xl text-muted-foreground hover:text-destructive" title="Wyloguj">
        <LogOut className="h-4 w-4" />
      </Button>

      {onSyncAll && (
        <Button variant="outline" onClick={handleSyncAll} disabled={isSyncingAll} className="rounded-xl px-4 gap-2">
          {isSyncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Pobierz wszystkie
        </Button>
      )}

      <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-xl" title="Filtruj daty synchronizacji">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-4" align="end">
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Szybki zakres synchronizacji</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Ostatnie 3 mies.", months: 3 },
                { label: "Ostatnie 6 mies.", months: 6 },
                { label: "Ostatni rok", months: 12 },
                { label: "Ostatnie 2 lata", months: 24 },
              ].map((preset) => (
                <Button
                  key={preset.months}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-lg"
                  onClick={() => {
                    const from = new Date();
                    from.setMonth(from.getMonth() - preset.months);
                    const to = new Date();
                    setSyncDateFrom(from);
                    setSyncDateTo(to);
                    setShowDatePicker(false);
                    onSync({
                      dateFrom: from.toISOString().split("T")[0],
                      dateTo: to.toISOString().split("T")[0],
                    });
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="border-t border-border/50 pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Albo wybierz dokładnie</p>
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
                <Button
                  size="sm"
                  className="w-full text-xs mt-2 rounded-lg"
                  onClick={() => {
                    setShowDatePicker(false);
                    handleSync();
                  }}
                >
                  Pobierz wybrany zakres
                </Button>
              )}
              {(syncDateFrom || syncDateTo) && (
                <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => { setSyncDateFrom(undefined); setSyncDateTo(undefined); }}>
                  Wyczyść (domyślnie 3 miesiące)
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button onClick={handleSync} disabled={isSyncing} className="rounded-xl px-5 gap-2 shadow-sm">
        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin-slow" /> : <RefreshCw className="h-4 w-4" />}
        {isSyncing ? "Pobieranie..." : "Pobierz z KSeF"}
      </Button>
    </header>
  );
}
