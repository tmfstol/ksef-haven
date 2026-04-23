import { FileText, FileCode, Download, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseKsefXml, generateInvoicePdf } from "@/lib/invoice-pdf";
import { useSwipeable } from "@/hooks/useSwipeable";

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

interface InvoiceCardProps {
  invoice: Invoice;
  isNew?: boolean;
}

export function InvoiceCard({ invoice, isNew }: InvoiceCardProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

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

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action backdrops revealed on swipe */}
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
        {...handlers}
        style={{
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className={`glass-panel-elevated rounded-xl p-4 ${isNew ? "border-l-2 border-l-primary" : ""}`}
      >
        <div className="flex items-start justify-between mb-2 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{invoice.vendor}</p>
            <p className="text-xs text-muted-foreground font-mono">NIP: {invoice.nip}</p>
          </div>
          <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[invoice.status]}`}>
            {statusLabels[invoice.status]}
          </span>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">{formatDate(invoice.date)}</span>
          <span className="text-base font-bold text-foreground tabular-nums">{formatCurrency(invoice.gross_amount)}</span>
        </div>

        {invoice.ksef_number && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px] text-xs rounded-lg gap-1.5"
              disabled={!!downloading}
              onClick={() => handleDownload("xml")}
            >
              {downloading === "xml" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCode className="h-4 w-4" />}
              XML
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 min-h-[44px] text-xs rounded-lg gap-1.5"
              disabled={!!downloading}
              onClick={() => handleDownload("pdf")}
            >
              {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              PDF
            </Button>
          </div>
        )}

        {/* Swipe hint, dismissable visual cue */}
        <p className="text-[10px] text-muted-foreground/60 mt-2 text-center md:hidden">
          ← Przesuń aby pobrać PDF · XML →
        </p>
      </div>
    </div>
  );
}
