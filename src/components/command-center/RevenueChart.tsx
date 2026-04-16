import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  costs: number;
  expenseCosts: number;
}

function formatPln(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
};

export function RevenueChart({ data }: { data: MonthlyData[] }) {
  const chartData = data.map((d) => ({
    ...d,
    totalCosts: d.costs + d.expenseCosts,
  }));

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Przychody vs Koszty</CardTitle>
        <p className="text-xs text-muted-foreground">Ostatnie 6 miesięcy</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={formatPln} className="text-muted-foreground" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Przychody" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalCosts" name="Koszty" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
