import { FileText, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { Invoice } from "@/types/invoice";

interface StatsBarProps {
  invoices: Invoice[];
  lastSeenTimestamp?: string | null;
}

export function StatsBar({ invoices, lastSeenTimestamp }: StatsBarProps) {
  const total = invoices.length;
  const processed = invoices.filter((i) => i.status === "processed").length;
  const newCount = lastSeenTimestamp
    ? invoices.filter((i) => i.created_at && i.created_at > lastSeenTimestamp).length
    : 0;
  const errors = invoices.filter((i) => i.status === "error").length;

  const stats = [
    { label: "Wszystkie", value: total, icon: FileText, color: "text-primary" },
    { label: "Przetworzone", value: processed, icon: CheckCircle2, color: "text-success" },
    { label: "Nowe", value: newCount, icon: Clock, color: "text-warning" },
    { label: "Błędy", value: errors, icon: AlertCircle, color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-panel rounded-2xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
          <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-secondary/80 flex items-center justify-center ${stat.color} shrink-0`}>
            <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
