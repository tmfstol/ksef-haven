import { useLocation, Link } from "react-router-dom";
import { 
  LayoutDashboard, FileText, Users, BarChart3, Settings, 
  LogOut, ChevronLeft, ChevronRight, Zap, Receipt, FolderOpen, LayoutGrid, CalendarRange, Calculator, ScanLine, Wallet, FileBox
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logoFacturo from "@/assets/logo-facturo.png";

const navItems = [
  { label: "Pulse", icon: LayoutDashboard, path: "/command-center" },
  { label: "Harmonogram", icon: CalendarRange, path: "/schedule" },
  { label: "Faktury", icon: FileText, path: "/dashboard" },
  { label: "Dokumenty", icon: FileBox, path: "/documents" },
  { label: "Płatności", icon: Wallet, path: "/payments" },
  { label: "Kontrahenci", icon: Users, path: "/contacts" },
  { label: "Wydatki", icon: Receipt, path: "/expenses" },
  { label: "Projekty", icon: FolderOpen, path: "/projects" },
  { label: "Kosztorysy", icon: Calculator, path: "/estimates" },
  { label: "Karty pracy", icon: ScanLine, path: "/timesheets" },
  { label: "Analityka", icon: BarChart3, path: "/analytics" },
  { label: "Workspace", icon: LayoutGrid, path: "/workspace" },
];

const bottomItems = [
  { label: "Ustawienia", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar:collapsed") === "1";
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar:collapsed", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "h-screen flex flex-col border-r transition-all duration-300 flex-shrink-0 relative",
        "bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))] border-[hsl(var(--sidebar-border))]",
        collapsed ? "w-[68px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 px-4 h-16 border-b border-[hsl(var(--sidebar-border))]", collapsed && "justify-center px-2")}>
        <img src={logoFacturo} alt="Facturo" className="h-8 w-8 rounded-lg object-contain flex-shrink-0" />
        {!collapsed && (
          <div>
            <span className="text-sm font-bold tracking-tight text-white">Facturo</span>
            <span className="block text-[10px] text-[hsl(var(--sidebar-muted))] -mt-0.5">Centrum Dowodzenia</span>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[hsl(var(--sidebar-accent))] text-white shadow-sm"
                  : "text-[hsl(var(--sidebar-muted))] hover:text-white hover:bg-white/5",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", active && "text-[hsl(var(--sidebar-primary))]")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="border-t border-[hsl(var(--sidebar-border))] py-3 px-2 space-y-0.5">
        {bottomItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[hsl(var(--sidebar-accent))] text-white"
                  : "text-[hsl(var(--sidebar-muted))] hover:text-white hover:bg-white/5",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <button
          onClick={signOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
            "text-[hsl(var(--sidebar-muted))] hover:text-red-400 hover:bg-red-500/10",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Wyloguj" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {!collapsed && <span>Wyloguj</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
