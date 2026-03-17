import { FileText, FileCode, ArrowUpDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { motion } from "framer-motion";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DownloadState = { id: string; format: "xml" | "upo" } | null;

interface InvoiceTableProps {
  invoices: Invoice[];
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

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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

    setDownloadingId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoice.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.xml) throw new Error("Brak danych XML");

      const filename = `${invoice.ksef_number}.xml`;
      downloadFile(data.xml, filename, "application/xml");
      toast.success(`Pobrano ${filename}`);
    } catch (err) {
      console.error("Download error:", err);
      toast.error(
        `Błąd pobierania: ${err instanceof Error ? err.message : "Nieznany błąd"}`
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button
      onClick={() => toggleSort(sortKeyName)}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 transition-colors ${
        sortKey === sortKeyName ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground"
      }`} />
    </button>
  );

  return (
    <div className="glass-panel-elevated rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              <SortHeader label="Data" sortKeyName="date" />
            </th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              <SortHeader label="Kontrahent" sortKeyName="vendor" />
            </th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              NIP
            </th>
            <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              <SortHeader label="Kwota brutto" sortKeyName="gross_amount" />
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
            const isDownloading = downloadingId === invoice.id;
            return (
              <motion.tr
                key={invoice.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-border/30 last:border-0 hover:bg-secondary/40 transition-colors"
              >
                <td className="px-5 py-3.5 text-sm text-foreground">
                  {formatDate(invoice.date)}
                </td>
                <td className="px-5 py-3.5 text-sm font-medium text-foreground max-w-[250px] truncate">
                  {invoice.vendor}
                </td>
                <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">
                  {invoice.nip}
                </td>
                <td className="px-5 py-3.5 text-sm text-foreground text-right font-semibold tabular-nums">
                  {formatCurrency(invoice.gross_amount)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusStyles[invoice.status]}`}>
                    {statusLabels[invoice.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
                      disabled={isDownloading || !invoice.ksef_number}
                      onClick={() => handleDownloadXml(invoice)}
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileCode className="h-3.5 w-3.5" />
                      )}
                      XML
                    </Button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
