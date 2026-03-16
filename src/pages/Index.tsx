import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoices, useSync, extractVendors } from "@/hooks/useInvoices";
import { useCompanies, useSyncAllCompanies } from "@/hooks/useCompanies";
import { VendorSidebar } from "@/components/dashboard/VendorSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { Loader2 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: invoices, isLoading, isError, refetch } = useInvoices(activeCompanyId);
  const syncMutation = useSync();
  const syncAllMutation = useSyncAllCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [selectedNip, setSelectedNip] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Redirect to onboarding if no companies configured
  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

  // Auto-select first company
  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(companies[0].id);
    }
  }, [companies, activeCompanyId]);

  const activeCompany = useMemo(
    () => companies?.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const vendors = useMemo(() => extractVendors(invoices), [invoices]);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    let result = invoices;
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
    return result;
  }, [invoices, activeCompany, selectedNip, searchQuery]);

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

        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin-slow text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Ładowanie faktur...</p>
              </div>
            </div>
          ) : isError || !invoices || invoices.length === 0 ? (
            <EmptyState isError={isError} onRetry={() => refetch()} />
          ) : (
            <>
              <StatsBar invoices={filteredInvoices} />
              <InvoiceTable invoices={filteredInvoices} />
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
