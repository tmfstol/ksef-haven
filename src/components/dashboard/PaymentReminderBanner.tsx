import { useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { Invoice } from "@/types/invoice";

interface Props {
  invoices: Invoice[];
}

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function PaymentReminderBanner({ invoices }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { overdue, dueSoon, totalAmount } = useMemo(() => {
    const overdue: Array<Invoice & { _days: number }> = [];
    const dueSoon: Array<Invoice & { _days: number }> = [];
    for (const inv of invoices) {
      if (inv.invoice_type !== "kosztowa") continue;
      if (inv.payment_status === "paid") continue;
      const d = daysUntil(inv.payment_due_date || inv.date);
      if (d === null) continue;
      if (d < 0) overdue.push({ ...inv, _days: d });
      else if (d <= 3) dueSoon.push({ ...inv, _days: d });
    }
    overdue.sort((a, b) => a._days - b._days);
    dueSoon.sort((a, b) => a._days - b._days);
    const all = [...overdue, ...dueSoon];
    const totalAmount = all.reduce((s, i) => s + Number(i.gross_amount || 0), 0);
    return { overdue, dueSoon, totalAmount };
  }, [invoices]);

  if (overdue.length === 0 && dueSoon.length === 0) return null;

  const handleMarkPaid = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from("invoices")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    if (error) toast.error("Błąd aktualizacji");
    else {
      toast.success("Oznaczono jako opłacone");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const isCritical = overdue.length > 0;
  const list = [...overdue, ...dueSoon];

  return (
    <div className={`mb-3 rounded-xl border p-3 ${isCritical ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
      <button type="button" onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5 min-w-0">
          {isCritical ? (
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          ) : (
            <Clock className="h-5 w-5 text-warning flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isCritical
                ? `${overdue.length} ${overdue.length === 1 ? "faktura zaległa" : "faktur zaległych"}`
                : `${dueSoon.length} ${dueSoon.length === 1 ? "faktura" : "faktur"} z terminem w najbliższych dniach`}
              {isCritical && dueSoon.length > 0 && ` · ${dueSoon.length} wkrótce`}
            </p>
            <p className="text-xs text-muted-foreground">
              Łącznie {formatPln(totalAmount)} — pamiętaj oznaczyć jako opłacone, jeśli już zapłaciłeś.
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
          {list.map((inv) => (
            <div key={inv.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/60 hover:bg-background transition-colors">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${inv._days < 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                {inv._days < 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{inv.vendor}</p>
                <p className="text-[11px] text-muted-foreground">
                  {inv._days < 0 ? `${Math.abs(inv._days)} dni po terminie` : inv._days === 0 ? "Termin dziś" : `za ${inv._days} dni`}
                  {inv.ksef_number && ` · ${inv.ksef_number}`}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatPln(Number(inv.gross_amount))}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-success hover:text-success hover:bg-success/10"
                disabled={busyId === inv.id}
                onClick={() => handleMarkPaid(inv.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Opłacone
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
