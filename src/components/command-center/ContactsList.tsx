import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Contact {
  id: string;
  name: string;
  nip: string | null;
  total_revenue: number;
  total_cost: number;
  invoice_count: number;
  last_invoice_date: string | null;
  payment_reliability: string;
}

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(v);
}

const RELIABILITY_LABELS: Record<string, { label: string; color: string }> = {
  good: { label: "Terminowy", color: "bg-accent/10 text-accent" },
  average: { label: "Średni", color: "bg-warning/10 text-warning" },
  poor: { label: "Opóźnienia", color: "bg-destructive/10 text-destructive" },
  unknown: { label: "Brak danych", color: "bg-secondary text-muted-foreground" },
};

export function ContactsList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <Card className="fintech-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Kontrahenci
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Kontrahenci pojawią się automatycznie po synchronizacji faktur z KSeF
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fintech-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Kontrahenci ({contacts.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground">Automatycznie z danych faktur KSeF</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin">
          {contacts.slice(0, 15).map((c) => {
            const r = RELIABILITY_LABELS[c.payment_reliability] || RELIABILITY_LABELS.unknown;
            const totalVolume = c.total_revenue + c.total_cost;
            const isRevenue = c.total_revenue > c.total_cost;
            return (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {c.nip && <span>NIP: {c.nip}</span>}
                    <span>·</span>
                    <span>{c.invoice_count} faktur</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <div className="flex items-center gap-1 justify-end">
                    {isRevenue ? <TrendingUp className="h-3 w-3 text-accent" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                    <span className="text-xs font-semibold text-foreground">{formatPln(totalVolume)}</span>
                  </div>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${r.color}`}>
                    {r.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
