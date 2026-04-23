import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useEstimate, useEstimateStages, useEstimateItems, useUpdateEstimate, useDeleteEstimate,
  useAddStage, useUpdateStage, useDeleteStage,
  useAddItem, useUpdateItem, useDeleteItem,
} from "@/hooks/useEstimates";
import { useMasterCatalog, type CatalogItem, type Branza } from "@/hooks/useMasterCatalog";
import { useUpdateEstimate as useUpdEst } from "@/hooks/useEstimates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Search, Trash2, FileDown, Loader2, Calculator, GripVertical, Layers, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateEstimatePdf } from "@/lib/estimate-pdf";
import { toast } from "sonner";

const branzaColor: Record<Branza, string> = {
  Budowlanka: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  Instalacje: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  Meble: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

const fmt = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  useEffect(() => {
    if (stages.length && !activeStageId) setActiveStageId(stages[0].id);
  }, [stages, activeStageId]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((i) => i.nazwa.toLowerCase().includes(q) || i.kategoria.toLowerCase().includes(q));
  }, [catalog, search]);

  // Group catalog by category
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const it of filteredCatalog) {
      if (!map.has(it.kategoria)) map.set(it.kategoria, []);
      map.get(it.kategoria)!.push(it);
    }
    return Array.from(map.entries());
  }, [filteredCatalog]);

  const company = useMemo(() => companies?.find((c) => c.id === estimate?.company_id) ?? null, [companies, estimate]);

  // Totals (with margin)
  const marzaMat = Number(estimate?.marza_material || 0) / 100;
  const marzaRob = Number(estimate?.marza_robocizna || 0) / 100;
  const totals = useMemo(() => {
    let mat = 0, rob = 0, matBuy = 0, robBase = 0;
    for (const it of items) {
      const mClient = Number(it.cena_mat) * (1 + marzaMat);
      const rClient = Number(it.cena_rob) * (1 + marzaRob);
      mat += Number(it.ilosc) * mClient;
      rob += Number(it.ilosc) * rClient;
      matBuy += Number(it.ilosc) * Number(it.cena_mat);
      robBase += Number(it.ilosc) * Number(it.cena_rob);
    }
    return { mat, rob, total: mat + rob, matBuy, robBase, zysk: (mat - matBuy) + (rob - robBase) };
  }, [items, marzaMat, marzaRob]);

  // Persist sums on change (debounced via change detection)
  useEffect(() => {
    if (!estimate) return;
    const newMat = Math.round(totals.mat * 100) / 100;
    const newRob = Math.round(totals.rob * 100) / 100;
    if (Math.abs(newMat - Number(estimate.suma_material)) > 0.01 || Math.abs(newRob - Number(estimate.suma_robocizna)) > 0.01) {
      updateEstimate.mutate({ id: estimate.id, patch: { suma_material: newMat, suma_robocizna: newRob } as any });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.mat, totals.rob, estimate?.id]);

  const handleAddFromCatalog = async (cat: CatalogItem) => {
    if (!estimate) return;
    const stageId = activeStageId ?? (stages[0]?.id ?? null);
    const ord = items.filter((i) => i.stage_id === stageId).length + 1;
    await addItem.mutateAsync({
      estimate_id: estimate.id,
      stage_id: stageId,
      catalog_id: cat.id,
      ordinal: ord,
      nazwa: cat.nazwa,
      jednostka: cat.jednostka,
      ilosc: 1,
      cena_mat: cat.cena_zakupu_materialu,
      cena_rob: cat.cena_robocizny_netto,
    });
  };

  const handleAddStage = async () => {
    if (!estimate) return;
    const next = stages.length + 1;
    const s = await addStage.mutateAsync({ estimate_id: estimate.id, name: `Etap ${next}`, ordinal: next });
    setActiveStageId(s.id);
  };

  const handleQty = (itemId: string, val: string) => {
    if (!estimate) return;
    const num = parseFloat(val.replace(",", ".")) || 0;
    updateItem.mutate({ id: itemId, estimate_id: estimate.id, patch: { ilosc: num } });
  };

  const handlePdf = (variant: "client" | "internal") => {
    if (!estimate) return;
    if (items.length === 0) {
      toast.error("Brak pozycji w kosztorysie");
      return;
    }
    generateEstimatePdf({ estimate, stages, items, company: company as any, variant });
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-screen"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AppLayout>;
  }
  if (!estimate) {
    return <AppLayout><div className="p-6">Nie znaleziono kosztorysu.</div></AppLayout>;
  }

  const showWymiary = estimate.branza === "Meble";

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
              <Calculator className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <Input
                defaultValue={estimate.nazwa_kosztorysu}
                onBlur={(e) => e.target.value !== estimate.nazwa_kosztorysu && updateEstimate.mutate({ id: estimate.id, patch: { nazwa_kosztorysu: e.target.value } as any })}
                className="h-8 font-semibold text-base border-0 px-0 focus-visible:ring-0 bg-transparent"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn("text-[10px]", branzaColor[estimate.branza])}>{estimate.branza}</Badge>
                {estimate.client_name && <span className="text-xs text-muted-foreground">• {estimate.client_name}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
              <Label className="text-[10px] uppercase text-muted-foreground">Marża mat.</Label>
              <Input
                type="number"
                defaultValue={estimate.marza_material}
                onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { marza_material: parseFloat(e.target.value) || 0 } as any })}
                className="h-7 w-16 text-sm"
              /><span className="text-xs">%</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
              <Label className="text-[10px] uppercase text-muted-foreground">Marża rob.</Label>
              <Input
                type="number"
                defaultValue={estimate.marza_robocizna}
                onBlur={(e) => updateEstimate.mutate({ id: estimate.id, patch: { marza_robocizna: parseFloat(e.target.value) || 0 } as any })}
                className="h-7 w-16 text-sm"
              /><span className="text-xs">%</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => handlePdf("internal")}>
              <FileDown className="h-4 w-4 mr-2" />Wewnętrzny PDF
            </Button>
            <Button size="sm" onClick={() => handlePdf("client")}>
              <FileDown className="h-4 w-4 mr-2" />Oferta dla klienta
            </Button>
          </div>
        </div>

        {/* Body: split view */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Catalog */}
          <div className="w-[420px] border-r flex flex-col bg-muted/20">
            <div className="p-4 border-b bg-card">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5" /> Cennik bazowy — {estimate.branza}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj pozycji..." className="pl-9 h-9" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {showWymiary ? "Branża Meble — pole 'Wymiary' dostępne przy pozycjach." : "Kliknij pozycję → wskakuje do aktywnego etapu."}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {grouped.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Brak pozycji. <Button variant="link" className="h-auto p-0" onClick={() => navigate("/catalog")}>Dodaj do cennika</Button>
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
                            <div className="text-sm font-medium truncate">{c.nazwa}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Mat. {fmt(Number(c.cena_zakupu_materialu))} + Rob. {fmt(Number(c.cena_robocizny_netto))} / {c.jednostka}
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

          {/* RIGHT: Active estimate */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Stage tabs */}
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
                <Plus className="h-4 w-4 mr-1" />Etap
              </Button>
            </div>

            {/* Items list */}
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
                          if (confirm(`Usunąć etap "${stage.name}"?`)) deleteStage.mutate({ id: stage.id, estimate_id: estimate.id });
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {stageItems.length === 0 ? (
                      <div className="py-10 text-center text-sm text-muted-foreground">
                        Wybierz pozycje z cennika po lewej stronie.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className={cn(
                          "grid gap-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold",
                          showWymiary ? "grid-cols-[1fr_120px_70px_80px_110px_110px_120px_36px]" : "grid-cols-[1fr_70px_80px_110px_110px_120px_36px]"
                        )}>
                          <div>Pozycja</div>
                          {showWymiary && <div>Wymiary</div>}
                          <div className="text-right">Ilość</div>
                          <div>J.m.</div>
                          <div className="text-right">Mat. (z marżą)</div>
                          <div className="text-right">Rob. (z marżą)</div>
                          <div className="text-right">Suma</div>
                          <div></div>
                        </div>
                        {stageItems.map((it) => {
                          const matU = Number(it.cena_mat) * (1 + marzaMat);
                          const robU = Number(it.cena_rob) * (1 + marzaRob);
                          const sum = Number(it.ilosc) * (matU + robU);
                          return (
                            <div key={it.id} className={cn(
                              "grid gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 items-center",
                              showWymiary ? "grid-cols-[1fr_120px_70px_80px_110px_110px_120px_36px]" : "grid-cols-[1fr_70px_80px_110px_110px_120px_36px]"
                            )}>
                              <div className="text-sm font-medium truncate">{it.nazwa}</div>
                              {showWymiary && (
                                <Input
                                  defaultValue={it.wymiary ?? ""}
                                  placeholder="np. 60x40"
                                  onBlur={(e) => e.target.value !== (it.wymiary ?? "") && updateItem.mutate({ id: it.id, estimate_id: estimate.id, patch: { wymiary: e.target.value || null } as any })}
                                  className="h-7 text-xs"
                                />
                              )}
                              <Input
                                type="number"
                                step="0.01"
                                defaultValue={it.ilosc}
                                onBlur={(e) => handleQty(it.id, e.target.value)}
                                className="h-7 text-right tabular-nums text-sm"
                              />
                              <div className="text-xs text-muted-foreground">{it.jednostka}</div>
                              <div className="text-right text-sm tabular-nums text-muted-foreground">{fmt(matU)}</div>
                              <div className="text-right text-sm tabular-nums text-muted-foreground">{fmt(robU)}</div>
                              <div className="text-right font-semibold text-sm tabular-nums">{fmt(sum)}</div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteItem.mutate({ id: it.id, estimate_id: estimate.id })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Totals footer */}
            <div className="border-t bg-card px-6 py-4">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Materiały</div>
                    <div className="font-semibold tabular-nums">{fmt(totals.mat)} PLN</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Robocizna</div>
                    <div className="font-semibold tabular-nums">{fmt(totals.rob)} PLN</div>
                  </div>
                  <div className="hidden lg:block">
                    <div className="text-[10px] uppercase text-emerald-600 tracking-wide">Zysk szac.</div>
                    <div className="font-semibold tabular-nums text-emerald-600">{fmt(totals.zysk)} PLN</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Suma końcowa</div>
                  <div className="text-2xl font-bold tabular-nums text-primary">{fmt(totals.total)} <span className="text-sm font-normal text-muted-foreground">PLN</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default EstimateBuilder;
