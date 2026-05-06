import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches display_name/email for a list of user_ids in one go.
 * Returns a map: user_id -> friendly label.
 */
export function useProfileNames(userIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort();
  const key = ids.join(",");

  return useQuery({
    queryKey: ["profile-names", key],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", ids);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row) => {
        map[row.user_id] = row.display_name || row.email || "Użytkownik";
      });
      return map;
    },
  });
}
