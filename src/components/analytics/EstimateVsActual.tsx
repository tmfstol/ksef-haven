import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import {
  Loader2, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Calculator, Receipt, Target,
} from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

interface Props {
  companyId: string;
}

interface ProjectAnalysis {
  id: string;
  name: string;
  status: string;
  estimateMaterial: number;
  estimateLabor: number;
  estimateTotal: number;
  estimateWithMargin: number;
  marzaMaterial: number;
  marzaRobocizna: number;
  actualCosts: number;
  invoiceCount: number;
  variance: number;
  variancePct: number;
  health: "good" | "warning" | "critical" | "no-data";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground tabular-nums">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export function EstimateVsActual({ companyId }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["estimate-vs-actual", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [projectsRes, estimatesRes, costsRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, status, budget")
          .eq("company_id", companyId),
        supabase
          .from("estimates")
          .select("id, project_id, suma_material, suma_robocizna, marza_material, marza_robocizna, status")
          .eq("company_id", companyId),
        supabase
          .from("project_costs")
          .select("project_id, net_amount, gross_amount, invoice_id")
          .eq("company_id", companyId),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (estimatesRes.error) throw estimatesRes.error;
      if (costsRes.error) throw costsRes.error;

      return {
        projects: projectsRes.data || [],
        estimates: estimatesRes.data || [],
        costs: costsRes.data || [],
      };
    },
  });

  const analysis: ProjectAnalysis[] = useMemo(() => {
    if (!data) return [];

    return data.projects.map((p: any) => {
      const projectEstimates = data.estimates.filter((e: any) => e.project_id === p.id);
      const projectCosts = data.costs.filter((c: any) => c.project_id === p.id);

      const estimateMaterial = projectEstimates.reduce((s: number, e: any) => s + Number(e.suma_material || 0), 0);
      const estimateLabor = projectEstimates.reduce((s: number, e: any) => s + Number(e.suma_robocizna || 0), 0);
      const estimateTotal = estimateMaterial + estimateLabor;

      const avgMarzaMat = projectEstimates.length
        ? projectEstimates.reduce((s: number, e: any) => s + Number(e.marza_material || 0), 0) / projectEstimates.length
        : 0;
      const avgMarzaRob = projectEstimates.length
        ? projectEstimates.reduce((s: number, e: any) => s + Number(e.marza_robocizna || 0), 0) / projectEstimates.length
        : 0;

      const estimateWithMargin =
        estimateMaterial * (1 + avgMarzaMat / 100) +
        estimateLabor * (1 + avgMarzaRob / 100);

      const actualCosts = projectCosts.reduce((s: number, c: any) => s + Number(c.net_amount || 0), 0);
      const uniqueInvoices = new Set(projectCosts.map((c: any) => c.invoice_id));

      const variance = estimateTotal - actualCosts;
      const variancePct = estimateTotal > 0 ? (actualCosts / estimateTotal) * 100 - 100 : 0;

      let health: ProjectAnalysis["health"] = "no-data";
      if (estimateTotal > 0) {
        const usage = actualCosts / estimateTotal;
        if (usage >= 1.0) health = "critical";
        else if (usage >= 0.85) health = "warning";
        else health = "good";
      }

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        estimateMaterial,
        estimateLabor,
        estimateTotal,
        estimateWithMargin,
        marzaMaterial: avgMarzaMat,
        marzaRobocizna: avgMarzaRob,
        actualCosts,
        invoiceCount: uniqueInvoices.size,
        variance,
        variancePct,
        health,
      };
    });
  }, [data]);

  const filteredAnalysis = useMemo(() => {
    if (selectedProjectId === "all") {
      return analysis.filter((a) => a.estimateTotal > 0 || a.actualCosts > 0);
    }
    return analysis.filter((a) => a.id === selectedProjectId);
  }, [analysis, selectedProjectId]);

  const totals = useMemo(() => {
    const list = filteredAnalysis;
    const estimateTotal = list.reduce((s, a) => s + a.estimateTotal, 0);
    const estimateWithMargin = list.reduce((s, a) => s + a.estimateWithMargin, 0);
    const actualCosts = list.reduce((s, a) => s + a.actualCosts, 0);
    const variance = estimateTotal - actualCosts;
    const variancePct = estimateTotal > 0 ? (actualCosts / estimateTotal) * 100 - 100 : 0;
    const expectedProfit = estimateWithMargin - actualCosts;
    const margin = estimateWithMargin > 0 ? (expectedProfit / estimateWithMargin) * 100 : 0;

    return {
      estimateTotal,
      estimateWithMargin,
      actualCosts,
      variance,
      variancePct,
      expectedProfit,
      margin,
      projectCount: list.length,
      criticalCount: list.filter((a) => a.health === "critical").length,
      warningCount: list.filter((a) => a.health === "warning").length,
    };
  }, [filteredAnalysis]);

  const chartData = useMemo(
    () =>
      filteredAnalysis
        .filter((a) => a.estimateTotal > 0 || a.actualCosts > 0)
        .sort((a, b) => Math.max(b.estimateTotal, b.actualCosts) - Math.max(a.estimateTotal, a.actualCosts))
        .slice(0, 10)
        .map((a) => ({
          name: a.name.length > 18 ? a.name.slice(0, 18) + "…" : a.name,
          fullName: a.name,
          Kosztorys: Math.round(a.estimateTotal),
          Rzeczywiste: Math.round(a.actualCosts),
          health: a.health,
        })),
    [filteredAnalysis]
  );

  if (isLoading) {
    return (
      <Card className="fintech-card">
        <CardContent className="flex items-center justify-center h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (analysis.length === 0) {
    return (
      <Card className="fintech-card">
        <CardContent className="flex flex-col items-center justify-center h-[200px] text-center">
          <Calculator className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Brak projektów do analizy</p>
          <p className="text-xs text-muted-foreground mt-1">Dodaj projekty i kosztorysy, aby zobaczyć porównanie</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header z filtrem */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Kosztorys vs Koszty rzeczywiste</h2>
            <p className="text-xs text-muted-foreground">Analiza odchyleń budżetowych w projektach</p>
          </div>
        </div>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[220px] h-9 rounded-xl text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie projekty</SelectItem>
            {analysis.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI: Podsumowanie */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="fintech-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Wartość kosztorysów</span>
              <Calculator className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-foreground tabular-nums">{fmt(totals.estimateTotal)}</div>
            <div className="text-xs text-muted-foreground mt-1">netto, bez marży</div>
          </CardContent>
        </Card>

        <Card className="fintech-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Koszty rzeczywiste</span>
              <Receipt className="h-4 w-4 text-violet-500" />
            </div>
            <div className="text-lg font-bold text-foreground tabular-nums">{fmt(totals.actualCosts)}</div>
            <div className="text-xs text-muted-foreground mt-1">z faktur KSeF</div>
          </CardContent>
        </Card>

        <Card className="fintech-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Odchylenie</span>
              {totals.variance >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-500" />
              )}
            </div>
            <div className={`text-lg font-bold tabular-nums ${totals.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {totals.variance >= 0 ? "+" : ""}{fmt(totals.variance)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totals.variancePct >= 0 ? "Przekroczenie" : "Oszczędność"}: {fmtPct(totals.variancePct)}
            </div>
          </CardContent>
        </Card>

        <Card className="fintech-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Oczekiwany zysk</span>
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <div className={`text-lg font-bold tabular-nums ${totals.expectedProfit >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400"}`}>
              {fmt(totals.expectedProfit)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Marża: {totals.margin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert critical/warning */}
      {(totals.criticalCount > 0 || totals.warningCount > 0) && (
        <Card className="fintech-card border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {totals.criticalCount > 0 && (
                  <>Przekroczono budżet w <strong>{totals.criticalCount}</strong> {totals.criticalCount === 1 ? "projekcie" : "projektach"}. </>
                )}
                {totals.warningCount > 0 && (
                  <>{totals.warningCount} {totals.warningCount === 1 ? "projekt zbliża" : "projekty zbliżają"} się do limitu (≥85%).</>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Sprawdź szczegóły w tabeli poniżej.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wykres porównawczy */}
      {chartData.length > 0 && (
        <Card className="fintech-card">
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-semibold">Porównanie projektów</CardTitle>
            <p className="text-xs text-muted-foreground">Top 10 projektów wg wartości</p>
          </CardHeader>
          <CardContent>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    className="text-muted-foreground"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Kosztorys" fill="hsl(221, 83%, 53%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Rzeczywiste" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.health === "critical"
                            ? "hsl(346, 77%, 49%)"
                            : entry.health === "warning"
                            ? "hsl(38, 92%, 50%)"
                            : "hsl(160, 84%, 39%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela szczegółowa */}
      <Card className="fintech-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-semibold">Szczegóły projektów</CardTitle>
          <p className="text-xs text-muted-foreground">Materiał, robocizna i odchylenia</p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground">
                  <th className="text-left p-3 font-medium">Projekt</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">Materiał</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">Robocizna</th>
                  <th className="text-right p-3 font-medium">Kosztorys</th>
                  <th className="text-right p-3 font-medium">Rzeczywiste</th>
                  <th className="text-right p-3 font-medium">Wykorzystanie</th>
                  <th className="text-right p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnalysis
                  .sort((a, b) => {
                    const order = { critical: 0, warning: 1, good: 2, "no-data": 3 };
                    return order[a.health] - order[b.health];
                  })
                  .map((a) => {
                    const usage = a.estimateTotal > 0 ? (a.actualCosts / a.estimateTotal) * 100 : 0;
                    return (
                      <tr key={a.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                        <td className="p-3">
                          <div className="font-medium text-foreground">{a.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {a.invoiceCount} {a.invoiceCount === 1 ? "faktura" : "faktur"}
                          </div>
                        </td>
                        <td className="text-right p-3 hidden md:table-cell tabular-nums text-muted-foreground">
                          {a.estimateMaterial > 0 ? fmt(a.estimateMaterial) : "—"}
                        </td>
                        <td className="text-right p-3 hidden md:table-cell tabular-nums text-muted-foreground">
                          {a.estimateLabor > 0 ? fmt(a.estimateLabor) : "—"}
                        </td>
                        <td className="text-right p-3 tabular-nums font-medium text-foreground">
                          {a.estimateTotal > 0 ? fmt(a.estimateTotal) : "—"}
                        </td>
                        <td className="text-right p-3 tabular-nums font-medium text-foreground">
                          {fmt(a.actualCosts)}
                        </td>
                        <td className="text-right p-3 min-w-[120px]">
                          {a.estimateTotal > 0 ? (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16">
                                <Progress
                                  value={Math.min(usage, 100)}
                                  className={`h-1.5 ${
                                    a.health === "critical"
                                      ? "[&>div]:bg-rose-500"
                                      : a.health === "warning"
                                      ? "[&>div]:bg-amber-500"
                                      : "[&>div]:bg-emerald-500"
                                  }`}
                                />
                              </div>
                              <span className={`text-xs tabular-nums font-medium ${
                                a.health === "critical" ? "text-rose-600 dark:text-rose-400" :
                                a.health === "warning" ? "text-amber-600 dark:text-amber-400" :
                                "text-emerald-600 dark:text-emerald-400"
                              }`}>
                                {usage.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">brak kosztorysu</span>
                          )}
                        </td>
                        <td className="text-right p-3">
                          {a.health === "critical" ? (
                            <Badge variant="outline" className="border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Przekroczono
                            </Badge>
                          ) : a.health === "warning" ? (
                            <Badge variant="outline" className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Uwaga
                            </Badge>
                          ) : a.health === "good" ? (
                            <Badge variant="outline" className="border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              W normie
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Brak danych
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
