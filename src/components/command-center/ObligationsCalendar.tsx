import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UnpaidInvoice {
  id: string;
  vendor: string;
  date: string;
  gross_amount: number;
  status: string;
  ksef_number: string | null;
  invoice_type: string;
  days_since: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nowa",
  verified: "Zweryfikowana",
  sent: "Wysłana",
};

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(v);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export function ObligationsCalendar({ invoices }: { invoices: UnpaidInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <Card className="glass-panel border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Zobowiązania</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">Wszystkie faktury opłacone 🎉</p>
        </CardContent>
      </Card>
    );
  }

  const totalUnpaid = invoices.reduce((s, i) => s + i.gross_amount, 0);

  return (
    <Card className="glass-panel border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Zobowiązania</CardTitle>
            <p className="text-xs text-muted-foreground">Nieopłacone faktury ({invoices.length})</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatPln(totalUnpaid)}</p>
            <p className="text-xs text-muted-foreground">do zapłaty</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/40 transition-colors"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                inv.days_since > 30 ? "bg-destructive/10 text-destructive" : inv.days_since > 14 ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"
              }`}>
                {inv.days_since > 30 ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{inv.vendor}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(inv.date)}</span>
                  <span>•</span>
                  <span>{inv.days_since} dni temu</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-foreground">{formatPln(inv.gross_amount)}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {STATUS_LABELS[inv.status] || inv.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
