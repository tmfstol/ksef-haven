import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { parseKsefXml } from "@/lib/invoice-pdf";
import { Loader2, RefreshCcw, FolderOpen, StickyNote, Check, X, Pencil, Split } from "lucide-react";
import { motion } from "framer-motion";
import { useProjects, useAssignInvoiceToProject } from "@/hooks/useProjects";
import { useInvoiceProjectCosts } from "@/hooks/useProjectCosts";
import { SplitInvoiceDialog } from "@/components/projects/SplitInvoiceDialog";
import { Badge } from "@/components/ui/badge";
import type { Invoice } from "@/types/invoice";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useProfileNames } from "@/hooks/useProfileNames";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InvoiceItemRow = Tables<"invoice_items">;

interface InvoiceItem {
  id: string;
  ordinal: number;
  name: string;
  quantity: number;
  unit: string;
  unit_price_net: number;
  net_amount: number;
  vat_rate: string;
  vat_amount: number;
  gross_amount: number;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amount);
}

function toNumber(value: string | number) {
  const normalized = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(normalized) ? normalized : 0;
}

function mapXmlItems(xml: string, invoiceId: string, ksefNumber: string): InvoiceItem[] {
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
    vat_amount: toNumber(item.kwotaVat),
    gross_amount: toNumber(item.brutto),
  }));
}

interface InvoiceItemsRowProps {
  invoiceId: string;
  colSpan: number;
  invoice?: Invoice;
  companyId?: string | null;
}

