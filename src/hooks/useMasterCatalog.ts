import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Branza = "Budowlanka" | "Instalacje" | "Meble";

export interface CatalogItem {
  id: string;
  company_id: string;
  branza: Branza;
  kategoria: string;
  nazwa: string;
  jednostka: string;
  cena_zakupu_materialu: number;
  cena_robocizny_netto: number;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useMasterCatalog(companyId: string | null, branza?: Branza | "all") {
  return useQuery<CatalogItem[]>({
    queryKey: ["master_catalog", companyId, branza ?? "all"],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("master_catalog" as any)
        .select("*")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("branza", { ascending: true })
        .order("kategoria", { ascending: true })
        .order("nazwa", { ascending: true });
      if (branza && branza !== "all") q = q.eq("branza", branza);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CatalogItem[];
    },
  });
}

export function useUpsertCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Partial<CatalogItem> & { company_id: string }) => {
      if (item.id) {
        const { error } = await supabase.from("master_catalog" as any).update({
          branza: item.branza,
          kategoria: item.kategoria,
          nazwa: item.nazwa,
          jednostka: item.jednostka,
          cena_zakupu_materialu: item.cena_zakupu_materialu ?? 0,
          cena_robocizny_netto: item.cena_robocizny_netto ?? 0,
          notes: item.notes ?? null,
          active: item.active ?? true,
        }).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_catalog" as any).insert({
          company_id: item.company_id,
          branza: item.branza ?? "Budowlanka",
          kategoria: item.kategoria ?? "Ogólne",
          nazwa: item.nazwa ?? "Nowa pozycja",
          jednostka: item.jednostka ?? "szt",
          cena_zakupu_materialu: item.cena_zakupu_materialu ?? 0,
          cena_robocizny_netto: item.cena_robocizny_netto ?? 0,
          notes: item.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master_catalog"] }),
    onError: (e: any) => toast.error("Błąd zapisu", { description: e.message }),
  });
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("master_catalog" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pozycja usunięta");
      qc.invalidateQueries({ queryKey: ["master_catalog"] });
    },
    onError: (e: any) => toast.error("Nie udało się usunąć", { description: e.message }),
  });
}

