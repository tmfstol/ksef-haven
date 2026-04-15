import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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

export function InvoiceItemsRow({ invoiceId, colSpan }: { invoiceId: string; colSpan: number }) {
  const { data: items, isLoading } = useQuery<InvoiceItem[]>({
    queryKey: ["invoice-items", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("ordinal", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        unit_price_net: Number(r.unit_price_net),
        net_amount: Number(r.net_amount),
        vat_amount: Number(r.vat_amount),
        gross_amount: Number(r.gross_amount),
      }));
    },
  });

  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-muted/20"
    >
      <td colSpan={colSpan} className="px-5 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ładowanie pozycji...
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-1">
            Brak pozycji — uruchom ponowną synchronizację, aby pobrać treść faktury.
          </p>
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
              {items.map((item) => (
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
