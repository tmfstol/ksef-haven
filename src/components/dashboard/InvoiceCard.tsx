import { FileText, FileCode, Loader2, ChevronDown, CheckCircle2, QrCode, FolderOpen, StickyNote, Pencil, Check, X, RefreshCcw, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseKsefXml, generateInvoicePdf } from "@/lib/invoice-pdf";
import { buildInvoicePaymentDetails, extractPaymentDetailsFromXml, getPaymentQrBlockReason, type InvoicePaymentDetails } from "@/lib/invoice-payment";
import { useSwipeable } from "@/hooks/useSwipeable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjects, useAssignInvoiceToProject } from "@/hooks/useProjects";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaymentQrModal } from "@/components/payments/PaymentQrModal";
import { motion, AnimatePresence } from "framer-motion";

const statusStyles: Record<Invoice["status"], string> = {
  new: "bg-primary/10 text-primary",
  processed: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<Invoice["status"], string> = {
  new: "Nowa",
  processed: "Przetworzona",
  error: "Błąd",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pl-PL", { year: "numeric", month: "short", day: "numeric" });
}

function toNumber(value: string | number) {
  const normalized = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : 0;
}

function mapXmlItems(xml: string, invoiceId: string, ksefNumber: string) {
  const parsed = parseKsefXml(xml, ksefNumber);
  return parsed.pozycje.map((item, index) => ({
    id: `${invoiceId}-${index + 1}`,
    ordinal: Number(item.nr) || index + 1,
    name: item.opis || "—",
    quantity: toNumber(item.ilosc),
    unit: item.jm || "szt.",
    unit_price_net: toNumber(item.cenaNetto),
    net_amount: toNumber(item.wartoscNetto),
    vat_rate: item.stawkaVat || "—",
    gross_amount: toNumber(item.brutto),
  }));
}

interface InvoiceCardProps {
  invoice: Invoice;
  isNew?: boolean;
}

export function InvoiceCard({ invoice, isNew }: InvoiceCardProps) {
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(invoice.bookkeeper_note ?? "");
  const [fallbackItems, setFallbackItems] = useState<ReturnType<typeof mapXmlItems> | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<InvoicePaymentDetails>(() =>
    buildInvoicePaymentDetails({ iban: invoice.vat_whitelist_account })
  );

  const { data: projects } = useProjects(invoice.company_id);
  const assignMutation = useAssignInvoiceToProject();

  const { data: items, isLoading: isLoadingItems } = useQuery({
    queryKey: ["invoice-items", invoice.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("id, ordinal, name, quantity, unit, unit_price_net, net_amount, vat_rate, gross_amount")
        .eq("invoice_id", invoice.id)
        .order("ordinal", { ascending: true });
      if (error) throw error;
      return (data || []).map((row) => ({
        id: row.id,
        ordinal: Number(row.ordinal),
        name: row.name,
        quantity: Number(row.quantity),
        unit: row.unit || "szt.",
        unit_price_net: Number(row.unit_price_net),
        net_amount: Number(row.net_amount),
        vat_rate: row.vat_rate || "—",
        gross_amount: Number(row.gross_amount),
      }));
    },
    enabled: expanded,
  });

  const hydrateDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!invoice.ksef_number) throw new Error("Faktura nie ma numeru KSeF");
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoice.id, format: "xml" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.xml) throw new Error("Brak danych XML faktury");

      const downloadedItems = mapXmlItems(data.xml, invoice.id, invoice.ksef_number);
      const details = extractPaymentDetailsFromXml(data.xml);

      const { count } = await supabase
        .from("invoice_items")
        .select("id", { count: "exact", head: true })
        .eq("invoice_id", invoice.id);

      if (downloadedItems.length > 0 && (count ?? 0) === 0) {
        await supabase.from("invoice_items").insert(
          downloadedItems.map(({ id, ...item }) => ({
            invoice_id: invoice.id,
            ordinal: item.ordinal,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unit_price_net: item.unit_price_net,
            net_amount: item.net_amount,
            vat_rate: item.vat_rate,
            vat_amount: Math.max(item.gross_amount - item.net_amount, 0),
            gross_amount: item.gross_amount,
          }))
        );
        queryClient.invalidateQueries({ queryKey: ["invoice-items", invoice.id] });
      }

      return { downloadedItems, details };
    },
    onSuccess: ({ downloadedItems, details }) => {
      setFallbackItems(downloadedItems);
      setPaymentDetails(details);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nie udało się pobrać treści faktury"),
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const trimmed = note.trim() || null;
      const { error } = await supabase
        .from("invoices")
        .update({ bookkeeper_note: trimmed })
        .eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notatka zapisana");
      setIsEditingNote(false);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => toast.error("Nie udało się zapisać notatki"),
  });

  const handleMarkPaid = async () => {
    const isPaid = invoice.payment_status === "paid";
    const { error } = await supabase
      .from("invoices")
      .update({
        payment_status: isPaid ? "unpaid" : "paid",
        paid_at: isPaid ? null : new Date().toISOString(),
      })
      .eq("id", invoice.id);
    if (error) toast.error("Błąd aktualizacji");
    else {
      toast.success(isPaid ? "Oznaczono jako nieopłacone" : "Oznaczono jako opłacone");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const handleDownload = async (format: "xml" | "pdf") => {
    if (!invoice.ksef_number) {
      toast.error("Faktura nie ma numeru KSeF");
      return;
    }
    setDownloading(format);
    try {
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoice.id, format: "xml" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);

      if (format === "xml") {
        const blob = new Blob([data.xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${invoice.ksef_number}.xml`;
        a.click(); URL.revokeObjectURL(url);
      } else {
        const parsed = parseKsefXml(data.xml, invoice.ksef_number);
        await generateInvoicePdf(parsed, data.xml);
      }
      toast.success(`Pobrano ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Błąd: ${err instanceof Error ? err.message : "Nieznany"}`);
    } finally {
      setDownloading(null);
    }
  };

  const { handlers, offset } = useSwipeable({
    onSwipeLeft: () => handleDownload("pdf"),
    onSwipeRight: () => handleDownload("xml"),
    threshold: 90,
    maxSwipe: 120,
  });

  const displayItems = items && items.length > 0 ? items : fallbackItems ?? [];
  const isHydrating = hydrateDetailsMutation.isPending;
  const qrBlockReason = getPaymentQrBlockReason(paymentDetails);

  const handleOpenQr = async () => {
    if ((!paymentDetails.iban || paymentDetails.kind === "unknown") && invoice.ksef_number && !isHydrating) {
      try {
        const result = await hydrateDetailsMutation.mutateAsync();
        setPaymentDetails(result.details);
      } catch {
        return;
      }
    }
    setQrOpen(true);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <div className={`flex items-center gap-2 text-success transition-opacity ${offset > 30 ? "opacity-100" : "opacity-0"}`}>
          <FileCode className="h-5 w-5" />
          <span className="text-sm font-semibold">XML</span>
        </div>
        <div className={`flex items-center gap-2 text-primary transition-opacity ${offset < -30 ? "opacity-100" : "opacity-0"}`}>
          <span className="text-sm font-semibold">PDF</span>
          <FileText className="h-5 w-5" />
        </div>
      </div>

      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? "transform 200ms ease-out" : "none",
        }}
        className={`glass-panel-elevated rounded-xl p-4 ${isNew ? "border-l-2 border-l-primary" : ""}`}
      >
        {/* Tappable header — opens details */}
        <button
          type="button"
          {...handlers}
          onClick={() => {
            const shouldOpen = !expanded;
            setExpanded(shouldOpen);
            if (shouldOpen && invoice.ksef_number && !hydrateDetailsMutation.isSuccess && !isHydrating) {
              hydrateDetailsMutation.mutate();
            }
          }}
          style={{ touchAction: "pan-y" }}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between mb-2 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{invoice.vendor}</p>
              <p className="text-xs text-muted-foreground font-mono">NIP: {invoice.nip}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusStyles[invoice.status]}`}>
                {statusLabels[invoice.status]}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${invoice.payment_status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                {invoice.payment_status === "paid" ? "Opłacone" : "Nieopłacone"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{formatDate(invoice.date)}</span>
            <span className="text-base font-bold text-foreground tabular-nums">{formatCurrency(invoice.gross_amount)}</span>
          </div>

          <div className="flex items-center justify-center mt-1">
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-2 border-t border-border/50 space-y-3">
                {/* Invoice contents */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <ReceiptText className="h-3.5 w-3.5" />
                      Zawartość faktury
                    </div>
                    {(isLoadingItems || isHydrating) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  {displayItems.length > 0 ? (
                    <div className="space-y-2">
                      {displayItems.slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-lg bg-secondary/40 px-3 py-2">
                          <p className="text-sm font-medium text-foreground leading-snug">{item.name || "—"}</p>
                          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>{item.quantity} {item.unit} · VAT {item.vat_rate}</span>
                            <span className="font-semibold text-foreground tabular-nums">{formatCurrency(item.gross_amount)}</span>
                          </div>
                        </div>
                      ))}
                      {displayItems.length > 6 && (
                        <p className="text-xs text-muted-foreground">+ {displayItems.length - 6} kolejnych pozycji</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {isLoadingItems || isHydrating ? "Pobieranie treści faktury..." : "Brak zapisanych pozycji faktury."}
                      </p>
                      {!isLoadingItems && !isHydrating && invoice.ksef_number && (
                        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => hydrateDetailsMutation.mutate()}>
                          <RefreshCcw className="h-3.5 w-3.5" /> Pobierz
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Forma płatności</span>
                  <span className="font-medium text-foreground">{paymentDetails.paymentMethodLabel}</span>
                </div>

                {/* Project assignment */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <FolderOpen className="h-3.5 w-3.5" />
                    Projekt
                  </div>
                  <Select
                    value={invoice.project_id ?? "__none__"}
                    onValueChange={(value) => {
                      const projectId = value === "__none__" ? null : value;
                      assignMutation.mutate({ invoiceId: invoice.id, projectId });
                    }}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Wybierz projekt" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Brak projektu</SelectItem>
                      {projects?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Note */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wider">
                      <StickyNote className="h-3.5 w-3.5" />
                      Notatka dla księgowego
                    </div>
                    {!isEditingNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { setIsEditingNote(true); setNoteText(invoice.bookkeeper_note ?? ""); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {isEditingNote ? (
                    <div className="space-y-2">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value.slice(0, 500))}
                        placeholder="Dodaj notatkę dla księgowego..."
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => saveNoteMutation.mutate(noteText)} disabled={saveNoteMutation.isPending} className="gap-1">
                          {saveNoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Zapisz
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setIsEditingNote(false); setNoteText(invoice.bookkeeper_note ?? ""); }} className="gap-1">
                          <X className="h-3.5 w-3.5" /> Anuluj
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">{noteText.length}/500</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground whitespace-pre-wrap min-h-[20px]">
                      {invoice.bookkeeper_note || <span className="italic text-muted-foreground/60">Kliknij ołówek, aby dodać</span>}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {invoice.invoice_type === "kosztowa" && (
                    <>
                      <Button variant="outline" size="sm" className="min-h-[44px] text-xs gap-1.5" onClick={handleOpenQr} disabled={isHydrating || paymentDetails.kind === "cash"}>
                        {isHydrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        {paymentDetails.kind === "cash" ? "Gotówka" : "QR płatności"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`min-h-[44px] text-xs gap-1.5 ${invoice.payment_status === "paid" ? "text-success border-success/50" : ""}`}
                        onClick={handleMarkPaid}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {invoice.payment_status === "paid" ? "Cofnij" : "Opłacone"}
                      </Button>
                    </>
                  )}
                  {invoice.ksef_number && (
                    <>
                      <Button variant="ghost" size="sm" className="min-h-[44px] text-xs gap-1.5" disabled={!!downloading} onClick={() => handleDownload("xml")}>
                        {downloading === "xml" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
                        XML
                      </Button>
                      <Button variant="ghost" size="sm" className="min-h-[44px] text-xs gap-1.5" disabled={!!downloading} onClick={() => handleDownload("pdf")}>
                        {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        PDF
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PaymentQrModal
        open={qrOpen}
        onOpenChange={setQrOpen}
        vendorName={invoice.vendor}
        vendorNip={invoice.nip}
        iban={paymentDetails.iban}
        amount={invoice.gross_amount}
        title={invoice.ksef_number || invoice.vendor}
        paymentMethodLabel={paymentDetails.paymentMethodLabel}
        blockReason={qrBlockReason}
      />
    </div>
  );
}
