import { Home, Receipt, FolderOpen, Settings, FilePlus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Faktury", path: "/dashboard" },
  { icon: FilePlus, label: "Nowa", path: "/invoices/new" },
  { icon: Receipt, label: "Wydatki", path: "/expenses" },
  { icon: FolderOpen, label: "Projekty", path: "/projects" },
  { icon: Settings, label: "Ustawienia", path: "/settings" },
];

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-border/50 px-2 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