export function InvoiceItemsRow({ invoiceId, colSpan, invoice, companyId }: InvoiceItemsRowProps) {
  const queryClient = useQueryClient();
  const [fallbackItems, setFallbackItems] = useState<InvoiceItem[] | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(invoice?.bookkeeper_note ?? "");
  const [splitOpen, setSplitOpen] = useState(false);

  const { user: currentUser } = useAuth();
  const { data: profileNames } = useProfileNames([invoice?.bookkeeper_note_by]);
  const noteAuthorId = invoice?.bookkeeper_note_by ?? null;
  const noteAuthorName = noteAuthorId
    ? (noteAuthorId === currentUser?.id ? "Ty" : profileNames?.[noteAuthorId] || "Inny użytkownik")
    : null;
  const noteAt = invoice?.bookkeeper_note_at
    ? new Date(invoice.bookkeeper_note_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })
    : null;

  const { data: projects } = useProjects(companyId);
  const assignMutation = useAssignInvoiceToProject();
  const { data: existingSplits } = useInvoiceProjectCosts(invoiceId);
  const splitCount = existingSplits?.length ?? 0;

  const saveNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const trimmed = note.trim() || null;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("invoices")
        .update({
          bookkeeper_note: trimmed,
          bookkeeper_note_by: trimmed ? user?.id ?? null : null,
          bookkeeper_note_at: trimmed ? new Date().toISOString() : null,
        } as any)
        .eq("id", invoiceId);
      if (error) throw error;
      return trimmed;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setIsEditingNote(false);
      toast.success("Notatka zapisana");
    },
    onError: () => toast.error("Nie udało się zapisać notatki"),
  });

  const { data: items, isLoading } = useQuery<InvoiceItem[]>({
    queryKey: ["invoice-items", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("ordinal", { ascending: true });
      if (error) throw error;
      return (data as InvoiceItemRow[]).map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        unit_price_net: Number(r.unit_price_net),
        net_amount: Number(r.net_amount),
        vat_amount: Number(r.vat_amount),
        gross_amount: Number(r.gross_amount),
      }));
    },
  });

  const {
    mutate: hydrateItems,
    isPending: isHydrating,
    isError: isHydrateError,
    isSuccess: hasHydrated,
    error: hydrateError,
  } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ksef-download", {
        body: { invoice_id: invoiceId, format: "xml" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.xml) throw new Error("Brak XML faktury.");

      const downloadedItems = mapXmlItems(data.xml, invoiceId, data.ksef_number || invoiceId);

      if (downloadedItems.length > 0) {
        const { error: insertError } = await supabase.from("invoice_items").insert(
          downloadedItems.map(({ id, ...item }) => ({
            invoice_id: invoiceId,
            ordinal: item.ordinal,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unit_price_net: item.unit_price_net,
            net_amount: item.net_amount,
            vat_rate: item.vat_rate,
            vat_amount: item.vat_amount,
            gross_amount: item.gross_amount,
          }))
        );

        if (!insertError) {
          queryClient.invalidateQueries({ queryKey: ["invoice-items", invoiceId] });
        }
      }

      return downloadedItems;
    },
    onSuccess: (downloadedItems) => {
      setFallbackItems(downloadedItems);
    },
  });

  useEffect(() => {
    if (!isLoading && items && items.length === 0 && !isHydrating && !hasHydrated && !isHydrateError) {
      hydrateItems();
    }
  }, [hasHydrated, hydrateItems, invoiceId, isHydrateError, isHydrating, isLoading, items]);

  const displayItems = items && items.length > 0 ? items : fallbackItems ?? [];
  const showHydrationLoader = !isLoading && (items?.length ?? 0) === 0 && isHydrating;

  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-muted/20"
    >
      <td colSpan={colSpan} className="px-5 py-3">
        {isLoading || showHydrationLoader ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isLoading ? "Ładowanie pozycji..." : "Pobieranie treści faktury z KSeF..."}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {isHydrateError
                  ? "Nie udało się pobrać treści faktury z KSeF."
                  : "Ta faktura nie zawiera pozycji do wyświetlenia."}
              </p>
              {isHydrateError && hydrateError instanceof Error && (
                <p className="text-xs text-muted-foreground/80">{hydrateError.message}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-2"
              onClick={() => hydrateItems()}
              disabled={isHydrating}
            >
              {isHydrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Pobierz treść
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            {/* Project assignment bar */}
            <caption className="caption-top text-left pb-2">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  <span>Projekt:</span>
                </div>
                <Select
                  value={invoice?.project_id ?? "__none__"}
                  onValueChange={(value) => {
                    const projectId = value === "__none__" ? null : value;
                    assignMutation.mutate({ invoiceId, projectId });
                  }}
                  disabled={assignMutation.isPending}
                >
                  <SelectTrigger className="h-8 w-[260px] text-sm">
                    <SelectValue placeholder="Brak przypisania" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Brak przypisania —</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {invoice && companyId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setSplitOpen(true)}
                  >
                    <Split className="h-3.5 w-3.5" />
                    Rozdziel na projekty
                    {splitCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                        {splitCount}
                      </Badge>
                    )}
                  </Button>
                )}
              </div>
            </caption>
            {/* Bookkeeper note */}
            <caption className="caption-top text-left pb-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <StickyNote className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Notatka dla księgowego</span>
                    {!isEditingNote && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsEditingNote(true); setNoteText(invoice?.bookkeeper_note ?? ""); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {isEditingNote ? (
                    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Np. materiały budowlane — inwestycja ul. Kwiatowa 12"
                        className="text-sm min-h-[60px] bg-background/60 resize-none"
                        maxLength={500}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => saveNoteMutation.mutate(noteText)}
                          disabled={saveNoteMutation.isPending}
                        >
                          {saveNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Zapisz
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setIsEditingNote(false)}
                        >
                          Anuluj
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">{noteText.length}/500</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {invoice?.bookkeeper_note || <span className="italic text-muted-foreground/60">Kliknij ołówek, aby dodać opis</span>}
                    </p>
                  )}
                </div>
              </div>
            </caption>
            <thead>
              <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left py-1.5 pr-3 w-8">#</th>
                <th className="text-left py-1.5 pr-3">Nazwa</th>
                <th className="text-right py-1.5 pr-3 w-16">Ilość</th>
                <th className="text-left py-1.5 pr-3 w-12">Jm.</th>
                <th className="text-right py-1.5 pr-3 w-28">Cena netto</th>
                <th className="text-right py-1.5 pr-3 w-28">Netto</th>
                <th className="text-center py-1.5 pr-3 w-16">VAT</th>
                <th className="text-right py-1.5 w-28">Brutto</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item) => (
                <tr key={item.id} className="border-t border-border/20">
                  <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">{item.ordinal}</td>
                  <td className="py-1.5 pr-3 font-medium">{item.name || "—"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-1.5 pr-3 text-muted-foreground">{item.unit}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(item.unit_price_net)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(item.net_amount)}</td>
                  <td className="py-1.5 pr-3 text-center text-muted-foreground">{item.vat_rate}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold">{formatCurrency(item.gross_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {invoice && companyId && (
          <SplitInvoiceDialog
            open={splitOpen}
            onOpenChange={setSplitOpen}
            invoice={invoice}
            companyId={companyId}
          />
        )}
      </td>
    </motion.tr>
  );
}
