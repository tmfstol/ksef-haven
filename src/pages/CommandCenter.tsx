import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { useCommandCenter } from "@/hooks/useCommandCenter";
import { KpiCards } from "@/components/command-center/KpiCards";
import { RevenueChart } from "@/components/command-center/RevenueChart";
import { StatusChart } from "@/components/command-center/StatusChart";
import { ProjectBudgets } from "@/components/command-center/ProjectBudgets";
import { ObligationsCalendar } from "@/components/command-center/ObligationsCalendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LayoutDashboard, Loader2 } from "lucide-react";
import logoFacturo from "@/assets/logo-facturo.png";

const CommandCenter = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(companies[0].id);
    }
  }, [companies, activeCompanyId]);

  const activeCompany = useMemo(
    () => companies?.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const { kpis, monthlyData, statusCounts, projectBudgets, unpaidInvoices, isLoading } = useCommandCenter(activeCompanyId);

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-panel border-b border-border/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-30">
        <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src={logoFacturo} alt="Facturo" className="h-7 w-7 rounded-lg object-contain" />
          <span className="text-sm font-bold tracking-tight text-foreground">Facturo</span>
        </Link>

        <div className="h-5 w-px bg-border/60" />

        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Centrum Dowodzenia</span>
        </div>

        {companies && companies.length > 1 && (
          <>
            <div className="h-5 w-px bg-border/60" />
            <Select value={activeCompanyId || ""} onValueChange={setActiveCompanyId}>
              <SelectTrigger className="w-[200px] h-9 rounded-xl text-sm">
                <SelectValue placeholder="Wybierz firmę" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        {activeCompany && companies && companies.length <= 1 && (
          <>
            <div className="h-5 w-px bg-border/60" />
            <div className="flex items-center gap-2 text-sm">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {activeCompany.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold">{activeCompany.name}</span>
              <span className="text-muted-foreground">NIP: {activeCompany.nip}</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        <Button variant="outline" onClick={() => navigate("/dashboard")} className="rounded-xl gap-2">
          <ArrowLeft className="h-4 w-4" />
          Wróć do faktur
        </Button>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Ładowanie danych...</p>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <KpiCards kpis={kpis} />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <RevenueChart data={monthlyData} />
              </div>
              <div>
                <StatusChart data={statusCounts} />
              </div>
            </div>

            {/* Projects & Obligations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectBudgets projects={projectBudgets} />
              <ObligationsCalendar invoices={unpaidInvoices} />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default CommandCenter;
