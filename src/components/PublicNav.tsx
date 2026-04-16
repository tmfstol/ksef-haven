import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface PublicNavProps {
  variant?: "dark" | "light";
}

const navLinks = [
  { to: "/", label: "Strona główna", exact: true },
  { to: "/blog", label: "Blog" },
];

const PublicNav = ({ variant = "dark" }: PublicNavProps) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const isDark = variant === "dark";

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-2xl",
        isDark
          ? "border-muted-foreground/10 bg-foreground/80"
          : "border-border bg-background/80"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span
            className={cn(
              "text-lg font-semibold tracking-tight",
              isDark ? "text-background" : "text-foreground"
            )}
          >
            KSeF Archiwum
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors relative",
                isActive(link.to, link.exact)
                  ? isDark
                    ? "text-background bg-muted-foreground/15"
                    : "text-primary bg-primary/10"
                  : isDark
                    ? "text-background/50 hover:text-background hover:bg-muted-foreground/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button
                  size="sm"
                  className="text-sm gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
                >
                  Dashboard
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "text-sm",
                      isDark
                        ? "text-background/70 hover:text-background hover:bg-muted-foreground/10"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Zaloguj się
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    size="sm"
                    className="text-sm gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow"
                  >
                    Rozpocznij
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              isDark
                ? "text-background/70 hover:bg-muted-foreground/10"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className={cn(
            "md:hidden border-t px-4 py-3 space-y-1",
            isDark
              ? "border-muted-foreground/10 bg-foreground/95"
              : "border-border bg-background/95"
          )}
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                isActive(link.to, link.exact)
                  ? isDark
                    ? "text-background bg-muted-foreground/15"
                    : "text-primary bg-primary/10"
                  : isDark
                    ? "text-background/60 hover:text-background"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 flex flex-col gap-2">
            {user ? (
              <Link to="/dashboard" onClick={() => setMobileOpen(false)}>
                <Button size="sm" className="w-full text-sm gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 border-0">
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" size="sm" className={cn("w-full text-sm", isDark ? "text-background/70" : "")}>
                    Zaloguj się
                  </Button>
                </Link>
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button size="sm" className="w-full text-sm gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 border-0">
                    Rozpocznij <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNav;
