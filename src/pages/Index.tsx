import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, useSync, extractVendors } from "@/hooks/useInvoices";
import { useCompanies, useSyncAllCompanies } from "@/hooks/useCompanies";
import { VendorSidebar } from "@/components/dashboard/VendorSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { InvoiceFilters, applyFilters, type InvoiceFiltersState } from "@/components/dashboard/InvoiceFilters";
import { Loader2 } from "lucide-react";
import { AiAssistantChat } from "@/components/dashboard/AiAssistantChat";
import type { InvoiceType } from "@/types/invoice";

const EMPTY_FILTERS: InvoiceFiltersState = {
  dateFrom: undefined,
  dateTo: undefined,
  vendor: null,
  status: null,
  amountMin: "",
  amountMax: "",
};

const Index = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const { data: invoices, isLoading, isError, refetch } = useInvoices(activeCompanyId);
  const syncMutation = useSync(activeCompanyId);
  const syncAllMutation = useSyncAllCompanies();
  const [selectedNip, setSelectedNip] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<InvoiceFiltersState>(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState<InvoiceType>("kosztowa");
  const [lastSeenTimestamp] = useState<string | null>(() => {
    const prev = localStorage.getItem("ksef_last_seen");
    localStorage.setItem("ksef_last_seen", new Date().toISOString());
    return prev;
  });

  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(companies[0].id);
    }
  }, [companies, activeCompanyId]);

  const activeCompany = useMemo(
    () => companies?.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  // Filter by tab first
  const tabInvoices = useMemo(
    () => invoices?.filter((i) => i.invoice_type === activeTab) ?? [],
    [invoices, activeTab]
  );

  const vendors = useMemo(() => extractVendors(tabInvoices), [tabInvoices]);

  const filteredInvoices = useMemo(() => {
    let result = tabInvoices;
    if (selectedNip) result = result.filter((i) => i.nip === selectedNip);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.vendor.toLowerCase().includes(q) ||
          i.nip.includes(q) ||
          i.date.includes(q)
      );
    }
    result = applyFilters(result, filters);
    return result;
  }, [tabInvoices, selectedNip, searchQuery, filters]);

  const kosztCount = useMemo(() => invoices?.filter((i) => i.invoice_type === "kosztowa").length ?? 0, [invoices]);
  const przychCount = useMemo(() => invoices?.filter((i) => i.invoice_type === "przychodowa").length ?? 0, [invoices]);

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <VendorSidebar
        vendors={vendors}
        selectedNip={selectedNip}
        onSelectVendor={setSelectedNip}
        companies={companies || []}
        activeCompanyId={activeCompanyId}
        onSelectCompany={(id) => {
          setActiveCompanyId(id);
          setSelectedNip(null);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          isConnected={!isError}
          isSyncing={syncMutation.isPending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSync={() => syncMutation.mutate()}
          onSyncAll={() => syncAllMutation.mutate()}
          isSyncingAll={syncAllMutation.isPending}
          activeCompany={activeCompany}
        />

        {/* Invoice type tabs */}
        <div className="px-6 pt-4 flex gap-1 border-b border-border/50">
          <button
            onClick={() => { setActiveTab("kosztowa"); setSelectedNip(null); }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
              activeTab === "kosztowa"
                ? "text-foreground bg-secondary/60"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            Kosztowe
            <span className="ml-2 text-xs text-muted-foreground">({kosztCount})</span>
            {activeTab === "kosztowa" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => { setActiveTab("przychodowa"); setSelectedNip(null); }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative ${
              activeTab === "przychodowa"
                ? "text-foreground bg-secondary/60"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
            }`}
          >
            Przychodowe
            <span className="ml-2 text-xs text-muted-foreground">({przychCount})</span>
            {activeTab === "przychodowa" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin-slow text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Ładowanie faktur...</p>
              </div>
            </div>
          ) : isError ? (
            <EmptyState isError onRetry={() => refetch()} />
          ) : !invoices || invoices.length === 0 ? (
            <EmptyState
              title={activeCompany ? `Brak faktur dla ${activeCompany.name}` : "Brak faktur"}
              description={
                activeCompany
                  ? "Token KSeF zapisujesz w ustawieniach firmy. Po jego zapisaniu uruchom synchronizację z lokalnej aplikacji, aby pobrać pierwsze faktury."
                  : "Przejdź do ustawień i dodaj firmę z tokenem KSeF, aby rozpocząć pracę."
              }
              actionLabel={activeCompany ? "Otwórz ustawienia firmy" : "Przejdź do ustawień"}
              onRetry={() =>
                navigate(activeCompany ? `/settings?company=${activeCompany.id}` : "/settings")
              }
            />
          ) : tabInvoices.length === 0 ? (
            <EmptyState
              title={`Brak faktur ${activeTab === "kosztowa" ? "kosztowych" : "przychodowych"}`}
              description="Po synchronizacji z KSeF faktury zostaną automatycznie sklasyfikowane."
            />
          ) : (
            <>
              <InvoiceFilters filters={filters} onChange={setFilters} vendors={vendors} />
              <StatsBar invoices={filteredInvoices} lastSeenTimestamp={lastSeenTimestamp} />
              <InvoiceTable invoices={filteredInvoices} lastSeenTimestamp={lastSeenTimestamp} clientPortalEmail={activeCompany?.client_portal_email} />
            </>
          )}
        </main>
      </div>
      <AiAssistantChat />
    </div>
  );
};

export default Index;
