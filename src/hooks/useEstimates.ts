import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Branza } from "./useMasterCatalog";

export interface Estimate {
  id: string;
  company_id: string;
  project_id: string | null;
  nazwa_kosztorysu: string;
  branza: Branza;
  marza_material: number;
  marza_robocizna: number;
  status: "draft" | "sent" | "accepted" | "rejected" | "archived";
  client_name: string | null;
  notes: string | null;
  suma_material: number;
  suma_robocizna: number;
  suma_sprzet: number;
  // KNR / Norma PRO
  inwestor_nazwa: string | null;
  inwestor_adres: string | null;
  wykonawca_nazwa: string | null;
  wykonawca_adres: string | null;
  lokalizacja_obiektu: string | null;
  podstawa_opracowania: string | null;
  narzut_kp_proc: number;     // koszty pośrednie (od R+S)
  narzut_zysk_proc: number;   // zysk (od R+S+Kp)
  vat_proc: number;
  data_kosztorysu: string | null;
  created_at: string;
  updated_at: string;
}

export interface EstimateStage {
  id: string;
  estimate_id: string;
  ordinal: number;
  name: string;
  description: string | null;
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  stage_id: string | null;
  catalog_id: string | null;
  ordinal: number;
  nazwa: string;
  jednostka: string;
  ilosc: number;
  cena_mat: number;
  cena_rob: number;
  cena_sprz: number;
  wymiary: string | null;
  notes: string | null;
  // KNR
  knr_number: string | null;
  opis_pelny: string | null;
  naklad_robocizny: number;  // r-g / jm
  naklad_materialu: number;  // jm mat / jm rob
  naklad_sprzetu: number;    // m-g / jm
  stawka_rg: number;
  // Wartości obliczone (denormalizacja, do RMS)
  wartosc_r: number;
  wartosc_m: number;
  wartosc_s: number;
}

export function useEstimates(companyId: string | null) {
  return useQuery<Estimate[]>({
    queryKey: ["estimates", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates" as any)
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Estimate[];
    },
  });
}

export function useEstimate(id: string | null) {
  return useQuery<Estimate | null>({
    queryKey: ["estimate", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates" as any).select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as unknown as Estimate) ?? null;
    },
  });
}

export function useEstimateStages(estimateId: string | null) {
  return useQuery<EstimateStage[]>({
    queryKey: ["estimate_stages", estimateId],
    enabled: !!estimateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_stages" as any)
        .select("*")
        .eq("estimate_id", estimateId!)
        .order("ordinal", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EstimateStage[];
    },
  });
}

export function useEstimateItems(estimateId: string | null) {
  return useQuery<EstimateItem[]>({
    queryKey: ["estimate_items", estimateId],
    enabled: !!estimateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimate_items" as any)
        .select("*")
        .eq("estimate_id", estimateId!)
        .order("ordinal", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as EstimateItem[];
    },
  });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      company_id: string;
      nazwa_kosztorysu: string;
      branza: Branza;
      project_id?: string | null;
      client_name?: string | null;
      marza_material?: number;
      marza_robocizna?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("estimates" as any).insert({
        company_id: params.company_id,
        nazwa_kosztorysu: params.nazwa_kosztorysu,
        branza: params.branza,
        project_id: params.project_id ?? null,
        client_name: params.client_name ?? null,
        marza_material: params.marza_material ?? 20,
        marza_robocizna: params.marza_robocizna ?? 30,
        created_by: user?.id ?? null,
      }).select("*").single();
      if (error) throw error;
      // Default first stage
      await supabase.from("estimate_stages" as any).insert({
        estimate_id: (data as any).id,
        ordinal: 1,
        name: "Etap 1",
      });
      return data as unknown as Estimate;
    },
    onSuccess: () => {
      toast.success("Kosztorys utworzony");
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
    onError: (e: any) => toast.error("Błąd tworzenia", { description: e.message }),
  });
}

export function useUpdateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; patch: Partial<Estimate> }) => {
      const { error } = await supabase.from("estimates" as any).update(params.patch as any).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate", vars.id] });
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

export function useDeleteEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estimates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kosztorys usunięty");
      qc.invalidateQueries({ queryKey: ["estimates"] });
    },
  });
}

export function useAddStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { estimate_id: string; name: string; ordinal: number }) => {
      const { data, error } = await supabase.from("estimate_stages" as any).insert({
        estimate_id: params.estimate_id,
        name: params.name,
        ordinal: params.ordinal,
      }).select("*").single();
      if (error) throw error;
      return data as unknown as EstimateStage;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["estimate_stages", vars.estimate_id] }),
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; estimate_id: string; patch: Partial<EstimateStage> }) => {
      const { error } = await supabase.from("estimate_stages" as any).update(params.patch as any).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["estimate_stages", vars.estimate_id] }),
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; estimate_id: string }) => {
      const { error } = await supabase.from("estimate_stages" as any).delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["estimate_stages", vars.estimate_id] });
      qc.invalidateQueries({ queryKey: ["estimate_items", vars.estimate_id] });
    },
  });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<EstimateItem> & { estimate_id: string }) => {
      const { data, error } = await supabase.from("estimate_items" as any).insert({
        estimate_id: item.estimate_id,
        stage_id: item.stage_id ?? null,
        catalog_id: item.catalog_id ?? null,
        ordinal: item.ordinal ?? 1,
        nazwa: item.nazwa ?? "Pozycja",
        jednostka: item.jednostka ?? "szt",
        ilosc: item.ilosc ?? 1,
        cena_mat: item.cena_mat ?? 0,
        cena_rob: item.cena_rob ?? 0,
        cena_sprz: item.cena_sprz ?? 0,
        wymiary: item.wymiary ?? null,
        knr_number: item.knr_number ?? null,
        opis_pelny: item.opis_pelny ?? null,
        naklad_robocizny: item.naklad_robocizny ?? 0,
        naklad_materialu: item.naklad_materialu ?? 1,
        naklad_sprzetu: item.naklad_sprzetu ?? 0,
        stawka_rg: item.stawka_rg ?? 25,
        wartosc_r: item.wartosc_r ?? 0,
        wartosc_m: item.wartosc_m ?? 0,
        wartosc_s: item.wartosc_s ?? 0,
      }).select("*").single();
      if (error) throw error;
      return data as unknown as EstimateItem;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["estimate_items", vars.estimate_id] }),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; estimate_id: string; patch: Partial<EstimateItem> }) => {
      const { error } = await supabase.from("estimate_items" as any).update(params.patch as any).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["estimate_items", vars.estimate_id] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; estimate_id: string }) => {
      const { error } = await supabase.from("estimate_items" as any).delete().eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["estimate_items", vars.estimate_id] }),
  });
}
