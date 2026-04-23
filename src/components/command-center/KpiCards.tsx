import { ArrowUpRight, ArrowDownRight, Wallet, Receipt, TrendingUp, FileText } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";

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
    <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ${isPositive ? "text-accent bg-accent/10" : "text-destructive bg-destructive/10"}`}>
      <Icon className="h-3 w-3" />{pct}%
    </span>
  );
}

function AnimatedNumber({ value, isCurrency = true }: { value: number; isCurrency?: boolean }) {
  const v = useCountUp(value);
  return <>{isCurrency ? formatPln(v) : Math.round(v).toString()}</>;
}

export function KpiCards({ kpis }: { kpis: KpiData }) {
  const cards = [
    { label: "Przychody", value: kpis.revenue, current: kpis.revenue, previous: kpis.prevRevenue, icon: Wallet, bgColor: "bg-accent/10", iconColor: "text-accent", isCurrency: true },
    { label: "Koszty", value: kpis.costs, current: kpis.costs, previous: kpis.prevCosts, icon: Receipt, bgColor: "bg-destructive/10", iconColor: "text-destructive", invertColor: true, isCurrency: true },
    { label: "Zysk", value: kpis.profit, current: kpis.profit, previous: kpis.prevProfit, icon: TrendingUp, bgColor: kpis.profit >= 0 ? "bg-accent/10" : "bg-destructive/10", iconColor: kpis.profit >= 0 ? "text-accent" : "text-destructive", isCurrency: true },
    { label: "Faktury", value: kpis.invoiceCount, current: kpis.invoiceCount, previous: kpis.prevInvoiceCount, icon: FileText, bgColor: "bg-primary/10", iconColor: "text-primary", isCurrency: false },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {cards.map((c, idx) => (
        <div
          key={c.label}
          className="pulse-kpi p-4 md:p-5 pulse-fade-up"
          style={{ animationDelay: `${idx * 70}ms` }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{c.label}</span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.bgColor}`}>
              <c.icon className={`h-4 w-4 ${c.iconColor}`} />
            </div>
          </div>
          <div className="text-2xl md:text-[28px] font-bold text-foreground tracking-tight tabular-nums leading-none">
            <AnimatedNumber value={c.value} isCurrency={c.isCurrency} />
          </div>
          <div className="mt-2.5 flex items-center gap-1.5">
            <TrendBadge current={c.current} previous={c.previous} invertColor={c.invertColor} />
            <span className="text-[10px] text-muted-foreground">vs ub. mies.</span>
          </div>
        </div>
      ))}
    </div>
  );
}
