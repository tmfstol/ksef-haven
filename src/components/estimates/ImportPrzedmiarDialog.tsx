import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileSpreadsheet, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMasterCatalog, type CatalogItem } from "@/hooks/useMasterCatalog";
import { useAddItem, type EstimateItem } from "@/hooks/useEstimates";
import { cn } from "@/lib/utils";

interface PrzedmiarRow {
  lp: string;
  nazwa: string;
  jednostka: string;
  ilosc: number;
}

interface MatchedRow extends PrzedmiarRow {
  catalog_id: string | null;
  confidence: "high" | "medium" | "low" | "none";
  catalog?: CatalogItem | null;
  reason?: string;
  // Override stawek (jeśli użytkownik wpisał własne)
  override_r?: number; // stawka robocizny za jm
  override_m?: number; // koszt materiału za jm
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estimateId: string;
  companyId: string;
  branza: "Budowlanka" | "Instalacje" | "Meble";
  stageId: string | null;
  startOrdinal: number;
}

const confColor: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  low: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  none: "bg-red-500/10 text-red-700 border-red-500/20",
};

function calcRMS(c: CatalogItem, ilosc: number) {
  const r = ilosc * Number(c.naklad_robocizny) * Number(c.stawka_rg);
  const m = ilosc * Number(c.naklad_materialu) * Number(c.cena_zakupu_materialu);
  const s = ilosc * Number(c.naklad_sprzetu) * Number(c.cena_sprzetu_netto);
  return { r, m, s, total: r + m + s };
}

function calcRowValue(row: MatchedRow): { r: number; m: number; s: number; total: number } {
  // Priorytet: ręczne stawki override
  const hasOverride = row.override_r !== undefined || row.override_m !== undefined;
  if (hasOverride) {
    const r = (row.override_r ?? 0) * row.ilosc;
    const m = (row.override_m ?? 0) * row.ilosc;
    return { r, m, s: 0, total: r + m };
  }
  if (row.catalog) return calcRMS(row.catalog, row.ilosc);
  return { r: 0, m: 0, s: 0, total: 0 };
}

