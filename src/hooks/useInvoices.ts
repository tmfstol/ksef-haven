import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Invoice, Vendor } from "@/types/invoice";

const API_BASE = "http://localhost:4000/api";

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/invoices`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/sync`, { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Synchronizacja zakończona", {
        description: "Wszystkie faktury zostały zsynchronizowane z KSeF.",
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => {
      toast.error("Synchronizacja nieudana", {
        description: "Nie można połączyć się z KSeF. Sprawdź swój token.",
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
