import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Upload, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Invoice {
  id: string;
  vendor: string;
  date: string;
  gross_amount: number;
  status: string;
  source: string;
  invoice_type: string;
  ksef_number: string | null;
  category: string | null;
  tags: string[];
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nowa", verified: "Zweryfikowana", sent: "Wysłana", paid: "Opłacona", cancelled: "Anulowana",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-primary/10 text-primary", verified: "bg-warning/10 text-warning",
  sent: "bg-blue-100 text-blue-600", paid: "bg-accent/10 text-accent", cancelled: "bg-secondary text-muted-foreground",
};

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(v);
}

export function SmartInbox({ invoices }: { invoices: Invoice[] }) {
  const recent = invoices.slice(0, 12);
  const ksefCount = invoices.filter((i) => i.source === "ksef").length;
  const manualCount = invoices.filter((i) => i.source === "manual").length;

  return (
    <Card className="fintech-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Smart Inbox</CardTitle>
            <p className="text-xs text-muted-foreground">{ksefCount} z KSeF · {manualCount} ręcznych</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin">
          {recent.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                inv.source === "ksef" ? "bg-primary/10" : "bg-warning/10"
              }`}>
                {inv.source === "ksef" ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Upload className="h-3.5 w-3.5 text-warning" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{inv.vendor}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>{new Date(inv.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}</span>
                  {inv.category && (
                    <>
                      <span>·</span>
                      <span className="text-primary">{inv.category}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-xs font-semibold ${inv.invoice_type === "przychodowa" ? "text-accent" : "text-foreground"}`}>
                  {inv.invoice_type === "przychodowa" ? "+" : "−"}{formatPln(inv.gross_amount)}
                </p>
                <Badge variant="outline" className={`text-[9px] px-1 py-0 border-0 ${STATUS_COLORS[inv.status] || ""}`}>
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
