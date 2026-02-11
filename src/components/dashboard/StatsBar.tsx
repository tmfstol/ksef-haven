import { FileText, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { Invoice } from "@/types/invoice";

interface StatsBarProps {
  invoices: Invoice[];
}

export function StatsBar({ invoices }: StatsBarProps) {
  const total = invoices.length;
  const processed = invoices.filter((i) => i.status === "processed").length;
  const newCount = invoices.filter((i) => i.status === "new").length;
  const errors = invoices.filter((i) => i.status === "error").length;
  const totalGross = invoices.reduce((sum, i) => sum + i.grossAmount, 0);

  const stats = [
    { label: "Total Invoices", value: total, icon: FileText, color: "text-primary" },
    { label: "Processed", value: processed, icon: CheckCircle2, color: "text-success" },
    { label: "New", value: newCount, icon: Clock, color: "text-warning" },
    { label: "Errors", value: errors, icon: AlertCircle, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-panel rounded-2xl p-4 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl bg-secondary/80 flex items-center justify-center ${stat.color}`}>
            <stat.icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
