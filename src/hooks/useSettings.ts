import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useTestConnection() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").select("id").limit(1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Połączenie udane", {
        description: "Baza danych odpowiada poprawnie.",
      });
    },
    onError: () => {
      toast.error("Połączenie nieudane", {
        description: "Nie można połączyć się z bazą danych.",
      });
    },
  });
}
