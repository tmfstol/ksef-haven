import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface StatusCount {
  status: string;
  count: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nowe",
  verified: "Zweryfikowane",
  sent: "Wysłane",
  paid: "Opłacone",
  cancelled: "Anulowane",
};

const STATUS_COLORS: Record<string, string> = {
  new: "hsl(262, 83%, 58%)",
  verified: "hsl(38, 92%, 50%)",
  sent: "hsl(217, 91%, 60%)",
  paid: "hsl(142, 71%, 45%)",
  cancelled: "hsl(0, 0%, 60%)",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-popover border border-border rounded-lg p-2.5 shadow-lg text-sm">
      <p className="font-medium">{d.name}: <span className="text-primary">{d.value}</span></p>
    </div>
  );
};

export function StatusChart({ data }: { data: StatusCount[] }) {
  const chartData = data.map((d) => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count,
    color: STATUS_COLORS[d.status] || "hsl(240, 5%, 65%)",
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Statusy faktur</CardTitle>
        <p className="text-xs text-muted-foreground">Wszystkie faktury ({total})</p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => <span className="text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