const SEED: Omit<CatalogItem, "id" | "company_id" | "created_at" | "updated_at" | "active" | "notes">[] = [
  // Budowlanka
  { branza: "Budowlanka", kategoria: "Materiały sypkie", nazwa: "Cement portlandzki 25kg", jednostka: "szt", cena_zakupu_materialu: 22, cena_robocizny_netto: 0 },
  { branza: "Budowlanka", kategoria: "Materiały sypkie", nazwa: "Piasek płukany", jednostka: "m3", cena_zakupu_materialu: 90, cena_robocizny_netto: 0 },
  { branza: "Budowlanka", kategoria: "Materiały sypkie", nazwa: "Żwir 8-16mm", jednostka: "m3", cena_zakupu_materialu: 110, cena_robocizny_netto: 0 },
  { branza: "Budowlanka", kategoria: "Mury", nazwa: "Pustak ceramiczny 25cm", jednostka: "szt", cena_zakupu_materialu: 6.5, cena_robocizny_netto: 4 },
  { branza: "Budowlanka", kategoria: "Tynki", nazwa: "Tynk gipsowy maszynowy", jednostka: "m2", cena_zakupu_materialu: 8, cena_robocizny_netto: 35 },
  { branza: "Budowlanka", kategoria: "Posadzki", nazwa: "Wylewka anhydrytowa 5cm", jednostka: "m2", cena_zakupu_materialu: 35, cena_robocizny_netto: 25 },
  { branza: "Budowlanka", kategoria: "Posadzki", nazwa: "Płytki ceramiczne 60x60", jednostka: "m2", cena_zakupu_materialu: 55, cena_robocizny_netto: 80 },
  { branza: "Budowlanka", kategoria: "Malowanie", nazwa: "Malowanie ścian 2x", jednostka: "m2", cena_zakupu_materialu: 3, cena_robocizny_netto: 18 },
  { branza: "Budowlanka", kategoria: "Robocizna", nazwa: "Roboczogodzina mistrza", jednostka: "godz", cena_zakupu_materialu: 0, cena_robocizny_netto: 90 },
  { branza: "Budowlanka", kategoria: "Robocizna", nazwa: "Roboczogodzina pomocnika", jednostka: "godz", cena_zakupu_materialu: 0, cena_robocizny_netto: 50 },
  // Instalacje
  { branza: "Instalacje", kategoria: "Elektryka", nazwa: "Punkt elektryczny gniazdo 230V", jednostka: "szt", cena_zakupu_materialu: 35, cena_robocizny_netto: 60 },
  { branza: "Instalacje", kategoria: "Elektryka", nazwa: "Punkt oświetleniowy", jednostka: "szt", cena_zakupu_materialu: 25, cena_robocizny_netto: 55 },
  { branza: "Instalacje", kategoria: "Elektryka", nazwa: "Przewód YDYp 3x1.5mm²", jednostka: "mb", cena_zakupu_materialu: 4, cena_robocizny_netto: 6 },
  { branza: "Instalacje", kategoria: "Elektryka", nazwa: "Rozdzielnia 12-modułowa", jednostka: "szt", cena_zakupu_materialu: 180, cena_robocizny_netto: 250 },
  { branza: "Instalacje", kategoria: "Hydraulika", nazwa: "Punkt wodny zimna+ciepła", jednostka: "szt", cena_zakupu_materialu: 80, cena_robocizny_netto: 120 },
  { branza: "Instalacje", kategoria: "Hydraulika", nazwa: "Rura PEX 16mm", jednostka: "mb", cena_zakupu_materialu: 6, cena_robocizny_netto: 8 },
  { branza: "Instalacje", kategoria: "Hydraulika", nazwa: "Punkt kanalizacyjny", jednostka: "szt", cena_zakupu_materialu: 60, cena_robocizny_netto: 130 },
  { branza: "Instalacje", kategoria: "CO", nazwa: "Grzejnik panelowy 600x1000", jednostka: "szt", cena_zakupu_materialu: 320, cena_robocizny_netto: 180 },
  { branza: "Instalacje", kategoria: "CO", nazwa: "Rura miedziana 18mm", jednostka: "mb", cena_zakupu_materialu: 28, cena_robocizny_netto: 22 },
  { branza: "Instalacje", kategoria: "Robocizna", nazwa: "Roboczogodzina instalator", jednostka: "godz", cena_zakupu_materialu: 0, cena_robocizny_netto: 110 },
  // Meble
  { branza: "Meble", kategoria: "Płyty", nazwa: "Płyta MDF lakier mat 19mm", jednostka: "m2", cena_zakupu_materialu: 280, cena_robocizny_netto: 120 },
  { branza: "Meble", kategoria: "Płyty", nazwa: "Płyta laminowana 18mm", jednostka: "m2", cena_zakupu_materialu: 95, cena_robocizny_netto: 80 },
  { branza: "Meble", kategoria: "Blaty", nazwa: "Blat kompozytowy 38mm", jednostka: "mb", cena_zakupu_materialu: 420, cena_robocizny_netto: 150 },
  { branza: "Meble", kategoria: "Okucia", nazwa: "Zawias Blum CLIP top", jednostka: "szt", cena_zakupu_materialu: 18, cena_robocizny_netto: 8 },
  { branza: "Meble", kategoria: "Okucia", nazwa: "Prowadnica Blum LEGRABOX", jednostka: "kpl", cena_zakupu_materialu: 220, cena_robocizny_netto: 25 },
  { branza: "Meble", kategoria: "Okucia", nazwa: "Uchwyt aluminiowy 160mm", jednostka: "szt", cena_zakupu_materialu: 22, cena_robocizny_netto: 5 },
  { branza: "Meble", kategoria: "Akcesoria", nazwa: "Cargo do szafki 30cm", jednostka: "szt", cena_zakupu_materialu: 480, cena_robocizny_netto: 60 },
  { branza: "Meble", kategoria: "Akcesoria", nazwa: "Oświetlenie LED pod szafką", jednostka: "mb", cena_zakupu_materialu: 65, cena_robocizny_netto: 40 },
  { branza: "Meble", kategoria: "Montaż", nazwa: "Montaż zabudowy kuchennej", jednostka: "mb", cena_zakupu_materialu: 0, cena_robocizny_netto: 350 },
  { branza: "Meble", kategoria: "Robocizna", nazwa: "Roboczogodzina stolarz", jednostka: "godz", cena_zakupu_materialu: 0, cena_robocizny_netto: 100 },
];

export function useImportSeedCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const rows = SEED.map((s) => ({ ...s, company_id: companyId }));
      const { error } = await supabase.from("master_catalog" as any).insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Zaimportowano ${n} pozycji`);
      qc.invalidateQueries({ queryKey: ["master_catalog"] });
    },
    onError: (e: any) => toast.error("Błąd importu", { description: e.message }),
  });
}
