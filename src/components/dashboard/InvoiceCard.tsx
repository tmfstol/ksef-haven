import { FileText, FileCode, Loader2, ChevronDown, CheckCircle2, QrCode, FolderOpen, StickyNote, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseKsefXml, generateInvoicePdf } from "@/lib/invoice-pdf";
import { useSwipeable } from "@/hooks/useSwipeable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  const { data: projects } = useProjects(invoice.company_id);
  const assignMutation = useAssignInvoiceToProject();

  const saveNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const trimmed = note.trim() || null;
      const { error } = await supabase
        .from("invoices")
        .update({ bookkeeper_note: trimmed } as any)
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
          onClick={() => setExpanded((v) => !v)}
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
                      <Button variant="outline" size="sm" className="min-h-[44px] text-xs gap-1.5" onClick={() => setQrOpen(true)}>
                        <QrCode className="h-4 w-4" /> QR płatności
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

      <PaymentQrModal open={qrOpen} onOpenChange={setQrOpen} invoice={invoice} iban="" />
    </div>
  );
}
