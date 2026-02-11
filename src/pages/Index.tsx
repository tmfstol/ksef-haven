import { useState, useMemo } from "react";
import { useInvoices, useSync, extractVendors } from "@/hooks/useInvoices";
import { VendorSidebar } from "@/components/dashboard/VendorSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { data: invoices, isLoading, isError, refetch } = useInvoices();
  const syncMutation = useSync();
  const [selectedNip, setSelectedNip] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
  }, [invoices, selectedNip, searchQuery]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <VendorSidebar
        vendors={vendors}
        selectedNip={selectedNip}
        onSelectVendor={setSelectedNip}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader
          isConnected={!isError}
          isSyncing={syncMutation.isPending}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSync={() => syncMutation.mutate()}
        />

        <main className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin-slow text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading invoices...</p>
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
