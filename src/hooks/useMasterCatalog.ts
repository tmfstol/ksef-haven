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
  cena_zakupu_materialu: number;   // cena 1 jm materiału (M)
  cena_robocizny_netto: number;     // cena R za jednostkę pozycji (jeśli używana bez nakładów)
  cena_sprzetu_netto: number;       // cena 1 m-g sprzętu
  // KNR
  knr_number: string | null;
  knr_chapter: string | null;
  opis_pelny: string | null;
  naklad_robocizny: number;   // r-g/jm
  naklad_materialu: number;   // jm mat / jm robót
  naklad_sprzetu: number;     // m-g/jm
  stawka_rg: number;          // stawka roboczogodziny (zł/r-g)
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
        .order("knr_chapter", { ascending: true, nullsFirst: false })
        .order("knr_number", { ascending: true, nullsFirst: false })
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
      const payload: any = {
        branza: item.branza,
        kategoria: item.kategoria,
        nazwa: item.nazwa,
        jednostka: item.jednostka,
        cena_zakupu_materialu: item.cena_zakupu_materialu ?? 0,
        cena_robocizny_netto: item.cena_robocizny_netto ?? 0,
        cena_sprzetu_netto: item.cena_sprzetu_netto ?? 0,
        knr_number: item.knr_number ?? null,
        knr_chapter: item.knr_chapter ?? null,
        opis_pelny: item.opis_pelny ?? null,
        naklad_robocizny: item.naklad_robocizny ?? 0,
        naklad_materialu: item.naklad_materialu ?? 1,
        naklad_sprzetu: item.naklad_sprzetu ?? 0,
        stawka_rg: item.stawka_rg ?? 25,
        notes: item.notes ?? null,
        active: item.active ?? true,
      };
      if (item.id) {
        const { error } = await supabase.from("master_catalog" as any).update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("master_catalog" as any).insert({ ...payload, company_id: item.company_id });
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

// =====================================================================
// SEED KNR — Wielkopolski Cennik Usług Budowlanych (skrócona baza)
// Format: knr_number = "KNR <katalog> <tablica>-<kolumna>" (np. "KNR 2-02 0101-01")
// naklad_robocizny w r-g/jm, naklad_materialu w jm/jm robót, naklad_sprzetu w m-g/jm
// =====================================================================
type Seed = Omit<CatalogItem, "id" | "company_id" | "created_at" | "updated_at" | "active" | "notes">;

const SEED: Seed[] = [
  // ===== KNR 2-02 — Konstrukcje budowlane =====
  { branza: "Budowlanka", kategoria: "KNR 2-02 Mury", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0101-01", nazwa: "Ławy fundamentowe betonowe, prostokątne", opis_pelny: "Ławy fundamentowe betonowe prostokątne, beton C16/20", jednostka: "m3", naklad_robocizny: 1.85, naklad_materialu: 1.02, naklad_sprzetu: 0.12, cena_zakupu_materialu: 320, cena_robocizny_netto: 0, cena_sprzetu_netto: 18, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Mury", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0102-01", nazwa: "Stopy fundamentowe żelbetowe", opis_pelny: "Stopy fundamentowe żelbetowe prostokątne", jednostka: "m3", naklad_robocizny: 4.20, naklad_materialu: 1.05, naklad_sprzetu: 0.20, cena_zakupu_materialu: 430, cena_robocizny_netto: 0, cena_sprzetu_netto: 18, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Mury", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0126-01", nazwa: "Ściany z bloczków betonowych M-6", opis_pelny: "Ściany fundamentowe z bloczków betonowych M-6 na zaprawie cementowej", jednostka: "m3", naklad_robocizny: 3.80, naklad_materialu: 1.04, naklad_sprzetu: 0.05, cena_zakupu_materialu: 380, cena_robocizny_netto: 0, cena_sprzetu_netto: 12, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Mury", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0202-01", nazwa: "Ściany z pustaków ceramicznych 25cm", opis_pelny: "Ściany zewnętrzne z pustaków ceramicznych Porotherm 25 P+W", jednostka: "m2", naklad_robocizny: 1.45, naklad_materialu: 16, naklad_sprzetu: 0.04, cena_zakupu_materialu: 6.80, cena_robocizny_netto: 0, cena_sprzetu_netto: 12, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Mury", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0202-04", nazwa: "Ścianki działowe z pustaków ceramicznych 12cm", opis_pelny: "Ścianki działowe z pustaków ceramicznych grub. 12 cm", jednostka: "m2", naklad_robocizny: 0.95, naklad_materialu: 12, naklad_sprzetu: 0.03, cena_zakupu_materialu: 4.20, cena_robocizny_netto: 0, cena_sprzetu_netto: 12, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Stropy", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0218-01", nazwa: "Stropy gęstożebrowe Teriva I", opis_pelny: "Stropy gęstożebrowe Teriva I rozpiętości do 6,0 m", jednostka: "m2", naklad_robocizny: 2.10, naklad_materialu: 1.05, naklad_sprzetu: 0.30, cena_zakupu_materialu: 95, cena_robocizny_netto: 0, cena_sprzetu_netto: 22, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Stropy", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0220-01", nazwa: "Stropy żelbetowe wylewane gr. 15cm", opis_pelny: "Stropy żelbetowe wylewane na mokro grub. 15 cm, beton C20/25", jednostka: "m2", naklad_robocizny: 2.85, naklad_materialu: 0.16, naklad_sprzetu: 0.35, cena_zakupu_materialu: 380, cena_robocizny_netto: 0, cena_sprzetu_netto: 28, stawka_rg: 32 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Tynki", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0901-01", nazwa: "Tynki cementowo-wapienne kat. III", opis_pelny: "Tynki wewnętrzne zwykłe cementowo-wapienne kat. III na ścianach", jednostka: "m2", naklad_robocizny: 0.68, naklad_materialu: 0.025, naklad_sprzetu: 0.02, cena_zakupu_materialu: 18, cena_robocizny_netto: 0, cena_sprzetu_netto: 8, stawka_rg: 28 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Tynki", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0902-01", nazwa: "Tynki gipsowe maszynowe", opis_pelny: "Tynki wewnętrzne gipsowe maszynowe gr. 10 mm", jednostka: "m2", naklad_robocizny: 0.45, naklad_materialu: 11, naklad_sprzetu: 0.05, cena_zakupu_materialu: 1.80, cena_robocizny_netto: 0, cena_sprzetu_netto: 14, stawka_rg: 28 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Posadzki", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 1101-01", nazwa: "Podkłady betonowe gr. 10cm", opis_pelny: "Podkłady betonowe na podłożu gruntowym, beton C12/15, grub. 10 cm", jednostka: "m2", naklad_robocizny: 0.42, naklad_materialu: 0.105, naklad_sprzetu: 0.04, cena_zakupu_materialu: 280, cena_robocizny_netto: 0, cena_sprzetu_netto: 14, stawka_rg: 28 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Posadzki", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 1102-01", nazwa: "Wylewki anhydrytowe gr. 5cm", opis_pelny: "Wylewki anhydrytowe samopoziomujące grub. 5 cm", jednostka: "m2", naklad_robocizny: 0.18, naklad_materialu: 0.052, naklad_sprzetu: 0.06, cena_zakupu_materialu: 320, cena_robocizny_netto: 0, cena_sprzetu_netto: 18, stawka_rg: 28 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Posadzki", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 1118-08", nazwa: "Posadzki z płytek gres 60×60", opis_pelny: "Posadzki z płytek gresowych 60×60 cm na klej, fugowanie", jednostka: "m2", naklad_robocizny: 1.20, naklad_materialu: 1.05, naklad_sprzetu: 0.02, cena_zakupu_materialu: 65, cena_robocizny_netto: 0, cena_sprzetu_netto: 6, stawka_rg: 30 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Pokrycia", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0501-01", nazwa: "Konstrukcja drewniana dachu", opis_pelny: "Krokwie dachowe z drewna iglastego klasy C24", jednostka: "m3", naklad_robocizny: 18.5, naklad_materialu: 1.08, naklad_sprzetu: 0.20, cena_zakupu_materialu: 2200, cena_robocizny_netto: 0, cena_sprzetu_netto: 22, stawka_rg: 34 },
  { branza: "Budowlanka", kategoria: "KNR 2-02 Pokrycia", knr_chapter: "KNR 2-02", knr_number: "KNR 2-02 0540-01", nazwa: "Pokrycie dachu blachodachówką", opis_pelny: "Pokrycie dachu blachodachówką powlekaną z obróbkami", jednostka: "m2", naklad_robocizny: 0.42, naklad_materialu: 1.10, naklad_sprzetu: 0.02, cena_zakupu_materialu: 48, cena_robocizny_netto: 0, cena_sprzetu_netto: 8, stawka_rg: 32 },

  // ===== KNR 4-01 — Roboty remontowe =====
  { branza: "Budowlanka", kategoria: "KNR 4-01 Rozbiórki", knr_chapter: "KNR 4-01", knr_number: "KNR 4-01 0212-02", nazwa: "Skucie tynków wewnętrznych", opis_pelny: "Skucie tynków wewnętrznych z cegły lub bloczków", jednostka: "m2", naklad_robocizny: 0.55, naklad_materialu: 0, naklad_sprzetu: 0.02, cena_zakupu_materialu: 0, cena_robocizny_netto: 0, cena_sprzetu_netto: 6, stawka_rg: 26 },
  { branza: "Budowlanka", kategoria: "KNR 4-01 Rozbiórki", knr_chapter: "KNR 4-01", knr_number: "KNR 4-01 0354-04", nazwa: "Rozebranie posadzki z płytek", opis_pelny: "Rozebranie posadzki z płytek ceramicznych na zaprawie", jednostka: "m2", naklad_robocizny: 0.48, naklad_materialu: 0, naklad_sprzetu: 0.02, cena_zakupu_materialu: 0, cena_robocizny_netto: 0, cena_sprzetu_netto: 6, stawka_rg: 26 },
  { branza: "Budowlanka", kategoria: "KNR 4-01 Rozbiórki", knr_chapter: "KNR 4-01", knr_number: "KNR 4-01 0349-02", nazwa: "Demontaż stolarki drzwiowej", opis_pelny: "Wykucie z muru ościeżnic drewnianych", jednostka: "szt", naklad_robocizny: 0.85, naklad_materialu: 0, naklad_sprzetu: 0, cena_zakupu_materialu: 0, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 26 },
  { branza: "Budowlanka", kategoria: "KNR 4-01 Malowanie", knr_chapter: "KNR 4-01", knr_number: "KNR 4-01 1204-02", nazwa: "Malowanie ścian farbą emulsyjną 2x", opis_pelny: "Dwukrotne malowanie tynków wewnętrznych farbą emulsyjną", jednostka: "m2", naklad_robocizny: 0.18, naklad_materialu: 0.25, naklad_sprzetu: 0, cena_zakupu_materialu: 12, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 26 },
  { branza: "Budowlanka", kategoria: "KNR 4-01 Malowanie", knr_chapter: "KNR 4-01", knr_number: "KNR 4-01 1209-02", nazwa: "Gruntowanie podłoży", opis_pelny: "Gruntowanie podłoży preparatem akrylowym", jednostka: "m2", naklad_robocizny: 0.06, naklad_materialu: 0.15, naklad_sprzetu: 0, cena_zakupu_materialu: 8, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 26 },
  { branza: "Budowlanka", kategoria: "KNR 4-01 Malowanie", knr_chapter: "KNR 4-01", knr_number: "KNR 4-01 0727-04", nazwa: "Gładź gipsowa 2-warstwowa", opis_pelny: "Wykonanie gładzi gipsowej dwuwarstwowej na ścianach", jednostka: "m2", naklad_robocizny: 0.35, naklad_materialu: 1.5, naklad_sprzetu: 0, cena_zakupu_materialu: 4.50, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 28 },

  // ===== KNNR 5 — Instalacje wodno-kanalizacyjne =====
  { branza: "Instalacje", kategoria: "KNNR 5 Wod-Kan", knr_chapter: "KNNR 5", knr_number: "KNNR 5 0211-01", nazwa: "Rurociąg z PEX 16mm", opis_pelny: "Rurociągi z rur PEX 16 mm w bruzdach ściennych", jednostka: "mb", naklad_robocizny: 0.18, naklad_materialu: 1.05, naklad_sprzetu: 0, cena_zakupu_materialu: 6.50, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },
  { branza: "Instalacje", kategoria: "KNNR 5 Wod-Kan", knr_chapter: "KNNR 5", knr_number: "KNNR 5 0405-01", nazwa: "Punkt wodny zimna+ciepła", opis_pelny: "Wykonanie punktu poboru wody zimnej i ciepłej z zaworami", jednostka: "szt", naklad_robocizny: 1.85, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 78, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },
  { branza: "Instalacje", kategoria: "KNNR 5 Wod-Kan", knr_chapter: "KNNR 5", knr_number: "KNNR 5 0210-04", nazwa: "Rurociąg PVC kanalizacyjny 110mm", opis_pelny: "Rurociągi kanalizacyjne PVC ø 110 mm", jednostka: "mb", naklad_robocizny: 0.32, naklad_materialu: 1.04, naklad_sprzetu: 0, cena_zakupu_materialu: 14, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },
  { branza: "Instalacje", kategoria: "KNNR 5 Wod-Kan", knr_chapter: "KNNR 5", knr_number: "KNNR 5 0408-01", nazwa: "Punkt kanalizacyjny ø50/110", opis_pelny: "Wykonanie punktu odpływu kanalizacyjnego ø 50 lub 110 mm", jednostka: "szt", naklad_robocizny: 2.10, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 55, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },
  { branza: "Instalacje", kategoria: "KNNR 5 Wod-Kan", knr_chapter: "KNNR 5", knr_number: "KNNR 5 0501-02", nazwa: "Montaż umywalki", opis_pelny: "Montaż umywalki porcelanowej z baterią", jednostka: "szt", naklad_robocizny: 1.45, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 280, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },

  // ===== KNNR 5 / KNR 4-03 — Elektryka =====
  { branza: "Instalacje", kategoria: "KNNR 5 Elektryka", knr_chapter: "KNNR 5", knr_number: "KNR 5-08 0204-01", nazwa: "Przewód YDYp 3×1.5 w bruzdach", opis_pelny: "Przewody YDYp 3×1,5 mm² układane w bruzdach ściennych", jednostka: "mb", naklad_robocizny: 0.085, naklad_materialu: 1.03, naklad_sprzetu: 0, cena_zakupu_materialu: 3.80, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 38 },
  { branza: "Instalacje", kategoria: "KNNR 5 Elektryka", knr_chapter: "KNNR 5", knr_number: "KNR 5-08 0204-02", nazwa: "Przewód YDYp 3×2.5 w bruzdach", opis_pelny: "Przewody YDYp 3×2,5 mm² układane w bruzdach ściennych", jednostka: "mb", naklad_robocizny: 0.092, naklad_materialu: 1.03, naklad_sprzetu: 0, cena_zakupu_materialu: 5.20, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 38 },
  { branza: "Instalacje", kategoria: "KNNR 5 Elektryka", knr_chapter: "KNNR 5", knr_number: "KNR 5-08 0301-01", nazwa: "Gniazdo 230V podtynkowe", opis_pelny: "Montaż gniazda wtykowego 230 V w puszce podtynkowej", jednostka: "szt", naklad_robocizny: 0.42, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 18, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 38 },
  { branza: "Instalacje", kategoria: "KNNR 5 Elektryka", knr_chapter: "KNNR 5", knr_number: "KNR 5-08 0301-02", nazwa: "Łącznik instalacyjny 1-bieg.", opis_pelny: "Montaż łącznika świecznikowego/jednobiegunowego podtynkowo", jednostka: "szt", naklad_robocizny: 0.38, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 16, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 38 },
  { branza: "Instalacje", kategoria: "KNNR 5 Elektryka", knr_chapter: "KNNR 5", knr_number: "KNR 5-08 0405-01", nazwa: "Rozdzielnica modułowa 12-mod.", opis_pelny: "Montaż rozdzielnicy modułowej 12 modułowej z wyposażeniem", jednostka: "szt", naklad_robocizny: 4.20, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 220, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 40 },
  { branza: "Instalacje", kategoria: "KNNR 5 Elektryka", knr_chapter: "KNNR 5", knr_number: "KNR 5-08 0501-01", nazwa: "Punkt oświetleniowy", opis_pelny: "Wykonanie punktu oświetleniowego sufitowego", jednostka: "szt", naklad_robocizny: 0.85, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 22, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 38 },

  // ===== KNR 2-15 — Instalacja CO =====
  { branza: "Instalacje", kategoria: "KNR 2-15 CO", knr_chapter: "KNR 2-15", knr_number: "KNR 2-15 0103-01", nazwa: "Rurociąg miedziany ø 18mm", opis_pelny: "Rurociągi z rur miedzianych ø 18 mm na ścianach", jednostka: "mb", naklad_robocizny: 0.32, naklad_materialu: 1.04, naklad_sprzetu: 0, cena_zakupu_materialu: 26, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },
  { branza: "Instalacje", kategoria: "KNR 2-15 CO", knr_chapter: "KNR 2-15", knr_number: "KNR 2-15 0404-01", nazwa: "Grzejnik panelowy 600×1000", opis_pelny: "Montaż grzejnika panelowego stalowego 600×1000 mm", jednostka: "szt", naklad_robocizny: 2.45, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 320, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 36 },
  { branza: "Instalacje", kategoria: "KNR 2-15 CO", knr_chapter: "KNR 2-15", knr_number: "KNR 2-15 0511-01", nazwa: "Kocioł gazowy kondensacyjny", opis_pelny: "Montaż kotła gazowego kondensacyjnego do 24 kW", jednostka: "szt", naklad_robocizny: 12.5, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 4500, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 42 },

  // ===== Meble (cennik własny — nie KNR) =====
  { branza: "Meble", kategoria: "Płyty", knr_chapter: null, knr_number: null, nazwa: "Płyta MDF lakier mat 19mm", opis_pelny: "Korpus z płyty MDF lakierowanej matowo gr. 19 mm", jednostka: "m2", naklad_robocizny: 1.20, naklad_materialu: 1.05, naklad_sprzetu: 0, cena_zakupu_materialu: 280, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 45 },
  { branza: "Meble", kategoria: "Płyty", knr_chapter: null, knr_number: null, nazwa: "Płyta laminowana 18mm", opis_pelny: "Korpus z płyty wiórowej laminowanej gr. 18 mm", jednostka: "m2", naklad_robocizny: 0.85, naklad_materialu: 1.05, naklad_sprzetu: 0, cena_zakupu_materialu: 95, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 45 },
  { branza: "Meble", kategoria: "Blaty", knr_chapter: null, knr_number: null, nazwa: "Blat kompozytowy 38mm", opis_pelny: "Blat kompozytowy gr. 38 mm z obrzeżem", jednostka: "mb", naklad_robocizny: 1.50, naklad_materialu: 1.02, naklad_sprzetu: 0, cena_zakupu_materialu: 420, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 45 },
  { branza: "Meble", kategoria: "Okucia", knr_chapter: null, knr_number: null, nazwa: "Zawias Blum CLIP top", opis_pelny: "Zawias puszkowy Blum CLIP top z dociągiem", jednostka: "szt", naklad_robocizny: 0.10, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 18, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 40 },
  { branza: "Meble", kategoria: "Okucia", knr_chapter: null, knr_number: null, nazwa: "Prowadnica Blum LEGRABOX", opis_pelny: "Prowadnica szuflady Blum LEGRABOX, komplet", jednostka: "kpl", naklad_robocizny: 0.40, naklad_materialu: 1, naklad_sprzetu: 0, cena_zakupu_materialu: 220, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 40 },
  { branza: "Meble", kategoria: "Montaż", knr_chapter: null, knr_number: null, nazwa: "Montaż zabudowy kuchennej", opis_pelny: "Montaż zabudowy kuchennej (mb frontu)", jednostka: "mb", naklad_robocizny: 5.00, naklad_materialu: 0, naklad_sprzetu: 0, cena_zakupu_materialu: 0, cena_robocizny_netto: 0, cena_sprzetu_netto: 0, stawka_rg: 50 },
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
      toast.success(`Zaimportowano ${n} pozycji KNR`);
      qc.invalidateQueries({ queryKey: ["master_catalog"] });
    },
    onError: (e: any) => toast.error("Błąd importu", { description: e.message }),
  });
}
