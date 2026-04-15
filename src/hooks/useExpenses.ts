import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface Expense {
  id: string;
  company_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  date: string;
  vendor_name: string | null;
  description: string | null;
  document_path: string | null;
  ocr_status: string;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_color?: string;
}

export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
}

export function useExpenses(companyId?: string | null) {
  return useQuery<Expense[]>({
    queryKey: ["expenses", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("company_id", companyId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        amount: Number(r.amount),
      }));
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useExpenseCategories() {
  return useQuery<ExpenseCategory[]>({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: {
      company_id: string;
      amount: number;
      date: string;
      vendor_name?: string;
      description?: string;
      category_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("expenses")
        .insert(expense as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Wydatek dodany");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: () => toast.error("Nie udało się dodać wydatku"),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wydatek usunięty");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: () => toast.error("Nie udało się usunąć wydatku"),
  });
}

export function useAddExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cat: { name: string; color?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowano");
      const { data, error } = await supabase
        .from("expense_categories")
        .insert({ name: cat.name, color: cat.color || "#6366f1", user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Kategoria dodana");
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
    },
    onError: () => toast.error("Nie udało się dodać kategorii"),
  });
}
