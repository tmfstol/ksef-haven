import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCompanies } from "@/hooks/useCompanies";
import { useInvoices } from "@/hooks/useInvoices";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, CheckCircle2, Loader2, QrCode, Building2, Wallet } from "lucide-react";
import { PaymentQrModal } from "@/components/payments/PaymentQrModal";
import { buildInvoicePaymentDetails, extractPaymentDetailsFromXml, getPaymentQrBlockReason, type InvoicePaymentDetails } from "@/lib/invoice-payment";
import type { Invoice } from "@/types/invoice";

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(v);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

type Bucket = "overdue" | "today" | "soon" | "later" | "paid";

const Payments = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const { data: invoices, isLoading } = useInvoices(activeCompanyId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unpaid" | "overdue" | "paid">("unpaid");
  const [qrInvoice, setQrInvoice] = useState<Invoice | null>(null);
  const [qrDetails, setQrDetails] = useState<InvoicePaymentDetails>(buildInvoicePaymentDetails({}));

  useEffect(() => {
    if (!companiesLoading && (!companies || companies.length === 0)) {
      navigate("/onboarding", { replace: true });
    }
  }, [companies, companiesLoading, navigate]);

  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(companies[0].id);
    }
  }, [companies, activeCompanyId]);

  const enriched = useMemo(() => {
    return (invoices || [])
      .filter((i) => i.invoice_type === "kosztowa")
      .map((inv) => {
        const isCash = inv.payment_method === "1";
        const effectivePaymentStatus = isCash ? "paid" : inv.payment_status;
        const due = inv.payment_due_date || inv.date;
        const days = daysUntil(due);
        let bucket: Bucket = "later";
        if (effectivePaymentStatus === "paid") bucket = "paid";
        else if (days === null) bucket = "later";
        else if (days < 0) bucket = "overdue";
        else if (days === 0) bucket = "today";
        else if (days <= 7) bucket = "soon";
        return { ...inv, payment_status: effectivePaymentStatus, _isCash: isCash, _due: due, _days: days, _bucket: bucket };
      });
  }, [invoices]);

  const stats = useMemo(() => {
    const overdue = enriched.filter((i) => i._bucket === "overdue");
    const today = enriched.filter((i) => i._bucket === "today");
    const soon = enriched.filter((i) => i._bucket === "soon");
    const unpaid = enriched.filter((i) => i.payment_status !== "paid");
    const sum = (arr: typeof enriched) => arr.reduce((s, i) => s + Number(i.gross_amount || 0), 0);
    return {
      overdueCount: overdue.length,
      overdueAmount: sum(overdue),
      todayCount: today.length,
      todayAmount: sum(today),
      soonCount: soon.length,
      soonAmount: sum(soon),
      unpaidAmount: sum(unpaid),
    };
  }, [enriched]);

  const visible = useMemo(() => {
    let list = enriched;
    if (filter === "unpaid") list = list.filter((i) => i.payment_status !== "paid");
    else if (filter === "overdue") list = list.filter((i) => i._bucket === "overdue");
    else if (filter === "paid") list = list.filter((i) => i.payment_status === "paid");
    return list.sort((a, b) => {
      if (a.payment_status === "paid" && b.payment_status !== "paid") return 1;
      if (b.payment_status === "paid" && a.payment_status !== "paid") return -1;
      return (a._days ?? 1e9) - (b._days ?? 1e9);
    });
  }, [enriched, filter]);

  const handleMarkPaid = async (inv: Invoice & { _isCash?: boolean }) => {
    if (inv._isCash) {
      toast.info("Faktura gotówkowa jest zawsze opłacona");
      return;
    }
    setBusyId(inv.id);
    const isPaid = inv.payment_status === "paid";
    const { error } = await supabase
      .from("invoices")
      .update({
        payment_status: isPaid ? "unpaid" : "paid",
        paid_at: isPaid ? null : new Date().toISOString(),
      })
      .eq("id", inv.id);
    setBusyId(null);
    if (error) toast.error("Błąd aktualizacji");
    else {
      toast.success(isPaid ? "Cofnięto oznaczenie" : "Oznaczono jako opłacone");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const handleOpenQr = async (inv: Invoice) => {
    let details = buildInvoicePaymentDetails({ iban: inv.vat_whitelist_account });
    if (inv.ksef_number) {
      try {
        const { data } = await supabase.functions.invoke("ksef-download", {
          body: { invoice_id: inv.id, format: "xml" },
        });
        if (data?.xml) details = extractPaymentDetailsFromXml(data.xml);
      } catch (e) {
        console.warn("QR fetch failed", e);
      }
    }
    setQrDetails(details);
    setQrInvoice(inv);
  };

  if (companiesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" /> Płatności
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Pilnuj terminów i oznaczaj opłacone faktury, by nic Cię nie zaskoczyło.
            </p>
          </div>
          {companies && companies.length > 1 ? (
            <Select value={activeCompanyId || ""} onValueChange={setActiveCompanyId}>
              <SelectTrigger className="w-[220px] h-9 rounded-lg text-sm">
                <SelectValue placeholder="Wybierz firmę" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {/* KPI bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setFilter("overdue")}
            className={`text-left rounded-xl p-4 border transition-all ${filter === "overdue" ? "border-destructive bg-destructive/5" : "border-border bg-card hover:bg-secondary/40"}`}
          >
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Po terminie</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{stats.overdueCount}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatPln(stats.overdueAmount)}</p>
          </button>
          <div className="rounded-xl p-4 border border-border bg-card">
            <div className="flex items-center gap-2 text-warning">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Dziś</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{stats.todayCount}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatPln(stats.todayAmount)}</p>
          </div>
          <div className="rounded-xl p-4 border border-border bg-card">
            <div className="flex items-center gap-2 text-primary">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">7 dni</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5">{stats.soonCount}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatPln(stats.soonAmount)}</p>
          </div>
          <div className="rounded-xl p-4 border border-border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Do zapłaty</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">{formatPln(stats.unpaidAmount)}</p>
            <p className="text-xs text-muted-foreground">razem nieopłacone</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
          {(["unpaid", "overdue", "paid", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {f === "unpaid" && "Nieopłacone"}
              {f === "overdue" && "Po terminie"}
              {f === "paid" && "Opłacone"}
              {f === "all" && "Wszystkie"}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success/60" />
            <p className="text-sm">Brak faktur w tej kategorii 🎉</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((inv) => {
              const isPaid = inv.payment_status === "paid";
              const overdue = inv._bucket === "overdue";
              const today = inv._bucket === "today";
              return (
                <div
                  key={inv.id}
                  className={`rounded-xl border p-3 md:p-4 flex items-center gap-3 transition-colors ${
                    isPaid
                      ? "border-border/40 bg-card/50 opacity-70"
                      : overdue
                      ? "border-destructive/30 bg-destructive/5"
                      : today
                      ? "border-warning/30 bg-warning/5"
                      : "border-border bg-card hover:bg-secondary/40"
                  }`}
                >
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isPaid ? "bg-success/10 text-success"
                    : overdue ? "bg-destructive/10 text-destructive"
                    : today ? "bg-warning/10 text-warning"
                    : "bg-secondary text-muted-foreground"
                  }`}>
                    {isPaid ? <CheckCircle2 className="h-5 w-5" /> : overdue ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{inv.vendor}</p>
                      {inv.ksef_number && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium hidden md:inline">KSeF</span>
                      )}
                      {inv._isCash && (
                        <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded font-medium">Gotówka</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isPaid && inv.paid_at
                        ? `Opłacono ${formatDate(inv.paid_at)}`
                        : inv._days !== null
                        ? inv._days < 0
                          ? `${Math.abs(inv._days)} dni po terminie · ${formatDate(inv._due!)}`
                          : inv._days === 0
                          ? `Termin dziś · ${formatDate(inv._due!)}`
                          : `za ${inv._days} dni · ${formatDate(inv._due!)}`
                        : "Brak terminu"}
                      {inv.ksef_number && ` · ${inv.ksef_number}`}
                    </p>
                  </div>

                  <div className="text-right flex items-center gap-1 md:gap-2 flex-shrink-0">
                    <span className="text-sm md:text-base font-semibold text-foreground tabular-nums">
                      {formatPln(Number(inv.gross_amount))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="QR płatności"
                      onClick={() => handleOpenQr(inv)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={isPaid ? "ghost" : "default"}
                      size="sm"
                      className={`h-8 px-2 md:px-3 text-xs gap-1 ${isPaid ? "text-success hover:text-success" : ""}`}
                      disabled={busyId === inv.id}
                      onClick={() => handleMarkPaid(inv)}
                    >
                      {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      <span className="hidden md:inline">{isPaid ? "Cofnij" : "Opłacone"}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {qrInvoice && (
        <PaymentQrModal
          open={!!qrInvoice}
          onOpenChange={(v) => !v && setQrInvoice(null)}
          vendorName={qrInvoice.vendor}
          iban={qrDetails.iban}
          amount={Number(qrInvoice.gross_amount)}
          title={qrInvoice.ksef_number || `Faktura ${qrInvoice.vendor}`}
          paymentMethodLabel={qrDetails.paymentMethodLabel}
          blockReason={getPaymentQrBlockReason(qrDetails)}
        />
      )}
    </AppLayout>
  );
};

export default Payments;