const fmt = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ImportPrzedmiarDialog({ open, onOpenChange, estimateId, companyId, branza, stageId, startOrdinal }: Props) {
  const { data: catalog = [] } = useMasterCatalog(companyId, branza);
  const addItem = useAddItem();
  const [rows, setRows] = useState<MatchedRow[]>([]);
  const [step, setStep] = useState<"upload" | "matching" | "review">("upload");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setRows([]);
    setStep("upload");
    setFileName("");
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" });

      // Heurystyka: znajdź wiersz nagłówka — musi mieć ≥2 niepuste, krótkie komórki
      const isHeaderRow = (row: any[]) => {
        const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
        if (cells.length < 2) return false;
        // Każda komórka nagłówka powinna być krótka (≤40 znaków) — odrzuca wiersze opisowe/komentarze
        if (cells.some((c) => c.length > 40)) return false;
        const line = cells.join(" | ").toLowerCase();
        return /(^|\| ?)(lp\.?|l\.p\.?|nr|poz\.?)( ?\||$)/.test(line) ||
               /\bnazwa\b|\bopis\b|\brodzaj\b|\bprzedmiot\b|wyszczeg|branż|średnica|srednica|kondygnac|ilość|ilosc|d[łl]ugo[śs]|jedn|j\.m\./.test(line);
      };
      let headerIdx = -1;
      for (let i = 0; i < Math.min(json.length, 30); i++) {
        if (isHeaderRow(json[i])) { headerIdx = i; break; }
      }
      if (headerIdx < 0) headerIdx = 0;

      const rawHeaders = json[headerIdx].map((c) => String(c ?? ""));
      const headers = rawHeaders.map((c) => c.toLowerCase().trim());
      const idxLp = headers.findIndex((h) => /^l\.?p\.?$/.test(h) || h === "nr" || h === "poz" || h === "poz." || h === "lp");
      // Kolumny opisowe (nazwa/opis/rodzaj/przedmiot/branża/średnica/kondygnacja itp.)
      const descKeywords = ["nazwa", "opis", "rodzaj", "przedmiot", "wyszczeg", "branż", "średnica", "srednica", "kondygnac", "typ", "materiał", "material"];
      const descIdxs: number[] = [];
      headers.forEach((h, i) => { if (descKeywords.some((k) => h.includes(k))) descIdxs.push(i); });
      // Kolumna ilości — obsługa "ilość", "liczba", "długość", "[mb]", "[m]", "m2", "szt", "kpl"
      let idxIlosc = headers.findIndex((h) => /ilo[śs]|liczba|d[łl]ugo[śs]|obmiar|krotno/.test(h));
      if (idxIlosc < 0) idxIlosc = headers.findIndex((h) => /\[(mb|m|m2|m3|szt|kpl|kg|t)\]?/.test(h));
      // Kolumna jednostki
      let idxJm = headers.findIndex((h) => /jedn|j\.?m\.?$|^jm$/.test(h));
      // Wyciągnij jednostkę z nagłówka ilości jeśli brak osobnej kolumny (np. "Długość [mb]")
      let unitFromHeader = "";
      if (idxJm < 0 && idxIlosc >= 0) {
        const m = rawHeaders[idxIlosc].match(/\[([^\]]+)\]/);
        if (m) unitFromHeader = m[1].trim();
        else if (/d[łl]ugo[śs]/i.test(rawHeaders[idxIlosc])) unitFromHeader = "mb";
      }

      // Fallback: jeśli nie ma kolumn opisowych, weź wszystkie tekstowe poza Lp/ilość/jm
      if (descIdxs.length === 0) {
        headers.forEach((_, i) => {
          if (i !== idxLp && i !== idxIlosc && i !== idxJm) descIdxs.push(i);
        });
      }

      if (descIdxs.length === 0 || idxIlosc < 0) {
        toast.error("Nie rozpoznano kolumn.", {
          description: `Wykryte nagłówki: ${rawHeaders.filter(Boolean).join(" | ")}. Wymagana kolumna z opisem i ilością/długością.`,
        });
        return;
      }

      const parsed: PrzedmiarRow[] = [];
      for (let i = headerIdx + 1; i < json.length; i++) {
        const r = json[i];
        const nazwa = descIdxs.map((di) => String(r[di] ?? "").trim()).filter(Boolean).join(" • ");
        const iloscRaw = r[idxIlosc];
        const ilosc = typeof iloscRaw === "number" ? iloscRaw : parseFloat(String(iloscRaw).replace(/\s/g, "").replace(",", "."));
        if (!nazwa || !isFinite(ilosc) || ilosc <= 0) continue;
        const jm = idxJm >= 0 ? String(r[idxJm] ?? "").trim() : unitFromHeader;
        parsed.push({
          lp: String(r[idxLp] ?? parsed.length + 1),
          nazwa,
          jednostka: jm,
          ilosc,
        });
      }

      if (parsed.length === 0) {
        toast.error("Nie znaleziono żadnych pozycji w pliku.");
        return;
      }

      if (catalog.length === 0) {
        toast.error("Pusty katalog KNR — najpierw zaimportuj bazę KNR.");
        return;
      }

      setStep("matching");
      setLoading(true);

      const catalogLite = catalog.map((c) => ({
        id: c.id,
        knr_number: c.knr_number,
        nazwa: c.nazwa,
        jednostka: c.jednostka,
        kategoria: c.kategoria,
      }));

      const { data, error } = await supabase.functions.invoke("match-przedmiar", {
        body: { rows: parsed, catalog: catalogLite },
      });
      if (error) throw error;

      const matches: any[] = data?.matches ?? [];
      const matched: MatchedRow[] = parsed.map((p, i) => {
        const m = matches.find((x) => x.przedmiar_index === i + 1);
        const cat = m?.catalog_id ? catalog.find((c) => c.id === m.catalog_id) ?? null : null;
        return {
          ...p,
          catalog_id: cat?.id ?? null,
          confidence: m?.confidence ?? "none",
          catalog: cat,
          reason: m?.reason,
        };
      });
      setRows(matched);
      setStep("review");
      toast.success(`Dopasowano ${matched.filter((r) => r.catalog).length}/${matched.length} pozycji`);
    } catch (e: any) {
      console.error(e);
      toast.error("Błąd przetwarzania", { description: e.message });
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  const handleManualPick = (idx: number, catId: string) => {
    const cat = catalog.find((c) => c.id === catId) ?? null;
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, catalog_id: catId, catalog: cat, confidence: "high", override_r: undefined, override_m: undefined } : r));
  };

  const handleOverride = (idx: number, field: "override_r" | "override_m", value: string) => {
    const num = parseFloat(value.replace(",", "."));
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: isFinite(num) ? num : undefined } : r));
  };

  const totalValue = rows.reduce((sum, r) => sum + calcRowValue(r).total, 0);

  const usableCount = rows.filter((r) => r.catalog || r.override_r !== undefined || r.override_m !== undefined).length;

  const handleImport = async () => {
    const usable = rows.filter((r) => r.catalog || r.override_r !== undefined || r.override_m !== undefined);
    if (usable.length === 0) { toast.error("Brak pozycji do dodania"); return; }
    setLoading(true);
    try {
      let ord = startOrdinal;
      for (const r of usable) {
        const v = calcRowValue(r);
        const hasOverride = r.override_r !== undefined || r.override_m !== undefined;
        if (hasOverride && !r.catalog) {
          // Pozycja ręczna bez KNR
          await addItem.mutateAsync({
            estimate_id: estimateId,
            stage_id: stageId,
            catalog_id: null,
            ordinal: ord++,
            nazwa: r.nazwa,
            jednostka: r.jednostka || "szt",
            ilosc: r.ilosc,
            cena_mat: r.override_m ?? 0,
            cena_rob: r.override_r ?? 0,
            cena_sprz: 0,
            naklad_robocizny: 1,
            naklad_materialu: 1,
            naklad_sprzetu: 0,
            stawka_rg: r.override_r ?? 0,
            wartosc_r: v.r, wartosc_m: v.m, wartosc_s: 0,
          } as Partial<EstimateItem> & { estimate_id: string });
        } else {
          const cat = r.catalog!;
          await addItem.mutateAsync({
            estimate_id: estimateId,
            stage_id: stageId,
            catalog_id: cat.id,
            ordinal: ord++,
            nazwa: cat.nazwa,
            jednostka: cat.jednostka,
            ilosc: r.ilosc,
            cena_mat: hasOverride ? (r.override_m ?? 0) : cat.cena_zakupu_materialu,
            cena_rob: hasOverride ? (r.override_r ?? 0) : cat.cena_robocizny_netto,
            cena_sprz: hasOverride ? 0 : cat.cena_sprzetu_netto,
            knr_number: cat.knr_number,
            opis_pelny: cat.opis_pelny,
            naklad_robocizny: hasOverride ? 1 : cat.naklad_robocizny,
            naklad_materialu: hasOverride ? 1 : cat.naklad_materialu,
            naklad_sprzetu: hasOverride ? 0 : cat.naklad_sprzetu,
            stawka_rg: hasOverride ? (r.override_r ?? 0) : cat.stawka_rg,
            wartosc_r: v.r, wartosc_m: v.m, wartosc_s: v.s,
          } as Partial<EstimateItem> & { estimate_id: string });
        }
      }
      toast.success(`Dodano ${usable.length} pozycji do kosztorysu`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Błąd importu", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="!max-w-[95vw] w-[95vw] sm:!max-w-[1400px] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import przedmiaru z Excela
          </DialogTitle>
          <DialogDescription>
            Wgraj plik .xlsx z przedmiarem — AI dopasuje pozycje do katalogu KNR i wyliczy ceny.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">Wgraj plik .xlsx z kolumnami: Lp, Nazwa, Jednostka, Ilość</p>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="max-w-xs"
            />
          </div>
        )}

        {step === "matching" && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium">AI dopasowuje pozycje do katalogu KNR…</p>
            <p className="text-xs text-muted-foreground mt-1">{fileName}</p>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex-1 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr className="text-left text-xs uppercase">
                    <th className="px-2 py-2 w-10">Lp</th>
                    <th className="px-2 py-2">Z przedmiaru</th>
                    <th className="px-2 py-2 w-24">Ilość</th>
                    <th className="px-2 py-2">Dopasowanie KNR</th>
                    <th className="px-2 py-2 w-28">Robocizna /jm</th>
                    <th className="px-2 py-2 w-28">Materiał /jm</th>
                    <th className="px-2 py-2 w-28 text-right">Wartość</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const v = calcRowValue(r);
                    const hasOverride = r.override_r !== undefined || r.override_m !== undefined;
                    const defaultR = r.catalog ? Number(r.catalog.naklad_robocizny) * Number(r.catalog.stawka_rg) : 0;
                    const defaultM = r.catalog ? Number(r.catalog.naklad_materialu) * Number(r.catalog.cena_zakupu_materialu) : 0;
                    return (
                      <tr key={i} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-2 align-top text-muted-foreground">{r.lp}</td>
                        <td className="px-2 py-2 align-top">
                          <div className="font-medium">{r.nazwa}</div>
                          <div className="text-xs text-muted-foreground">jm: {r.jednostka || "—"}</div>
                        </td>
                        <td className="px-2 py-2 align-top">{fmt(r.ilosc)} {r.jednostka}</td>
                        <td className="px-2 py-2 align-top">
                          {r.catalog ? (
                            <div className="flex items-start gap-2">
                              <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-mono text-primary">{r.catalog.knr_number}</div>
                                <div className="text-sm">{r.catalog.nazwa}</div>
                                <Badge variant="outline" className={cn("text-[10px] mt-0.5", confColor[r.confidence])}>
                                  {r.confidence}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-2">
                              <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <select
                                className="text-xs border rounded px-1.5 py-1 bg-background flex-1"
                                onChange={(e) => e.target.value && handleManualPick(i, e.target.value)}
                                defaultValue=""
                              >
                                <option value="">— wybierz ręcznie —</option>
                                {catalog.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.knr_number ? `${c.knr_number} · ` : ""}{c.nazwa}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={defaultR ? fmt(defaultR) : "0,00"}
                            defaultValue={r.override_r !== undefined ? r.override_r : ""}
                            onBlur={(e) => handleOverride(i, "override_r", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={defaultM ? fmt(defaultM) : "0,00"}
                            defaultValue={r.override_m !== undefined ? r.override_m : ""}
                            onBlur={(e) => handleOverride(i, "override_m", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2 align-top text-right font-medium">
                          {v.total > 0 ? (
                            <>
                              <div>{fmt(v.total)} zł</div>
                              {hasOverride && <div className="text-[10px] text-amber-600">ręcznie</div>}
                            </>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm">
                <span className="text-muted-foreground">Suma R+M+S: </span>
                <span className="font-bold">{fmt(totalValue)} zł netto</span>
                <span className="text-xs text-muted-foreground ml-2">(bez Kp/zysku/VAT)</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => { reset(); }}>Wgraj inny plik</Button>
                <Button onClick={handleImport} disabled={loading || usableCount === 0}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Dodaj do kosztorysu ({usableCount})
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
