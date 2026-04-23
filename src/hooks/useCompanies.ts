import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/company";

export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      // 1) Try full companies (owners/admins)
      const { data: ownData, error: ownErr } = await supabase
        .from("companies")
        .select("id, name, nip, storage_path, is_active, created_at, updated_at, user_id, street, city, postal_code, country_code, bank_name, bank_account, email, phone, invoice_pattern, client_portal_email, make_webhook_url")
        .order("created_at", { ascending: true });
      if (ownErr) throw ownErr;

      // 2) Also fetch companies the user has access to via user_roles (invited members)
      //    Use companies_safe view which excludes sensitive ksef_token
      const { data: { user } } = await supabase.auth.getUser();
      let merged: Company[] = (ownData || []) as Company[];

      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("company_id")
          .eq("user_id", user.id);

        const ownedIds = new Set(merged.map((c) => c.id));
        const roleCompanyIds = (roles || [])
          .map((r: any) => r.company_id)
          .filter((id: string) => !ownedIds.has(id));

        if (roleCompanyIds.length > 0) {
          const { data: safeData, error: safeErr } = await supabase
            .from("companies_safe")
            .select("id, name, nip, storage_path, is_active, created_at, updated_at, user_id, street, city, postal_code, country_code, email, phone, invoice_pattern, client_portal_email")
            .in("id", roleCompanyIds);
          if (safeErr) throw safeErr;
          merged = [...merged, ...((safeData || []) as unknown as Company[])];
        }
      }

      // Sort by created_at ascending
      merged.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return da - db;
      });
      return merged;
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAddCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: {
      name: string; nip: string; ksefToken: string; storagePath: string;
      street?: string | null; city?: string | null; postalCode?: string | null; countryCode?: string;
      bankName?: string | null; bankAccount?: string | null; email?: string | null; phone?: string | null;
      invoicePattern?: string; clientPortalEmail?: string | null; makeWebhookUrl?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nie zalogowano");
      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: company.name,
          nip: company.nip,
          ksef_token: company.ksefToken,
          storage_path: company.storagePath,
          user_id: user.id,
          street: company.street,
          city: company.city,
          postal_code: company.postalCode,
          country_code: company.countryCode || "PL",
          bank_name: company.bankName,
          bank_account: company.bankAccount,
          email: company.email,
          phone: company.phone,
          invoice_pattern: company.invoicePattern || "FV/{NNN}/{MM}/{RRRR}",
          client_portal_email: company.clientPortalEmail || null,
          make_webhook_url: company.makeWebhookUrl || null,
        } as any)
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
    mutationFn: async (company: {
      id: string; name: string; nip: string; ksefToken?: string; storagePath: string;
      street?: string | null; city?: string | null; postalCode?: string | null; countryCode?: string;
      bankName?: string | null; bankAccount?: string | null; email?: string | null; phone?: string | null;
      invoicePattern?: string; clientPortalEmail?: string | null; makeWebhookUrl?: string | null;
    }) => {
      const updatePayload: any = {
        name: company.name,
        nip: company.nip,
        storage_path: company.storagePath,
        street: company.street,
        city: company.city,
        postal_code: company.postalCode,
        country_code: company.countryCode || "PL",
        bank_name: company.bankName,
        bank_account: company.bankAccount,
        email: company.email,
        phone: company.phone,
        invoice_pattern: company.invoicePattern || "FV/{NNN}/{MM}/{RRRR}",
        client_portal_email: company.clientPortalEmail || null,
        make_webhook_url: company.makeWebhookUrl || null,
      };
      // Only update ksef_token if user provided a new value
      if (company.ksefToken && company.ksefToken.trim() && company.ksefToken !== "••••••••") {
        updatePayload.ksef_token = company.ksefToken;
      }
      const { data, error } = await supabase
        .from("companies")
        .update(updatePayload)
        .eq("id", company.id)
        .select("id, name, nip, storage_path, is_active, created_at, updated_at, user_id, street, city, postal_code, country_code, bank_name, bank_account, email, phone, invoice_pattern, client_portal_email, make_webhook_url")
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
    mutationFn: async (params?: { dateFrom?: string; dateTo?: string }) => {
      const { data, error } = await supabase.functions.invoke("ksef-sync", {
        body: {
          date_from: params?.dateFrom || null,
          date_to: params?.dateTo || null,
        },
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
