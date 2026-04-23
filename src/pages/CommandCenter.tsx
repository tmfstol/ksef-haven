import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { useCommandCenter } from "@/hooks/useCommandCenter";
import { AppLayout } from "@/components/layout/AppLayout";
import { HaviInsightBar } from "@/components/command-center/HaviInsightBar";
import { BentoKpiGrid } from "@/components/command-center/BentoKpiGrid";
import { ProjectsHealth } from "@/components/command-center/ProjectsHealth";
import { SmoothCashFlow } from "@/components/command-center/SmoothCashFlow";
import { PendingActions } from "@/components/command-center/PendingActions";
import { UpcomingPayments } from "@/components/command-center/UpcomingPayments";
import { SmartInbox } from "@/components/command-center/SmartInbox";
import { ContactsList } from "@/components/command-center/ContactsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2 } from "lucide-react";

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

  const {
    projectBudgets, contacts, invoices, monthlyData, upcomingPayments,
    cashPosition, nextPaymentDue, peopleOnSite, activeProjectsCount, isLoading
  } = useCommandCenter(activeCompanyId);

  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

  // Insighty dla Haviego
  const ksefToReview = useMemo(
    () => invoices.filter((i: any) => i.source === "ksef" && i.status === "new" && !i.project_id).length,
    [invoices]
  );
  const projectsNearLimit = useMemo(
    () =>
      projectBudgets
        .filter((p) => p.budget && p.spent / p.budget >= 0.8)
        .map((p) => ({ name: p.name, pct: Math.round((p.spent / (p.budget || 1)) * 100) }))
        .sort((a, b) => b.pct - a.pct),
    [projectBudgets]
  );
  const overdueCount = useMemo(
    () => upcomingPayments.filter((p) => p.days_until_due < 0).length,
    [upcomingPayments]
  );
  const invoicesToVerify = useMemo(
    () => invoices.filter((i: any) => i.status === "new" && i.source !== "ksef").length,
    [invoices]
  );

  if (companiesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
        {/* Page header — minimalistyczny */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight">Pulse</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Centrum dowodzenia Twoją firmą</p>
          </div>
          <div className="flex items-center gap-3">
            {companies && companies.length > 1 ? (
              <Select value={activeCompanyId || ""} onValueChange={setActiveCompanyId}>
                <SelectTrigger className="w-[200px] h-9 rounded-lg text-sm">
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : activeCompany ? (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{activeCompany.name}</span>
                <span className="text-xs text-muted-foreground">NIP: {activeCompany.nip}</span>
              </div>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          </div>
        ) : (
          <>
            {/* Havi Insight Bar */}
            <HaviInsightBar
              ksefToReview={ksefToReview}
              projectsNearLimit={projectsNearLimit}
              overduePayments={overdueCount}
              totalDueSoon={nextPaymentDue?.totalDueSoon || 0}
              peopleOnSite={peopleOnSite}
              companyName={activeCompany?.name}
            />

            {/* Rząd 1: Bento KPI Grid */}
            <BentoKpiGrid
              cash={cashPosition}
              nextPayment={nextPaymentDue}
              activeProjects={activeProjectsCount}
              peopleOnSite={peopleOnSite}
            />

            {/* Rząd 2: Projects Health (60%) + Cash-flow (40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5">
              <div className="lg:col-span-3">
                <ProjectsHealth projects={projectBudgets} />
              </div>
              <div className="lg:col-span-2 flex flex-col gap-4 lg:gap-5">
                <div className="flex-1 min-h-[280px]">
                  <SmoothCashFlow data={monthlyData} />
                </div>
                <PendingActions
                  ksefToReview={ksefToReview}
                  overduePayments={overdueCount}
                  invoicesToVerify={invoicesToVerify}
                />
              </div>
            </div>

            {/* Rząd 3: Płatności + Smart Inbox */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
              <UpcomingPayments payments={upcomingPayments} companyId={activeCompanyId} />
              <SmartInbox invoices={invoices} />
            </div>

            {/* Rząd 4: Kontakty */}
            <ContactsList contacts={contacts} />
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default CommandCenter;
