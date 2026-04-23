import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { EstimateVsActual } from "@/components/analytics/EstimateVsActual";

interface InvoiceRow {
  id: string;
  date: string;
  vendor: string;
  nip: string;
  gross_amount: number;
  invoice_type: string;
  payment_status: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(v);

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 70%, 55%)",
  "hsl(199, 89%, 48%)",
  "hsl(340, 82%, 52%)",
  "hsl(120, 40%, 45%)",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-sm">
      {label && <p className="font-semibold text-foreground mb-1.5">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey || p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || p.fill || p.stroke }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

const Analytics = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [monthsBack, setMonthsBack] = useState<number>(12);

  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      const active = companies.find((c) => c.is_active) ?? companies[0];
      setActiveCompanyId(active.id);
    }
  }, [companies, activeCompanyId]);

  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

  const activeCompany = useMemo(
    () => companies?.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  );

  const { data: invoices, isLoading: invoicesLoading } = useQuery<InvoiceRow[]>({
    queryKey: ["analytics-invoices", activeCompanyId, monthsBack],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - monthsBack + 1);
      since.setDate(1);
      const sinceStr = since.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("invoices")
        .select("id, date, vendor, nip, gross_amount, invoice_type, payment_status")
        .eq("company_id", activeCompanyId!)
        .gte("date", sinceStr)
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as InvoiceRow[];
    },
  });

  const stats = useMemo(() => {
    const list = invoices || [];
    const months: Record<string, { label: string; revenue: number; cost: number }> = {};
    const today = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pl-PL", { month: "short", year: "2-digit" });
      months[key] = { label, revenue: 0, cost: 0 };
    }
    let totalRevenue = 0;
    let totalCost = 0;
    let unpaidRevenue = 0;
    let unpaidCost = 0;
    const vendorAgg: Record<string, { name: string; cost: number; revenue: number; count: number }> = {};

    for (const inv of list) {
      const d = new Date(inv.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const amt = Number(inv.gross_amount) || 0;
      if (inv.invoice_type === "przychodowa") {
        totalRevenue += amt;
        if (months[key]) months[key].revenue += amt;
        if (inv.payment_status !== "paid") unpaidRevenue += amt;
      } else {
        totalCost += amt;
        if (months[key]) months[key].cost += amt;
        if (inv.payment_status !== "paid") unpaidCost += amt;
      }
      const vk = inv.nip || inv.vendor || "—";
      if (!vendorAgg[vk]) vendorAgg[vk] = { name: inv.vendor || "—", cost: 0, revenue: 0, count: 0 };
      vendorAgg[vk].count += 1;
      if (inv.invoice_type === "przychodowa") vendorAgg[vk].revenue += amt;
      else vendorAgg[vk].cost += amt;
    }

    const monthly = Object.values(months).map((m) => ({
      ...m,
      profit: m.revenue - m.cost,
    }));

    const topCostVendors = Object.values(vendorAgg)
      .filter((v) => v.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);

    const topRevenueVendors = Object.values(vendorAgg)
      .filter((v) => v.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    return {
      monthly,
      totalRevenue,
      totalCost,
      profit: totalRevenue - totalCost,
      margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      unpaidRevenue,
      unpaidCost,
      invoiceCount: list.length,
      topCostVendors,
      topRevenueVendors,
    };
  }, [invoices, monthsBack]);

  if (companiesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Analityka</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Przychody, koszty i marże w czasie</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(monthsBack)} onValueChange={(v) => setMonthsBack(Number(v))}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Ostatnie 3 mies.</SelectItem>
                <SelectItem value="6">Ostatnie 6 mies.</SelectItem>
                <SelectItem value="12">Ostatnie 12 mies.</SelectItem>
                <SelectItem value="24">Ostatnie 24 mies.</SelectItem>
              </SelectContent>
            </Select>
            {companies && companies.length > 1 ? (
              <Select value={activeCompanyId || ""} onValueChange={setActiveCompanyId}>
                <SelectTrigger className="w-[200px] h-9 rounded-xl text-sm">
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : activeCompany ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{activeCompany.name}</span>
              </div>
            ) : null}
          </div>
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="fintech-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Przychody</span>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold text-foreground">{fmt(stats.totalRevenue)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Niezapłacone: {fmt(stats.unpaidRevenue)}</div>
                </CardContent>
              </Card>
              <Card className="fintech-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Koszty</span>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="text-xl font-bold text-foreground">{fmt(stats.totalCost)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Do zapłaty: {fmt(stats.unpaidCost)}</div>
                </CardContent>
              </Card>
              <Card className="fintech-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Zysk brutto</span>
                    <Wallet className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className={`text-xl font-bold ${stats.profit >= 0 ? "text-foreground" : "text-red-500"}`}>
                    {fmt(stats.profit)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Marża: {stats.margin.toFixed(1)}%</div>
                </CardContent>
              </Card>
              <Card className="fintech-card">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Faktury</span>
                    <Receipt className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="text-xl font-bold text-foreground">{stats.invoiceCount}</div>
                  <div className="text-xs text-muted-foreground mt-1">w wybranym okresie</div>
                </CardContent>
              </Card>
            </div>

            {/* Cashflow chart */}
            <Card className="fintech-card">
              <CardHeader className="pb-1">
                <CardTitle className="text-base font-semibold">Cash-flow miesięczny</CardTitle>
                <p className="text-xs text-muted-foreground">Przychody, koszty i zysk w wybranym okresie</p>
              </CardHeader>
              <CardContent>
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.monthly}>
                      <defs>
                        <linearGradient id="aRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="aCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="aProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} className="text-muted-foreground" />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Area type="monotone" dataKey="revenue" name="Przychody" stroke="hsl(160, 84%, 39%)" fill="url(#aRev)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="cost" name="Koszty" stroke="hsl(0, 84%, 60%)" fill="url(#aCost)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="profit" name="Zysk" stroke="hsl(221, 83%, 53%)" fill="url(#aProfit)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Top vendors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="fintech-card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-semibold">Top kontrahenci — koszty</CardTitle>
                  <p className="text-xs text-muted-foreground">Najwięksi dostawcy</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {stats.topCostVendors.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Brak danych</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.topCostVendors} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} interval={0} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="cost" name="Koszty" fill="hsl(0, 84%, 60%)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="fintech-card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-semibold">Top klienci — przychody</CardTitle>
                  <p className="text-xs text-muted-foreground">Najwięksi odbiorcy</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {stats.topRevenueVendors.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Brak danych</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.topRevenueVendors} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} interval={0} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="revenue" name="Przychody" fill="hsl(160, 84%, 39%)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribution pie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="fintech-card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-semibold">Struktura kosztów</CardTitle>
                  <p className="text-xs text-muted-foreground">Udział top dostawców w kosztach</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {stats.topCostVendors.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Brak danych</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.topCostVendors} dataKey="cost" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                            {stats.topCostVendors.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="fintech-card">
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-semibold">Struktura przychodów</CardTitle>
                  <p className="text-xs text-muted-foreground">Udział top klientów w przychodach</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {stats.topRevenueVendors.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Brak danych</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stats.topRevenueVendors} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                            {stats.topRevenueVendors.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Analytics;
