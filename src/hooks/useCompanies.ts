import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/company";

export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Company[];
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAddCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: { name: string; nip: string; ksefToken: string; storagePath: string }) => {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: company.name,
          nip: company.nip,
          ksef_token: company.ksefToken,
          storage_path: company.storagePath,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Firma dodana", {
        description: "Nowa firma została pomyślnie dodana.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: () => {
      toast.error("Nie udało się dodać firmy", {
        description: "Sprawdź połączenie z bazą danych.",
      });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: { id: string; name: string; nip: string; ksefToken: string; storagePath: string }) => {
      const { data, error } = await supabase
        .from("companies")
        .update({
          name: company.name,
          nip: company.nip,
          ksef_token: company.ksefToken,
          storage_path: company.storagePath,
        })
        .eq("id", company.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Firma zaktualizowana", {
        description: "Dane firmy zostały zapisane.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować firmy", {
        description: "Sprawdź połączenie z bazą danych.",
      });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Firma usunięta", {
        description: "Firma została usunięta z systemu.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: () => {
      toast.error("Nie udało się usunąć firmy");
    },
  });
}

export function useSyncAllCompanies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ksef-sync", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const newCount = data?.summary?.totalNewInvoices ?? 0;
      const companyCount = data?.summary?.totalCompanies ?? 0;
      toast.success("Synchronizacja wszystkich firm zakończona", {
        description: newCount > 0
          ? `Pobrano ${newCount} nowych faktur z ${companyCount} firm.`
          : `Brak nowych faktur w ${companyCount} firmach.`,
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error: Error) => {
      toast.error("Błąd synchronizacji z KSeF", {
        description: error.message || "Sprawdź tokeny KSeF w ustawieniach firm.",
      });
    },
  });
}
