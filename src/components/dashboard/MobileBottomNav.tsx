import { Home, Receipt, FilePlus, MoreHorizontal, CalendarRange, FolderOpen, Calculator, ScanLine, Users, BarChart3, LayoutGrid, LayoutDashboard, Settings, LogOut, FileText, Wallet } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const primaryItems = [
  { icon: Home, label: "Faktury", path: "/dashboard" },
  { icon: Wallet, label: "Płatności", path: "/payments" },
  { icon: LayoutDashboard, label: "Pulse", path: "/command-center" },
  { icon: Receipt, label: "Wydatki", path: "/expenses" },
];

const moreItems = [
  { icon: FilePlus, label: "Nowa faktura", path: "/invoices/new" },
  { icon: CalendarRange, label: "Harmonogram", path: "/schedule" },
  { icon: FolderOpen, label: "Projekty", path: "/projects" },
  { icon: Calculator, label: "Kosztorysy", path: "/estimates" },
  { icon: ScanLine, label: "Karty pracy", path: "/timesheets" },
  { icon: Users, label: "Kontrahenci", path: "/contacts" },
  { icon: BarChart3, label: "Analityka", path: "/analytics" },
  { icon: LayoutGrid, label: "Workspace", path: "/workspace" },
  { icon: FileText, label: "Katalog", path: "/catalog" },
  { icon: Settings, label: "Ustawienia", path: "/settings" },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMoreActive = moreItems.some((it) => location.pathname === it.path);

  const handleNav = (path: string) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-border/50 px-1 pb-safe">
      <div className="flex items-center justify-around h-[68px] max-w-screen-md mx-auto">
        {primaryItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[56px] px-2 rounded-xl transition-all active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={item.label}
            >
              <item.icon className={cn("h-6 w-6", isActive && "text-primary")} />
              <span className={cn("text-[10px] font-medium leading-none", isActive && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[56px] px-2 rounded-xl transition-all active:scale-95",
                isMoreActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label="Więcej"
            >
              <MoreHorizontal className={cn("h-6 w-6", isMoreActive && "text-primary")} />
              <span className={cn("text-[10px] font-medium leading-none", isMoreActive && "font-semibold")}>
                Więcej
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl border-t border-border/50 max-h-[85vh] overflow-y-auto pb-safe">
            <SheetHeader className="mb-4">
              <SheetTitle>Wszystkie moduły</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNav(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 min-h-[88px] p-3 rounded-2xl transition-all active:scale-95",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "bg-secondary/40 text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => { setDrawerOpen(false); signOut(); }}
                className="flex flex-col items-center justify-center gap-2 min-h-[88px] p-3 rounded-2xl transition-all active:scale-95 bg-destructive/5 text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-6 w-6" />
                <span className="text-xs font-medium text-center leading-tight">Wyloguj</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
