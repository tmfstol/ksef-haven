import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  budget: number | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  expense_count?: number;
  total_invoices?: number;
  total_expenses?: number;
}

export function useProjects(companyId?: string | null) {
  return useQuery<Project[]>({
    queryKey: ["projects", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get counts
      const projectIds = (data as any[]).map((p) => p.id);
      if (projectIds.length === 0) return data as Project[];

      const { data: invData } = await supabase
        .from("invoices")
        .select("project_id, gross_amount")
        .in("project_id", projectIds);

      const { data: expData } = await supabase
        .from("expenses")
        .select("project_id, amount")
        .in("project_id", projectIds);

      const invMap = new Map<string, { count: number; total: number }>();
      const expMap = new Map<string, { count: number; total: number }>();

      (invData || []).forEach((i: any) => {
        const e = invMap.get(i.project_id) || { count: 0, total: 0 };
        e.count++;
        e.total += Number(i.gross_amount);
        invMap.set(i.project_id, e);
      });

      (expData || []).forEach((i: any) => {
        const e = expMap.get(i.project_id) || { count: 0, total: 0 };
        e.count++;
        e.total += Number(i.amount);
        expMap.set(i.project_id, e);
      });

      return (data as any[]).map((p) => ({
        ...p,
        budget: p.budget ? Number(p.budget) : null,
        invoice_count: invMap.get(p.id)?.count || 0,
        total_invoices: invMap.get(p.id)?.total || 0,
        expense_count: expMap.get(p.id)?.count || 0,
        total_expenses: expMap.get(p.id)?.total || 0,
      })) as Project[];
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: { company_id: string; name: string; description?: string; color?: string; budget?: number; parent_id?: string | null }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert(project as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Projekt utworzony");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast.error("Nie udało się utworzyć projektu"),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projekt usunięty");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast.error("Nie udało się usunąć projektu"),
  });
}

export function useAssignInvoiceToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, projectId }: { invoiceId: string; projectId: string | null }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ project_id: projectId } as any)
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Faktura przypisana do projektu");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toast.error("Nie udało się przypisać faktury"),
  });
}

export function useProjectInvoices(projectId?: string | null) {
  return useQuery({
    queryKey: ["project_invoices", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({ ...r, gross_amount: Number(r.gross_amount) }));
    },
  });
}

export function useProjectExpenses(projectId?: string | null) {
  return useQuery({
    queryKey: ["project_expenses", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("project_id", projectId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({ ...r, amount: Number(r.amount) }));
    },
  });
}
