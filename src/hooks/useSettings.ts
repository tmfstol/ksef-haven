import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AppSettings } from "@/types/settings";

const API_BASE = "http://localhost:4000/api";

export function useSettings() {
  return useQuery<AppSettings | null>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch settings");
      }
      return res.json();
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: AppSettings) => {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Ustawienia zapisane", {
        description: "Konfiguracja została pomyślnie zaktualizowana.",
      });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => {
      toast.error("Nie udało się zapisać ustawień", {
        description: "Nie można połączyć się z lokalnym serwerem. Sprawdź czy jest uruchomiony.",
      });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error("Connection failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Połączenie udane", {
        description: "Lokalny serwer odpowiada poprawnie.",
      });
    },
    onError: () => {
      toast.error("Połączenie nieudane", {
        description: "Nie można połączyć się z serwerem na localhost:4000.",
      });
    },
  });
}
