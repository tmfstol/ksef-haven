import { TrendingUp, TrendingDown, Minus, DollarSign, FileText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiData {
  revenue: number;
  costs: number;
  profit: number;
  invoiceCount: number;
  prevRevenue: number;
  prevCosts: number;
  prevProfit: number;
  prevInvoiceCount: number;
}

function formatPln(amount: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function trendPercent(current: number, previous: number): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { value: 0, direction: "flat" };
  if (previous === 0) return { value: 100, direction: "up" };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { value: Math.abs(Math.round(pct)), direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

function TrendBadge({ current, previous, invertColor = false }: { current: number; previous: number; invertColor?: boolean }) {
  const t = trendPercent(current, previous);
  if (t.direction === "flat") return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> 0%</span>;

  const isPositive = invertColor ? t.direction === "down" : t.direction === "up";
  const color = isPositive ? "text-emerald-600" : "text-red-500";
  const Icon = t.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return <span className={`text-xs font-medium flex items-center gap-0.5 ${color}`}><Icon className="h-3 w-3" />{t.value}%</span>;
}

export function KpiCards({ kpis }: { kpis: KpiData }) {
  const cards = [
    { label: "Przychody", value: formatPln(kpis.revenue), current: kpis.revenue, previous: kpis.prevRevenue, icon: ArrowUpRight, iconColor: "text-emerald-500 bg-emerald-50" },
    { label: "Koszty", value: formatPln(kpis.costs), current: kpis.costs, previous: kpis.prevCosts, icon: ArrowDownRight, iconColor: "text-red-500 bg-red-50", invertColor: true },
    { label: "Zysk netto", value: formatPln(kpis.profit), current: kpis.profit, previous: kpis.prevProfit, icon: DollarSign, iconColor: kpis.profit >= 0 ? "text-emerald-500 bg-emerald-50" : "text-red-500 bg-red-50" },
    { label: "Faktury w miesiącu", value: String(kpis.invoiceCount), current: kpis.invoiceCount, previous: kpis.prevInvoiceCount, icon: FileText, iconColor: "text-primary bg-primary/10" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="glass-panel border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.iconColor}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{c.value}</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <TrendBadge current={c.current} previous={c.previous} invertColor={c.invertColor} />
              <span className="text-xs text-muted-foreground">vs poprzedni miesiąc</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
