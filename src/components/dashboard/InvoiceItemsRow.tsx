import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { parseKsefXml } from "@/lib/invoice-pdf";
import { Loader2, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

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

export function InvoiceItemsRow({ invoiceId, colSpan }: { invoiceId: string; colSpan: number }) {
  const queryClient = useQueryClient();
  const [fallbackItems, setFallbackItems] = useState<InvoiceItem[] | null>(null);

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
      </td>
    </motion.tr>
  );
}
