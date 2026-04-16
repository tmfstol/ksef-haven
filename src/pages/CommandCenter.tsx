import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { useCommandCenter } from "@/hooks/useCommandCenter";
import { AppLayout } from "@/components/layout/AppLayout";
import { KpiCards } from "@/components/command-center/KpiCards";
import { VatIncomeWidgets } from "@/components/command-center/VatIncomeWidgets";
import { CashFlowChart } from "@/components/command-center/CashFlowChart";
import { UpcomingPayments } from "@/components/command-center/UpcomingPayments";
import { SmartInbox } from "@/components/command-center/SmartInbox";
import { ContactsList } from "@/components/command-center/ContactsList";
import { ProjectBudgets } from "@/components/command-center/ProjectBudgets";
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
    kpis, vatForecast, incomeForecast, monthlyData, upcomingPayments,
    projectBudgets, contacts, invoices, company, isLoading
  } = useCommandCenter(activeCompanyId);

  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

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
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Pulse</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Centrum dowodzenia Twoją firmą</p>
          </div>
          <div className="flex items-center gap-3">
            {companies && companies.length > 1 ? (
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
            ) : activeCompany ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                <Building2 className="h-4 w-4 text-primary" />
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
            {/* Row 1: KPIs */}
            <KpiCards kpis={kpis} />

            {/* Row 2: VAT/Income widgets + Upcoming payments */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <VatIncomeWidgets vat={vatForecast} income={incomeForecast} taxType={company?.tax_type || "liniowy"} />
              <div className="lg:col-span-2">
                <UpcomingPayments payments={upcomingPayments} companyId={activeCompanyId} />
              </div>
            </div>

            {/* Row 3: Cash-flow chart + Smart Inbox */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <CashFlowChart data={monthlyData} />
              </div>
              <div className="lg:col-span-2">
                <SmartInbox invoices={invoices} />
              </div>
            </div>

            {/* Row 4: Projects + CRM Contacts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProjectBudgets projects={projectBudgets} />
              <ContactsList contacts={contacts} />
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default CommandCenter;
