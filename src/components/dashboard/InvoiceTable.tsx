import { FileText, FileCode, ArrowUpDown, Download, Loader2, Send, ChevronDown, ChevronRight, CheckCircle2, QrCode, ShieldCheck, ShieldAlert, ShieldQuestion, Mail, AlertTriangle, Clock, StickyNote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { parseKsefXml, generateInvoicePdf, generateInvoicePdfBase64 } from "@/lib/invoice-pdf";
import { InvoiceItemsRow } from "./InvoiceItemsRow";
import { AdBanner, AdBannerPlaceholder } from "./AdBanner";
import { PaymentQrModal } from "@/components/payments/PaymentQrModal";
import { buildInvoicePaymentDetails, extractPaymentDetailsFromXml, getPaymentQrBlockReason, type InvoicePaymentDetails } from "@/lib/invoice-payment";
import { isInvoiceNew } from "@/lib/invoice-new";

type DownloadState = { id: string; format: "xml" | "upo" | "pdf" | "email" } | null;

interface InvoiceTableProps {
  invoices: Invoice[];
  latestSyncStartedAt?: string | null;
  clientPortalEmail?: string | null;
}

type SortKey = "date" | "vendor" | "gross_amount";

const statusStyles: Record<Invoice["status"], string> = {
  new: "bg-primary/10 text-primary",
  processed: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<Invoice["status"], string> = {
  new: "Do sprawdzenia",
  processed: "Przetworzona",
  error: "Błąd",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function InvoiceTable({ invoices, latestSyncStartedAt, clientPortalEmail }: InvoiceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [downloading, setDownloading] = useState<DownloadState>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qrInvoice, setQrInvoice] = useState<Invoice | null>(null);
  const [qrPaymentDetails, setQrPaymentDetails] = useState<InvoicePaymentDetails>(buildInvoicePaymentDetails({}));
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const handleMarkPaid = async (invoice: Invoice) => {
    const isPaid = invoice.payment_status === "paid";
    const { error } = await supabase
      .from("invoices")
      .update({
        payment_status: isPaid ? "unpaid" : "paid",
        paid_at: isPaid ? null : new Date().toISOString(),
      })
      .eq("id", invoice.id);
    if (error) toast.error("Błąd aktualizacji statusu");
    else {
      toast.success(isPaid ? "Oznaczono jako nieopłacone" : "Oznaczono jako opłacone");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  };

  const isTransfer = (inv: Invoice): boolean => {
    const m = (inv.payment_method || "").toString().toLowerCase().trim();
    return m === "6" || m.includes("przelew") || m.includes("transfer") || m.includes("bank");
  };

  const getDaysToDue = (inv: Invoice): number | null => {
    if (inv.payment_status === "paid" || inv.invoice_type !== "kosztowa") return null;
    if (!inv.payment_due_date) return null;
    const d = new Date(inv.payment_due_date);
    const now = new Date();
    d.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.round((d.getTime() - now.getTime()) / 86400000);
  };

  const getOverdueDays = (inv: Invoice): number | null => {
    const diff = getDaysToDue(inv);
    if (diff === null) return null;
    return diff < 0 ? Math.abs(diff) : null;
  };

  const formatDueDate = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handleOpenQr = async (invoice: Invoice) => {
    let details = buildInvoicePaymentDetails({ iban: invoice.vat_whitelist_account });
    if (invoice.ksef_number) {
      try {
        const { data } = await supabase.functions.invoke("ksef-download", {
          body: { invoice_id: invoice.id, format: "xml" },
        });
        if (data?.xml) {
          details = extractPaymentDetailsFromXml(data.xml);
        }
      } catch (error) {
        console.warn("Nie udało się pobrać danych QR z XML:", error);
      }
    }
    setQrPaymentDetails(details);
    setQrInvoice(invoice);
  };

  const sorted = [...invoices].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = a.date.localeCompare(b.date);
    else if (sortKey === "vendor") cmp = a.vendor.localeCompare(b.vendor);
    else cmp = a.gross_amount - b.gross_amount;
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const handleDownloadXml = async (invoice: Invoice) => {
    if (!invoice.ksef_number) {
      toast.error("Faktura nie ma numeru KSeF");
      return;
    }
    setDownloading({ id: invoice.id, format: "xml" });
    try {
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoice.id, format: "xml" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.xml) throw new Error("Brak danych XML");
      downloadFile(data.xml, `${invoice.ksef_number}.xml`, "application/xml");
      toast.success(`Pobrano ${invoice.ksef_number}.xml`);
    } catch (err) {
      console.error("Download error:", err);
      toast.error(`Błąd pobierania: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    if (!invoice.ksef_number) {
      toast.error("Faktura nie ma numeru KSeF");
      return;
    }
    setDownloading({ id: invoice.id, format: "pdf" });
    try {
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoice.id, format: "xml" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.xml) throw new Error("Brak danych XML");

      const parsed = parseKsefXml(data.xml, invoice.ksef_number);
      await generateInvoicePdf(parsed, data.xml);
      toast.success(`Pobrano PDF dla ${invoice.ksef_number}`);
    } catch (err) {
      console.error("PDF download error:", err);
      toast.error(`Błąd pobierania PDF: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadUpo = async (invoice: Invoice) => {
    if (!invoice.ksef_number) {
      toast.error("Faktura nie ma numeru KSeF");
      return;
    }
    setDownloading({ id: invoice.id, format: "upo" });
    try {
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoice.id, format: "upo" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.pdf) throw new Error("Brak danych UPO");

      const binaryString = atob(data.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: data.content_type || "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UPO_${invoice.ksef_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Pobrano UPO dla ${invoice.ksef_number}`);
    } catch (err) {
      console.error("UPO download error:", err);
      toast.error(`Błąd pobierania UPO: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleSendToPortal = async (invoice: Invoice) => {
    setDownloading({ id: invoice.id, format: "email" });

    // Optymistycznie oznacz fakturę jako wysłaną od razu — UI nie czeka
    const optimisticAt = new Date().toISOString();
    queryClient.setQueryData<Invoice[] | undefined>(
      ["invoices", invoice.company_id],
      (old) => old?.map((i) => (i.id === invoice.id ? { ...i, sent_to_portal_at: optimisticAt, sent_to_portal_by: user?.id ?? null } : i))
    );
    toast.success("Wysyłka rozpoczęta — kontynuuję w tle");

    try {
      let pdfBase64: string | undefined;
      let pdfFilename = `${invoice.ksef_number || invoice.vendor}.pdf`;

      // Szybka ścieżka: jeśli PDF już jest w storage, edge function pobierze go sam
      if (!invoice.pdf_path) {
        // 1. Pobierz XML z KSeF
        const { data: xmlData, error: xmlError } = await supabase.functions.invoke("ksef-download", {
          body: { invoice_id: invoice.id, format: "xml" },
        });
        if (xmlError) throw xmlError;
        if (xmlData?.error) throw new Error(xmlData.error);
        if (!xmlData?.xml) throw new Error("Brak XML faktury");

        // 2. Wygeneruj PDF lokalnie
        const parsed = parseKsefXml(xmlData.xml, invoice.ksef_number || "");
        pdfBase64 = await generateInvoicePdfBase64(parsed, xmlData.xml);

        // 3. Upload PDF do storage RÓWNOLEGLE z wysyłką do Make (nie czekamy)
        const cleanedBase64 = pdfBase64
          .replace(/^data:application\/pdf;base64,/i, "")
          .replace(/\s+/g, "");
        const binary = atob(cleanedBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const pdfBlob = new Blob([bytes], { type: "application/pdf" });
        const storagePath = `${invoice.company_id}/${invoice.id}/${pdfFilename}`;
        // fire-and-forget upload
        supabase.storage
          .from("invoice-uploads")
          .upload(storagePath, pdfBlob, { upsert: true, contentType: "application/pdf" })
          .then(() => supabase.from("invoices").update({ pdf_path: storagePath }).eq("id", invoice.id))
          .catch((e) => console.warn("Background PDF upload failed:", e));
      }

      // 4. Wyślij do Make (z base64 jeśli świeżo wygenerowany, albo edge pobierze ze storage)
      const { data, error } = await supabase.functions.invoke("send-invoice-make", {
        body: { invoiceId: invoice.id, pdfBase64, pdfFilename },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Zapisz status w bazie (potwierdzenie)
      await supabase
        .from("invoices")
        .update({ sent_to_portal_at: optimisticAt, sent_to_portal_by: user?.id ?? null })
        .eq("id", invoice.id);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faktura wysłana do portalu");
    } catch (err) {
      console.error("Email send error:", err);
      // Rollback optymistycznej zmiany
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.error(`Błąd wysyłki: ${err instanceof Error ? err.message : "Nieznany błąd"}`);
    } finally {
      setDownloading(null);
    }
  };

  const renderSortHeader = (label: string, sortKeyName: SortKey) => (
    <button
      type="button"
      onClick={() => toggleSort(sortKeyName)}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 transition-colors ${
          sortKey === sortKeyName ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
        }`}
      />
    </button>
  );

  return (
    <div className="glass-panel-elevated rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="w-10 px-2 py-3.5"></th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              {renderSortHeader("Data", "date")}
            </th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              {renderSortHeader("Kontrahent", "vendor")}
            </th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              NIP
            </th>
            <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              {renderSortHeader("Kwota brutto", "gross_amount")}
            </th>
            <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              Status
            </th>
            <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              Akcje
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((invoice, i) => {
            const isDownloadingXml = downloading?.id === invoice.id && downloading?.format === "xml";
            const isDownloadingPdf = downloading?.id === invoice.id && downloading?.format === "pdf";
            const isDownloadingUpo = downloading?.id === invoice.id && downloading?.format === "upo";
            const isSendingEmail = downloading?.id === invoice.id && downloading?.format === "email";
            const isAnyDownloading = downloading !== null;
            const isNew = isInvoiceNew(invoice, latestSyncStartedAt);
            const isExpanded = expandedId === invoice.id;

            const overdueDays = getOverdueDays(invoice);
            const rowHighlight = overdueDays !== null
              ? "bg-destructive/5 border-l-2 border-l-destructive"
              : isNew ? "bg-primary/5 border-l-2 border-l-primary" : "";

            return (
              <AnimatePresence key={invoice.id}>
                <motion.tr
                  key={`${invoice.id}-row`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer ${rowHighlight}`}
                  onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                >
                  <td className="px-2 py-3.5 text-center">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{formatDate(invoice.date)}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground max-w-[250px] truncate">
                    {invoice.vendor}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">{invoice.nip}</td>
                  <td className="px-5 py-3.5 text-sm text-foreground text-right font-semibold tabular-nums">
                    {formatCurrency(invoice.gross_amount)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyles[invoice.status]}`}>
                        {statusLabels[invoice.status]}
                      </span>
                      {isNew && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">
                          Nowa
                        </span>
                      )}
                      {invoice.payment_status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Opłacone
                        </span>
                      ) : overdueDays !== null ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive animate-pulse">
                          <AlertTriangle className="h-2.5 w-2.5" /> {overdueDays}d po terminie
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning">
                          Nieopłacone
                        </span>
                      )}
                      {invoice.payment_status !== "paid" && invoice.invoice_type === "kosztowa" && isTransfer(invoice) && invoice.payment_due_date && (() => {
                        const days = getDaysToDue(invoice);
                        if (days === null || days < 0) return null;
                        const tone = days <= 3 ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary";
                        const label = days === 0 ? "Termin dziś" : days === 1 ? "Termin jutro" : `Termin za ${days} dni`;
                        return (
                          <span title={`Termin płatności: ${formatDueDate(invoice.payment_due_date)}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tone}`}>
                            <Clock className="h-2.5 w-2.5" /> {label}
                          </span>
                        );
                      })()}
                      {invoice.vat_whitelist_status === "verified" && (
                        <span title="Biała lista VAT: zweryfikowano" className="text-success"><ShieldCheck className="h-3.5 w-3.5" /></span>
                      )}
                      {invoice.vat_whitelist_status === "invalid" && (
                        <span title="Biała lista VAT: niezgodność" className="text-destructive"><ShieldAlert className="h-3.5 w-3.5" /></span>
                      )}
                      {invoice.vat_whitelist_status === "unknown" && (
                        <span title="Biała lista VAT: brak danych" className="text-muted-foreground"><ShieldQuestion className="h-3.5 w-3.5" /></span>
                      )}
                      {invoice.sent_to_portal_at && (
                        <span
                          title={`Wysłano do portalu: ${new Date(invoice.sent_to_portal_at).toLocaleString("pl-PL")}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary"
                        >
                          <Mail className="h-2.5 w-2.5" /> Wysłano
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {invoice.invoice_type === "kosztowa" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" title="Pokaż QR płatności" onClick={() => handleOpenQr(invoice)}>
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-lg ${invoice.payment_status === "paid" ? "text-success" : "text-muted-foreground hover:text-success"}`} title={invoice.payment_status === "paid" ? "Cofnij oznaczenie" : "Oznacz jako opłacone"} onClick={() => handleMarkPaid(invoice)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
                        disabled={isAnyDownloading || !invoice.ksef_number}
                        onClick={() => handleDownloadXml(invoice)}
                      >
                        {isDownloadingXml ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileCode className="h-3.5 w-3.5" />
                        )}
                        XML
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
                        disabled={isAnyDownloading || !invoice.ksef_number}
                        onClick={() => handleDownloadPdf(invoice)}
                      >
                        {isDownloadingPdf ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileText className="h-3.5 w-3.5" />
                        )}
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs rounded-lg gap-1 text-muted-foreground hover:text-foreground"
                        disabled={isAnyDownloading || !invoice.ksef_number}
                        onClick={() => handleDownloadUpo(invoice)}
                      >
                        {isDownloadingUpo ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        UPO
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs rounded-lg gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                        disabled={isAnyDownloading}
                        onClick={() => handleSendToPortal(invoice)}
                      >
                        {isSendingEmail ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Portal
                      </Button>
                    </div>
                  </td>
                </motion.tr>
                {isExpanded && (
                  <InvoiceItemsRow
                    key={`${invoice.id}-items`}
                    invoiceId={invoice.id}
                    colSpan={7}
                    invoice={invoice}
                    companyId={invoice.company_id}
                  />
                )}
                {/* Ad banner every 10 rows */}
                {i > 0 && i % 10 === 9 && (
                  <tr key={`${invoice.id}-ad-${i}`}>
                    <td colSpan={7} className="px-5 py-2">
                      <AdBanner slot="4278896371" format="horizontal" />
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            );
          })}
        </tbody>
      </table>
      {qrInvoice && (
        <PaymentQrModal
          open={!!qrInvoice}
          onOpenChange={(v) => !v && setQrInvoice(null)}
          vendorName={qrInvoice.vendor}
          vendorNip={qrInvoice.nip}
          iban={qrPaymentDetails.iban}
          amount={qrInvoice.gross_amount}
          title={qrInvoice.ksef_number || `Faktura ${qrInvoice.vendor}`}
          paymentMethodLabel={qrPaymentDetails.paymentMethodLabel}
          blockReason={getPaymentQrBlockReason(qrPaymentDetails)}
        />
      )}
    </div>
  );
}
