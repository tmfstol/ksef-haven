import { ArrowUpRight, ArrowDownRight, Minus, DollarSign, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface KpiData {
  revenue: number; costs: number; profit: number; invoiceCount: number;
  prevRevenue: number; prevCosts: number; prevProfit: number; prevInvoiceCount: number;
}

function formatPln(amount: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function TrendBadge({ current, previous, invertColor = false }: { current: number; previous: number; invertColor?: boolean }) {
  if (previous === 0 && current === 0) return <span className="text-[11px] text-muted-foreground">—</span>;
  const pct = previous === 0 ? 100 : Math.abs(Math.round(((current - previous) / Math.abs(previous)) * 100));
  const isUp = current > previous;
  const isPositive = invertColor ? !isUp : isUp;
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${isPositive ? "text-accent" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />{pct}%
    </span>
  );
}

export function KpiCards({ kpis }: { kpis: KpiData }) {
  const cards = [
    { label: "Przychody", value: formatPln(kpis.revenue), current: kpis.revenue, previous: kpis.prevRevenue, icon: ArrowUpRight, bgColor: "bg-accent/10", iconColor: "text-accent" },
    { label: "Koszty", value: formatPln(kpis.costs), current: kpis.costs, previous: kpis.prevCosts, icon: ArrowDownRight, bgColor: "bg-destructive/10", iconColor: "text-destructive", invertColor: true },
    { label: "Zysk", value: formatPln(kpis.profit), current: kpis.profit, previous: kpis.prevProfit, icon: DollarSign, bgColor: kpis.profit >= 0 ? "bg-accent/10" : "bg-destructive/10", iconColor: kpis.profit >= 0 ? "text-accent" : "text-destructive" },
    { label: "Faktury", value: String(kpis.invoiceCount), current: kpis.invoiceCount, previous: kpis.prevInvoiceCount, icon: FileText, bgColor: "bg-primary/10", iconColor: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="fintech-card">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${c.bgColor}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{c.value}</div>
            <div className="mt-1 flex items-center gap-1">
              <TrendBadge current={c.current} previous={c.previous} invertColor={c.invertColor} />
              <span className="text-[10px] text-muted-foreground">vs ub. mies.</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
