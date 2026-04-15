import { FileText, FileCode, ArrowUpDown, Download, Loader2, Send, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseKsefXml, generateInvoicePdf } from "@/lib/invoice-pdf";
import { InvoiceItemsRow } from "./InvoiceItemsRow";
import { AdBanner, AdBannerPlaceholder } from "./AdBanner";

type DownloadState = { id: string; format: "xml" | "upo" | "pdf" | "email" } | null;

interface InvoiceTableProps {
  invoices: Invoice[];
  lastSeenTimestamp?: string | null;
  clientPortalEmail?: string | null;
}

type SortKey = "date" | "vendor" | "gross_amount";

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

export function InvoiceTable({ invoices, lastSeenTimestamp, clientPortalEmail }: InvoiceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [downloading, setDownloading] = useState<DownloadState>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      await generateInvoicePdf(parsed);
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
    if (!clientPortalEmail) {
      toast.error("Brak e-maila portalu klienta");
      return;
    }

    setDownloading({ id: invoice.id, format: "email" });
    try {
      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: { invoiceId: invoice.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Faktura wysłana na ${clientPortalEmail}`);
    } catch (err) {
      console.error("Email send error:", err);
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
            const isNew = lastSeenTimestamp && invoice.created_at && invoice.created_at > lastSeenTimestamp;
            const isExpanded = expandedId === invoice.id;

            return (
              <AnimatePresence key={invoice.id}>
                <motion.tr
                  key={`${invoice.id}-row`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer ${isNew ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
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
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[invoice.status]}`}>
                      {statusLabels[invoice.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
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
                      {clientPortalEmail && (
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
                      )}
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
    </div>
  );
}
