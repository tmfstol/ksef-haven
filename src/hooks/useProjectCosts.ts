import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectCost {
  id: string;
  company_id: string;
  invoice_id: string;
  project_id: string;
  invoice_item_id: string | null;
  item_name: string | null;
  net_amount: number;
  gross_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCostInput {
  invoice_item_id?: string | null;
  item_name?: string | null;
  project_id: string;
  net_amount: number;
  gross_amount: number;
  note?: string | null;
}

/** All cost allocations for a single invoice (used in split dialog). */
export function useInvoiceProjectCosts(invoiceId?: string | null) {
  return useQuery<ProjectCost[]>({
    queryKey: ["project_costs", "by_invoice", invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_costs")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        net_amount: Number(r.net_amount),
        gross_amount: Number(r.gross_amount),
      })) as ProjectCost[];
    },
  });
}

/** All cost allocations attributed to a project (used in project detail). */
export function useProjectCostsByProject(projectId?: string | null) {
  return useQuery({
    queryKey: ["project_costs", "by_project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_costs")
        .select("*, invoices(vendor, nip, date, ksef_number)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        net_amount: Number(r.net_amount),
        gross_amount: Number(r.gross_amount),
      }));
    },
  });
}

/** Replace all allocations for an invoice with the provided list (atomic save). */
export function useSaveInvoiceCostSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoice_id,
      company_id,
      allocations,
    }: {
      invoice_id: string;
      company_id: string;
      allocations: ProjectCostInput[];
    }) => {
      // Wipe existing splits for this invoice, then insert fresh ones
      const { error: delErr } = await supabase
        .from("project_costs")
        .delete()
        .eq("invoice_id", invoice_id);
      if (delErr) throw delErr;

      if (allocations.length === 0) return;

      const rows = allocations.map((a) => ({
        invoice_id,
        company_id,
        project_id: a.project_id,
        invoice_item_id: a.invoice_item_id ?? null,
        item_name: a.item_name ?? null,
        net_amount: a.net_amount,
        gross_amount: a.gross_amount,
        note: a.note ?? null,
      }));

      const { error: insErr } = await supabase.from("project_costs").insert(rows as any);
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Rozdzielenie kosztów zapisane");
      qc.invalidateQueries({ queryKey: ["project_costs"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: any) => toast.error(err?.message || "Nie udało się zapisać rozdzielenia"),
  });
}
