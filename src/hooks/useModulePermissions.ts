import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanies } from "@/hooks/useCompanies";

export type ModuleKey =
  | "invoices_cost" | "invoices_revenue" | "expenses" | "projects"
  | "analytics" | "taxes" | "bank" | "contacts"
  | "calendar" | "drive" | "sheets" | "gmail" | "meet" | "workspace";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  invoices_cost: "Faktury kosztowe",
  invoices_revenue: "Faktury sprzedażowe",
  expenses: "Wydatki",
  projects: "Projekty",
  analytics: "Analityka",
  taxes: "Podatki",
  bank: "Bank",
  contacts: "Kontakty",
  calendar: "Kalendarz",
  drive: "Dysk Google",
  sheets: "Arkusze Google",
  gmail: "Gmail",
  meet: "Google Meet",
  workspace: "Workspace",
};

export const MODULE_GROUPS: { title: string; modules: ModuleKey[] }[] = [
  { title: "Finanse", modules: ["invoices_cost", "invoices_revenue", "expenses", "taxes", "bank"] },
  { title: "Operacje", modules: ["projects", "contacts", "analytics"] },
  { title: "Workspace Google", modules: ["workspace", "calendar", "drive", "sheets", "gmail", "meet"] },
];

function getActiveCompanyId(companies: any[] | undefined): string | null {
  if (!companies || companies.length === 0) return null;
  return companies.find((c) => c.is_active)?.id ?? companies[0].id;
}

export function useMyModulePermissions() {
  const { user } = useAuth();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const companyId = getActiveCompanyId(companies);

  const query = useQuery({
    queryKey: ["my-module-permissions", user?.id, companyId],
    enabled: !!user?.id && !!companyId,
    queryFn: async (): Promise<Record<string, boolean>> => {
      // Owner shortcut: jeśli user jest właścicielem firmy, ma wszystko
      const owned = companies?.find((c) => c.id === companyId)?.user_id === user?.id;
      if (owned) {
        return Object.fromEntries(Object.keys(MODULE_LABELS).map((m) => [m, true]));
      }
      const { data, error } = await supabase
        .from("module_permissions")
        .select("module, enabled")
        .eq("user_id", user!.id)
        .eq("company_id", companyId!);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((r: any) => { map[r.module] = !!r.enabled; });
      return map;
    },
  });

  return {
    ...query,
    isLoading: companiesLoading || (!!user?.id && !!companyId && query.isLoading),
    isPending: companiesLoading || query.isPending,
  };
}

export function useHasModule(module: ModuleKey): { allowed: boolean; loading: boolean } {
  const { user } = useAuth();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data, isLoading } = useMyModulePermissions();

  // Still resolving auth or companies
  if (!user || companiesLoading || isLoading) {
    return { allowed: false, loading: true };
  }

  // Owner shortcut at the consumer level too — never block owner
  const companyId = getActiveCompanyId(companies);
  const owned = companies?.find((c) => c.id === companyId)?.user_id === user.id;
  if (owned) return { allowed: true, loading: false };

  return { allowed: !!data?.[module], loading: false };
}
