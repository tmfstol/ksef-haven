import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Loader2, FileText, TrendingUp, TrendingDown, FileX } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  nip: string | null;
  city: string | null;
  total_revenue: number;
  total_cost: number;
  invoice_count: number;
  last_invoice_date: string | null;
  payment_reliability: string;
}

interface Invoice {
  id: string;
  ksef_number: string | null;
  date: string;
  gross_amount: number;
  invoice_type: string;
  payment_status: string;
  payment_due_date: string | null;
}

const RELIABILITY: Record<string, { label: string; color: string }> = {
  good: { label: "Terminowy", color: "bg-accent/10 text-accent" },
  average: { label: "Średni", color: "bg-warning/10 text-warning" },
  poor: { label: "Opóźnienia", color: "bg-destructive/10 text-destructive" },
  unknown: { label: "Brak danych", color: "bg-secondary text-muted-foreground" },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: "Opłacona", color: "bg-accent/10 text-accent" },
  unpaid: { label: "Nieopłacona", color: "bg-warning/10 text-warning" },
  overdue: { label: "Po terminie", color: "bg-destructive/10 text-destructive" },
};

const fmtPln = (v: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(v);

export function ContactInvoicesRow({ contact, companyId }: { contact: Contact; companyId: string }) {
  const [open, setOpen] = useState(false);
  const r = RELIABILITY[contact.payment_reliability] || RELIABILITY.unknown;
  const total = Number(contact.total_revenue) + Number(contact.total_cost);
  const isRevenue = Number(contact.total_revenue) >= Number(contact.total_cost);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["contact-invoices", companyId, contact.nip, contact.name],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("invoices")
        .select("id, ksef_number, date, gross_amount, invoice_type, payment_status, payment_due_date")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .limit(100);
      if (contact.nip && !contact.nip.startsWith("BRAK-")) {
        q = q.eq("nip", contact.nip);
      } else {
        q = q.eq("vendor", contact.name);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Invoice[];
    },
  });

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors text-left"
      >
        <div className="flex-shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {contact.nip && !contact.nip.startsWith("BRAK-") && <span>NIP: {contact.nip}</span>}
            {contact.city && <><span>·</span><span>{contact.city}</span></>}
            <span>·</span>
            <span>{contact.invoice_count} faktur</span>
            {contact.last_invoice_date && (
              <><span>·</span><span>Ostatnia: {new Date(contact.last_invoice_date).toLocaleDateString("pl-PL")}</span></>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          <div className="flex items-center gap-1.5 justify-end">
            {isRevenue ? (
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-sm font-bold text-foreground">{fmtPln(total)}</span>
          </div>
          <Badge variant="outline" className={`text-[10px] px-2 py-0 border-0 ${r.color}`}>
            {r.label}
          </Badge>
        </div>
      </button>

      {open && (
        <div className="bg-secondary/20 border-t border-border px-4 py-3">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !invoices || invoices.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <FileX className="h-4 w-4" /> Brak faktur dla tego kontrahenta
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="col-span-4">Numer KSeF</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Typ</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Kwota brutto</div>
              </div>
              {invoices.map((inv) => {
                const ps = PAYMENT_STATUS[inv.payment_status] || PAYMENT_STATUS.unpaid;
                return (
                  <div
                    key={inv.id}
                    className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-card/60 transition-colors text-xs"
                  >
                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-foreground truncate" title={inv.ksef_number ?? ""}>
                        {inv.ksef_number ?? "—"}
                      </span>
                    </div>
                    <div className="col-span-2 text-muted-foreground">
                      {new Date(inv.date).toLocaleDateString("pl-PL")}
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0 bg-primary/10 text-primary">
                        {inv.invoice_type === "przychodowa" ? "Przychód" : "Koszt"}
                      </Badge>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border-0 ${ps.color}`}>
                        {ps.label}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-right font-semibold text-foreground">
                      {fmtPln(Number(inv.gross_amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
