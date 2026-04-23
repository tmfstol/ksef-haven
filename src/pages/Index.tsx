import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, useSync, extractVendors } from "@/hooks/useInvoices";
import { useCompanies, useSyncAllCompanies } from "@/hooks/useCompanies";
import { VendorSidebar } from "@/components/dashboard/VendorSidebar";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { InvoiceFilters, applyFilters, type InvoiceFiltersState } from "@/components/dashboard/InvoiceFilters";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { InvoiceCard } from "@/components/dashboard/InvoiceCard";
import { UploadInvoiceModal } from "@/components/dashboard/UploadInvoiceModal";
import { UploadTimesheetButton } from "@/components/timesheets/UploadTimesheetButton";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const { data: invoices, isLoading, isError, refetch } = useInvoices(activeCompanyId);
  const syncMutation = useSync(activeCompanyId);
  const syncAllMutation = useSyncAllCompanies();
  const [selectedNip, setSelectedNip] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<InvoiceFiltersState>(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState<InvoiceType>("kosztowa");
  const [showUploadModal, setShowUploadModal] = useState(false);
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
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex h-full bg-background overflow-hidden">
        {/* Vendor sidebar (firmy + kontrahenci) - hidden on mobile */}
        {!isMobile && (
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
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader
            isConnected={!isError}
            isSyncing={syncMutation.isPending}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSync={(params?: { dateFrom?: string; dateTo?: string }) => syncMutation.mutate(params)}
            onSyncAll={(params?: { dateFrom?: string; dateTo?: string }) => syncAllMutation.mutate(params)}
            isSyncingAll={syncAllMutation.isPending}
            activeCompany={activeCompany}
            companies={companies || []}
            activeCompanyId={activeCompanyId}
            onSelectCompany={(id) => { setActiveCompanyId(id); setSelectedNip(null); }}
          />

          {/* Invoice type tabs + upload button */}
          <div className="px-4 md:px-6 pt-3 md:pt-4 flex items-center gap-1 border-b border-border/50">
            <button
              onClick={() => { setActiveTab("kosztowa"); setSelectedNip(null); }}
              className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium rounded-t-lg transition-colors relative ${
                activeTab === "kosztowa"
                  ? "text-foreground bg-secondary/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
              }`}
            >
              Kosztowe
              <span className="ml-1.5 md:ml-2 text-xs text-muted-foreground">({kosztCount})</span>
              {activeTab === "kosztowa" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab("przychodowa"); setSelectedNip(null); }}
              className={`px-3 md:px-4 py-2 md:py-2.5 text-xs md:text-sm font-medium rounded-t-lg transition-colors relative ${
                activeTab === "przychodowa"
                  ? "text-foreground bg-secondary/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
              }`}
            >
              Przychodowe
              <span className="ml-1.5 md:ml-2 text-xs text-muted-foreground">({przychCount})</span>
              {activeTab === "przychodowa" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>

            <div className="flex-1" />

            {activeCompanyId && (
              <>
                <UploadTimesheetButton
                  companyId={activeCompanyId}
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs mb-1"
                  label="Karta pracy"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-1.5 text-xs mb-1"
                  onClick={() => setShowUploadModal(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Dodaj PDF</span>
                </Button>
              </>
            )}
          </div>

          <main className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-6 pb-20 md:pb-6">
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
                    ? "Token KSeF zapisujesz w ustawieniach firmy. Po jego zapisaniu uruchom synchronizację, aby pobrać faktury. Możesz też dodać fakturę z pliku PDF."
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
                description="Po synchronizacji z KSeF faktury zostaną automatycznie sklasyfikowane. Możesz też dodać fakturę z pliku PDF."
              />
            ) : (
              <>
                <InvoiceFilters filters={filters} onChange={setFilters} vendors={vendors} />
                <StatsBar invoices={filteredInvoices} lastSeenTimestamp={lastSeenTimestamp} />

                {isMobile ? (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredInvoices.map((invoice) => (
                      <InvoiceCard
                        key={invoice.id}
                        invoice={invoice}
                        isNew={!!(lastSeenTimestamp && invoice.created_at && invoice.created_at > lastSeenTimestamp)}
                      />
                    ))}
                  </div>
                ) : (
                  <InvoiceTable invoices={filteredInvoices} lastSeenTimestamp={lastSeenTimestamp} clientPortalEmail={activeCompany?.client_portal_email} />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {activeCompanyId && (
        <UploadInvoiceModal
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
          companyId={activeCompanyId}
          invoiceType={activeTab}
        />
      )}
    </AppLayout>
  );
};

export default Index;
