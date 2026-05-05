import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, QrCode, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { PaymentQrModal } from "@/components/payments/PaymentQrModal";
import { buildInvoicePaymentDetails, extractPaymentDetailsFromXml, getPaymentQrBlockReason, type InvoicePaymentDetails } from "@/lib/invoice-payment";

interface Payment {
  id: string;
  vendor: string;
  date: string;
  gross_amount: number;
  payment_due_date: string | null;
  payment_status: string;
  days_until_due: number;
  source: string;
  ksef_number: string | null;
}

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 2 }).format(v);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

function generateEpcQr(vendor: string, amount: number, _nip?: string): string {
  // EPC QR code standard - returns data URL for QR
  const data = `BCD\n002\n1\nSCT\n\n${vendor}\n\n${amount.toFixed(2)}\nEUR\n\n\nFaktura\n`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

export function UpcomingPayments({ payments, companyId }: { payments: Payment[]; companyId: string | null }) {
  const [qrPayment, setQrPayment] = useState<Payment | null>(null);
  const [qrDetails, setQrDetails] = useState<InvoicePaymentDetails>(buildInvoicePaymentDetails({}));

  const handleMarkPaid = async (invoiceId: string) => {
    if (!companyId) return;
    const { error } = await supabase
      .from("invoices")
      .update({ payment_status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoiceId);
    if (error) toast.error("Błąd aktualizacji statusu");
    else toast.success("Oznaczono jako opłacone");
  };

  const handleQr = async (p: Payment) => {
    let details = buildInvoicePaymentDetails({});
    if (p.ksef_number) {
      try {
        const { data } = await supabase.functions.invoke("ksef-download", { body: { invoice_id: p.id, format: "xml" } });
        if (data?.xml) {
          details = extractPaymentDetailsFromXml(data.xml);
          if (details.iban) {
            supabase.from("invoices").update({ vat_whitelist_account: details.iban } as any).eq("id", p.id);
          }
        }
      } catch {}
    }
    setQrDetails(details);
    setQrPayment(p);
  };

  const urgent = payments.filter((p) => p.days_until_due <= 7);
  const total = payments.reduce((s, p) => s + p.gross_amount, 0);

  return (
    <Card className="fintech-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Nadchodzące płatności</CardTitle>
            <p className="text-xs text-muted-foreground">{urgent.length} pilnych — razem {formatPln(total)}</p>
          </div>
          {urgent.length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 rounded-full">
              {urgent.length} pilne
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Brak nieopłaconych faktur 🎉</p>
          ) : (
            payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors group">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  p.days_until_due < 0 ? "bg-destructive/10 text-destructive" : p.days_until_due <= 7 ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"
                }`}>
                  {p.days_until_due < 0 ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{p.vendor}</p>
                    {p.source === "ksef" && (
                      <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">KSeF</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {p.days_until_due < 0 ? `${Math.abs(p.days_until_due)} dni po terminie` : p.days_until_due === 0 ? "Dziś!" : `za ${p.days_until_due} dni`}
                    {p.payment_due_date && ` · ${formatDate(p.payment_due_date)}`}
                  </p>
                </div>
                <div className="text-right flex items-center gap-1">
                  <span className="text-sm font-semibold text-foreground">{formatPln(p.gross_amount)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleQr(p)} title="QR płatności">
                    <QrCode className="h-3.5 w-3.5 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleMarkPaid(p.id)} title="Oznacz jako opłacone">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      {qrPayment && (
        <PaymentQrModal
          open={!!qrPayment}
          onOpenChange={(v) => !v && setQrPayment(null)}
          vendorName={qrPayment.vendor}
          iban={qrDetails.iban}
          amount={qrPayment.gross_amount}
          title={qrPayment.ksef_number || `Faktura ${qrPayment.vendor}`}
          paymentMethodLabel={qrDetails.paymentMethodLabel}
          blockReason={getPaymentQrBlockReason(qrDetails)}
        />
      )}
    </Card>
  );
}
