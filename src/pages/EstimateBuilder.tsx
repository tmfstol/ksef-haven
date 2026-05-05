import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useEstimate, useEstimateStages, useEstimateItems, useUpdateEstimate, useDeleteEstimate,
  useAddStage, useUpdateStage, useDeleteStage,
  useAddItem, useUpdateItem, useDeleteItem,
  type EstimateItem,
} from "@/hooks/useEstimates";
import { useMasterCatalog, type CatalogItem, type Branza } from "@/hooks/useMasterCatalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Plus, Search, Trash2, FileDown, Loader2, Calculator, Layers, Briefcase, Settings2, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateEstimatePdf } from "@/lib/estimate-pdf";
import { ImportPrzedmiarDialog } from "@/components/estimates/ImportPrzedmiarDialog";
import { toast } from "sonner";

const branzaColor: Record<Branza, string> = {
  Budowlanka: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  Instalacje: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Meble: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

const fmt = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Liczy wartości R/M/S dla pozycji wg modelu KNR
function calcRMS(it: { ilosc: number; naklad_robocizny: number; stawka_rg: number; naklad_materialu: number; cena_mat: number; naklad_sprzetu: number; cena_sprz: number }) {
  const r = Number(it.ilosc) * Number(it.naklad_robocizny || 0) * Number(it.stawka_rg || 0);
  const m = Number(it.ilosc) * Number(it.naklad_materialu || 0) * Number(it.cena_mat || 0);
  const s = Number(it.ilosc) * Number(it.naklad_sprzetu || 0) * Number(it.cena_sprz || 0);
  return { r, m, s, total: r + m + s };
}

const EstimateBuilder = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: companies } = useCompanies();
  const { data: estimate, isLoading } = useEstimate(id ?? null);
  const { data: stages = [] } = useEstimateStages(id ?? null);
  const { data: items = [] } = useEstimateItems(id ?? null);
  const { data: catalog = [] } = useMasterCatalog(estimate?.company_id ?? null, estimate?.branza);

  const updateEstimate = useUpdateEstimate();
  const deleteEstimate = useDeleteEstimate();
  const addStage = useAddStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();
  const addItem = useAddItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();

  const [search, setSearch] = useState("");
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (stages.length && !activeStageId) setActiveStageId(stages[0].id);
  }, [stages, activeStageId]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((i) =>
      i.nazwa.toLowerCase().includes(q) ||
      i.kategoria.toLowerCase().includes(q) ||
      (i.knr_number ?? "").toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const it of filteredCatalog) {
      if (!map.has(it.kategoria)) map.set(it.kategoria, []);
      map.get(it.kategoria)!.push(it);
    }
    return Array.from(map.entries());
  }, [filteredCatalog]);

  const company = useMemo(() => companies?.find((c) => c.id === estimate?.company_id) ?? null, [companies, estimate]);

  // Sumy globalne RMS + narzuty
  const totals = useMemo(() => {
    let R = 0, M = 0, S = 0;
    for (const it of items) {
      const v = calcRMS(it as any);
      R += v.r; M += v.m; S += v.s;
    }
    const kp = (R + S) * (Number(estimate?.narzut_kp_proc ?? 0) / 100);
    const subtotal = R + M + S + kp;
    const zysk = subtotal * (Number(estimate?.narzut_zysk_proc ?? 0) / 100);
    const netto = subtotal + zysk;
    const vat = netto * (Number(estimate?.vat_proc ?? 23) / 100);
    const brutto = netto + vat;
    return { R, M, S, kp, zysk, netto, vat, brutto };
  }, [items, estimate?.narzut_kp_proc, estimate?.narzut_zysk_proc, estimate?.vat_proc]);

  // Persist sumy
  useEffect(() => {
    if (!estimate) return;
    const newM = Math.round(totals.M * 100) / 100;
    const newR = Math.round(totals.R * 100) / 100;
    const newS = Math.round(totals.S * 100) / 100;
    if (
      Math.abs(newM - Number(estimate.suma_material)) > 0.01 ||
      Math.abs(newR - Number(estimate.suma_robocizna)) > 0.01 ||
      Math.abs(newS - Number(estimate.suma_sprzet ?? 0)) > 0.01
    ) {
      updateEstimate.mutate({ id: estimate.id, patch: { suma_material: newM, suma_robocizna: newR, suma_sprzet: newS } as any });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.M, totals.R, totals.S, estimate?.id]);

  const handleAddFromCatalog = async (cat: CatalogItem) => {
    if (!estimate) return;
    const stageId = activeStageId ?? (stages[0]?.id ?? null);
    const ord = items.filter((i) => i.stage_id === stageId).length + 1;
    const ilosc = 1;
    const r = ilosc * Number(cat.naklad_robocizny) * Number(cat.stawka_rg);
    const m = ilosc * Number(cat.naklad_materialu) * Number(cat.cena_zakupu_materialu);
    const s = ilosc * Number(cat.naklad_sprzetu) * Number(cat.cena_sprzetu_netto);
    await addItem.mutateAsync({
      estimate_id: estimate.id,
      stage_id: stageId,
      catalog_id: cat.id,
      ordinal: ord,
      nazwa: cat.nazwa,
      jednostka: cat.jednostka,
      ilosc,
      cena_mat: cat.cena_zakupu_materialu,
      cena_rob: cat.cena_robocizny_netto,
      cena_sprz: cat.cena_sprzetu_netto,
      knr_number: cat.knr_number,
      opis_pelny: cat.opis_pelny,
      naklad_robocizny: cat.naklad_robocizny,
      naklad_materialu: cat.naklad_materialu,
      naklad_sprzetu: cat.naklad_sprzetu,
      stawka_rg: cat.stawka_rg,
      wartosc_r: r, wartosc_m: m, wartosc_s: s,
    });
  };

  const handleAddStage = async () => {
    if (!estimate) return;
    const next = stages.length + 1;
    const s = await addStage.mutateAsync({ estimate_id: estimate.id, name: `Element ${next}`, ordinal: next });
    setActiveStageId(s.id);
  };

  const handleItemPatch = (it: EstimateItem, patch: Partial<EstimateItem>) => {
    if (!estimate) return;
    const merged = { ...it, ...patch };
    const v = calcRMS(merged as any);
    updateItem.mutate({
      id: it.id, estimate_id: estimate.id,
      patch: { ...patch, wartosc_r: v.r, wartosc_m: v.m, wartosc_s: v.s } as any,
    });
  };

  const handlePdf = () => {
    if (!estimate) return;
    if (items.length === 0) { toast.error("Brak pozycji w kosztorysie"); return; }
    generateEstimatePdf({ estimate, stages, items, company: company as any });
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AppLayout>;
  }
  if (!estimate) {
    return <AppLayout><div className="p-6">Nie znaleziono kosztorysu.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="border-b bg-card/50 backdrop-blur px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/estimates")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <div>
              <Input
                defaultValue={estimate.nazwa_kosztorysu}
                onBlur={(e) => e.target.value !== estimate.nazwa_kosztorysu && updateEstimate.mutate({ id: estimate.id, patch: { nazwa_kosztorysu: e.target.value } as any })}
                className="h-8 font-semibold text-base border-0 px-0 focus-visible:ring-0 bg-transparent"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn("text-[10px]", branzaColor[estimate.branza])}>{estimate.branza}</Badge>
                <span className="text-xs text-muted-foreground">KNR / Norma PRO</span>
                {estimate.client_name && <span className="text-xs text-muted-foreground">• {estimate.client_name}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />Dane kosztorysu
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[480px] overflow-y-auto">
                <SheetHeader><SheetTitle>Dane kosztorysu</SheetTitle></SheetHeader>
                <div className="space-y-4 mt-4">
                  <Field label="Inwestor — nazwa">
                    <Input defaultValue={estimate.inwestor_nazwa ?? ""} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { inwestor_nazwa: e.target.value || null } as any })} />
                  </Field>
                  <Field label="Inwestor — adres">
                    <Textarea rows={2} defaultValue={estimate.inwestor_adres ?? ""} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { inwestor_adres: e.target.value || null } as any })} />
                  </Field>
                  <Field label="Wykonawca — nazwa">
                    <Input defaultValue={estimate.wykonawca_nazwa ?? company?.name ?? ""} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { wykonawca_nazwa: e.target.value || null } as any })} />
                  </Field>
                  <Field label="Wykonawca — adres">
                    <Textarea rows={2} defaultValue={estimate.wykonawca_adres ?? ""} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { wykonawca_adres: e.target.value || null } as any })} />
                  </Field>
                  <Field label="Lokalizacja obiektu">
                    <Input defaultValue={estimate.lokalizacja_obiektu ?? ""} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { lokalizacja_obiektu: e.target.value || null } as any })} />
                  </Field>
                  <Field label="Podstawa opracowania">
                    <Input defaultValue={estimate.podstawa_opracowania ?? "KNR - Katalog Nakładów Rzeczowych"} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { podstawa_opracowania: e.target.value || null } as any })} />
                  </Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Kp % (od R+S)">
                      <Input type="number" step="0.1" defaultValue={estimate.narzut_kp_proc} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { narzut_kp_proc: parseFloat(e.target.value) || 0 } as any })} />
                    </Field>
                    <Field label="Zysk %">
                      <Input type="number" step="0.1" defaultValue={estimate.narzut_zysk_proc} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { narzut_zysk_proc: parseFloat(e.target.value) || 0 } as any })} />
                    </Field>
                    <Field label="VAT %">
                      <Input type="number" step="0.1" defaultValue={estimate.vat_proc} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { vat_proc: parseFloat(e.target.value) || 0 } as any })} />
                    </Field>
                  </div>
                  <Field label="Notatki / uwagi">
                    <Textarea rows={4} defaultValue={estimate.notes ?? ""} onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { notes: e.target.value || null } as any })} />
                  </Field>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />Import przedmiaru (Excel)
            </Button>
            <Button size="sm" onClick={handlePdf}>
              <FileDown className="h-4 w-4 mr-2" />Drukuj kosztorys (KNR)
            </Button>
          </div>
        </div>

        <ImportPrzedmiarDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          estimateId={estimate.id}
          companyId={estimate.company_id}
          branza={estimate.branza}
          stageId={activeStageId ?? (stages[0]?.id ?? null)}
          startOrdinal={items.filter((i) => i.stage_id === (activeStageId ?? stages[0]?.id)).length + 1}
        />

        {/* Body: split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Catalog KNR */}
          <div className="w-[440px] border-r flex flex-col bg-muted/20">
            <div className="p-4 border-b bg-card">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" /> Cennik KNR — {estimate.branza}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="KNR / nazwa / kategoria..." className="pl-9 h-9" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {grouped.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Brak pozycji. <Button variant="link" className="h-auto p-0" onClick={() => navigate("/catalog")}>Importuj bazę KNR</Button>
                </div>
              ) : grouped.map(([cat, list]) => (
                <div key={cat} className="mb-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">{cat}</div>
                  <div className="space-y-1">
                    {list.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleAddFromCatalog(c)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-card border border-transparent hover:border-border transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {c.knr_number && <div className="text-[10px] font-mono text-primary">{c.knr_number}</div>}
                            <div className="text-sm font-medium truncate">{c.nazwa}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              R: {c.naklad_robocizny} r-g · M: {fmt(Number(c.cena_zakupu_materialu))} zł/{c.jednostka}
                              {Number(c.naklad_sprzetu) > 0 && ` · S: ${c.naklad_sprzetu} m-g`}
                            </div>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Pozycje kosztorysu */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b bg-card px-4 py-2 flex items-center gap-1 overflow-x-auto">
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveStageId(s.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2",
                    activeStageId === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  {s.name}
                  <span className="text-[10px] opacity-70">({items.filter((i) => i.stage_id === s.id).length})</span>
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={handleAddStage}>
                <Plus className="h-4 w-4 mr-1" />Element
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {stages.map((stage) => {
                const stageItems = items.filter((i) => i.stage_id === stage.id);
                if (stage.id !== activeStageId && stages.length > 1) return null;
                return (
                  <Card key={stage.id} className="p-4">
                    <div className="flex items-center justify-between mb-3 pb-3 border-b">
                      <Input
                        defaultValue={stage.name}
                        onBlur={(e) => e.target.value !== stage.name && updateStage.mutate({ id: stage.id, estimate_id: estimate.id, patch: { name: e.target.value } as any })}
                        className="h-8 font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent max-w-xs"
                      />
                      {stages.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => {
                          if (confirm(`Usunąć element "${stage.name}"?`)) deleteStage.mutate({ id: stage.id, estimate_id: estimate.id });
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {stageItems.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        Wybierz pozycje KNR z cennika po lewej stronie.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="grid gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold grid-cols-[90px_1fr_60px_50px_90px_90px_90px_36px]">
                          <div>Nr KNR</div>
                          <div>Pozycja</div>
                          <div className="text-right">Ilość</div>
                          <div>J.m.</div>
                          <div className="text-right">Stawka R / jm</div>
                          <div className="text-right">Cena M / jm</div>
                          <div className="text-right">Razem</div>
                          <div></div>
                        </div>
                        {stageItems.map((it) => {
                          // Stawka robocizny za jednostkę (np. mb) = naklad_robocizny * stawka_rg
                          const stawkaR = Number(it.naklad_robocizny || 0) * Number(it.stawka_rg || 0);
                          const cenaM = Number(it.naklad_materialu || 0) * Number(it.cena_mat || 0);
                          const v = calcRMS(it as any);
                          return (
                            <div key={it.id} className="grid gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 items-center grid-cols-[90px_1fr_60px_50px_90px_90px_90px_36px]">
                              <Input
                                defaultValue={it.knr_number ?? ""}
                                onBlur={(e) => e.target.value !== (it.knr_number ?? "") && handleItemPatch(it, { knr_number: e.target.value || null })}
                                className="h-7 text-[10px] font-mono text-primary px-1.5"
                                placeholder="—"
                              />
                              <Input
                                defaultValue={it.nazwa}
                                onBlur={(e) => e.target.value !== it.nazwa && handleItemPatch(it, { nazwa: e.target.value })}
                                className="h-7 text-sm font-medium px-2"
                                title={it.opis_pelny ?? it.nazwa}
                              />
                              <Input
                                type="number" step="0.01"
                                defaultValue={it.ilosc}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value.replace(",", ".")) || 0;
                                  if (num !== Number(it.ilosc)) handleItemPatch(it, { ilosc: num });
                                }}
                                className="h-7 text-right tabular-nums text-sm px-1.5"
                              />
                              <Input
                                defaultValue={it.jednostka}
                                onBlur={(e) => e.target.value !== it.jednostka && handleItemPatch(it, { jednostka: e.target.value || "szt" })}
                                className="h-7 text-xs text-muted-foreground px-1.5"
                              />
                              <Input
                                type="number" step="0.01"
                                defaultValue={stawkaR.toFixed(2)}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value.replace(",", ".")) || 0;
                                  if (Math.abs(num - stawkaR) > 0.001) {
                                    // Zapisujemy jako stawka_rg z nakładem 1, dla prostego edytowania ceny za jm
                                    handleItemPatch(it, { stawka_rg: num, naklad_robocizny: 1 });
                                  }
                                }}
                                className="h-7 text-right tabular-nums text-sm px-1.5"
                                placeholder="0.00"
                              />
                              <Input
                                type="number" step="0.01"
                                defaultValue={cenaM.toFixed(2)}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value.replace(",", ".")) || 0;
                                  if (Math.abs(num - cenaM) > 0.001) {
                                    handleItemPatch(it, { cena_mat: num, naklad_materialu: 1 });
                                  }
                                }}
                                className="h-7 text-right tabular-nums text-sm px-1.5"
                                placeholder="0.00"
                              />
                              <div className="text-right font-semibold text-sm tabular-nums">{fmt(v.total)}</div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteItem.mutate({ id: it.id, estimate_id: estimate.id })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                        <div className="pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const ord = stageItems.length + 1;
                              addItem.mutate({
                                estimate_id: estimate.id,
                                stage_id: stage.id,
                                ordinal: ord,
                                nazwa: "Nowa pozycja",
                                jednostka: "mb",
                                ilosc: 1,
                                naklad_robocizny: 1,
                                naklad_materialu: 1,
                                stawka_rg: 0,
                                cena_mat: 0,
                              });
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />Dodaj pozycję ręcznie
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Stopka — podsumowanie KNR */}
            <div className="border-t bg-card px-6 py-3">
              <div className="flex items-center justify-between gap-6 flex-wrap">
                <div className="flex items-center gap-5 text-xs">
                  <Stat label="Robocizna (R)" v={totals.R} />
                  <Stat label="Materiały (M)" v={totals.M} />
                  <Stat label="Sprzęt (S)" v={totals.S} />
                  <Stat label={`Kp ${estimate.narzut_kp_proc}%`} v={totals.kp} muted />
                  <Stat label={`Zysk ${estimate.narzut_zysk_proc}%`} v={totals.zysk} muted />
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Wartość kosztorysu netto</div>
                  <div className="text-xl font-bold tabular-nums text-primary">{fmt(totals.netto)} <span className="text-sm font-normal text-muted-foreground">PLN</span></div>
                  <div className="text-[10px] text-muted-foreground">brutto z VAT {estimate.vat_proc}%: <span className="font-semibold tabular-nums">{fmt(totals.brutto)} PLN</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const Stat = ({ label, v, muted }: { label: string; v: number; muted?: boolean }) => (
  <div>
    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
    <div className={cn("font-semibold tabular-nums", muted ? "text-muted-foreground" : "")}>{fmt(v)} PLN</div>
  </div>
);

export default EstimateBuilder;
