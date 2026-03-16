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

export function useSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("http://localhost:4000/api/sync", { method: "POST" });
      if (!res.ok) throw new Error("LOCAL_SYNC_FAILED");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Synchronizacja zakończona", {
        description: "Faktury zostały pobrane i zapisane w bazie danych.",
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => {
      toast.error("Synchronizacja lokalna niedostępna", {
        description:
          "Token KSeF może być zapisany poprawnie, ale pobieranie faktur nadal wymaga lokalnego modułu synchronizacji na localhost:4000.",
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
