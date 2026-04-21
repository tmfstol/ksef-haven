import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Invoice, Vendor } from "@/types/invoice";

export function useInvoices(companyId?: string | null) {
  return useQuery<Invoice[]>({
    queryKey: ["invoices", companyId],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*")
        .order("date", { ascending: false });

      if (companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map((row) => ({
        id: row.id,
        company_id: row.company_id,
        date: row.date,
        vendor: row.vendor,
        nip: row.nip,
        gross_amount: Number(row.gross_amount),
        status: row.status,
        invoice_type: row.invoice_type || "kosztowa",
        xml_path: row.xml_path,
        pdf_path: row.pdf_path,
        ksef_number: row.ksef_number,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })) as Invoice[];
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSync(companyId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: { dateFrom?: string; dateTo?: string }) => {
      const { data, error } = await supabase.functions.invoke("ksef-sync", {
        body: {
          company_id: companyId,
          date_from: params?.dateFrom || null,
          date_to: params?.dateTo || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const newCount = data?.summary?.totalNewInvoices ?? 0;
      toast.success("Synchronizacja zakończona", {
        description: newCount > 0
          ? `Pobrano ${newCount} nowych faktur z KSeF.`
          : "Brak nowych faktur w wybranym zakresie. Aby pobrać starsze, kliknij ikonę kalendarza i wybierz większy zakres dat.",
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error("Błąd synchronizacji z KSeF", {
        description: error.message || "Sprawdź token KSeF w ustawieniach firmy.",
      });
    },
  });
}

export function extractVendors(invoices: Invoice[] | undefined): Vendor[] {
  if (!invoices) return [];
  const map = new Map<string, Vendor>();
  for (const inv of invoices) {
    const existing = map.get(inv.nip);
    if (existing) {
      existing.invoiceCount++;
    } else {
      map.set(inv.nip, { name: inv.vendor, nip: inv.nip, invoiceCount: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
