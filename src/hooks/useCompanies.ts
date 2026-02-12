import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Company } from "@/types/company";

const API_BASE = "http://localhost:4000/api";

export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/companies`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error("Failed to fetch companies");
      }
      return res.json();
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAddCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: Omit<Company, "id">) => {
      const res = await fetch(`${API_BASE}/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      if (!res.ok) throw new Error("Failed to add company");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Firma dodana", {
        description: "Nowa firma została pomyślnie dodana.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      toast.error("Nie udało się dodać firmy", {
        description: "Sprawdź połączenie z serwerem.",
      });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: Company) => {
      const res = await fetch(`${API_BASE}/companies/${company.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(company),
      });
      if (!res.ok) throw new Error("Failed to update company");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Firma zaktualizowana", {
        description: "Dane firmy zostały zapisane.",
      });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      toast.error("Nie udało się zaktualizować firmy", {
        description: "Sprawdź połączenie z serwerem.",
      });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch(`${API_BASE}/companies/${companyId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete company");
      return res.json();
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
      const res = await fetch(`${API_BASE}/sync/all`, { method: "POST" });
      if (!res.ok) throw new Error("Sync all failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Synchronizacja wszystkich firm zakończona", {
        description: "Faktury ze wszystkich firm zostały zsynchronizowane.",
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => {
      toast.error("Synchronizacja nieudana", {
        description: "Nie udało się zsynchronizować wszystkich firm.",
      });
    },
  });
}
