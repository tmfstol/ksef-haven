import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface MonthlyData {
  label: string;
  revenue: number;
  costs: number;
  expenseCosts: number;
  profit: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(v);
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-md text-sm min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
              {p.name}
            </span>
            <span className="font-medium text-foreground tabular-nums">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function SmoothCashFlow({ data }: { data: MonthlyData[] }) {
  const chartData = data.map((d) => ({ ...d, totalCosts: d.costs + d.expenseCosts }));

  // Pastelowe, stonowane kolory dla enterprise look
  const REVENUE = "hsl(160 60% 45%)";  // pastelowy emerald
  const COSTS = "hsl(8 70% 60%)";      // zgaszony koralowy
  const PROFIT = "hsl(221 70% 55%)";   // stonowany niebieski

  return (
    <div className="bg-card border border-border rounded-xl p-5 md:p-6 h-full flex flex-col animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">Cash-flow</h2>
          </div>
          <p className="text-xs text-muted-foreground">Ostatnie 6 miesięcy</p>
        </div>
      </div>
      <div className="flex-1 min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={REVENUE} stopOpacity={0.28} />
                <stop offset="100%" stopColor={REVENUE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COSTS} stopOpacity={0.20} />
                <stop offset="100%" stopColor={COSTS} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PROFIT} stopOpacity={0.18} />
                <stop offset="100%" stopColor={PROFIT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
            <Area type="monotone" dataKey="revenue" name="Przychody" stroke={REVENUE} fill="url(#gradRev)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="totalCosts" name="Koszty" stroke={COSTS} fill="url(#gradCost)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            <Area type="monotone" dataKey="profit" name="Zysk" stroke={PROFIT} fill="url(#gradProf)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
