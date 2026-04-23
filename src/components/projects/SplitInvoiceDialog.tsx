import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Split } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import {
  useInvoiceProjectCosts,
  useSaveInvoiceCostSplit,
  type ProjectCostInput,
} from "@/hooks/useProjectCosts";
import type { Invoice } from "@/types/invoice";
import { toast } from "sonner";

interface SplitInvoiceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
  companyId: string;
}

interface Allocation {
  uid: string; // local id
  project_id: string;
  amount: string; // gross amount (string for input)
  qty: string; // quantity assigned (string for input)
  invoice_item_id: string | null;
  item_name: string | null;
}

function fmt(n: number) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function SplitInvoiceDialog({ open, onOpenChange, invoice, companyId }: SplitInvoiceDialogProps) {
  const { data: projects, isLoading: projectsLoading } = useProjects(companyId);
  const { data: existing, isLoading: existingLoading } = useInvoiceProjectCosts(open ? invoice.id : null);
  const saveMutation = useSaveInvoiceCostSplit();

  // Load invoice items (real lines from KSeF) for this invoice
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["invoice-items", invoice.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("ordinal", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        net_amount: Number(r.net_amount),
        quantity: Number(r.quantity) || 0,
      }));
    },
  });

  // Per-line allocations map: invoice_item_id (or "__whole__") -> Allocation[]
  const [allocByLine, setAllocByLine] = useState<Record<string, Allocation[]>>({});

  // Lines to render: real invoice_items, or one synthetic "whole invoice" line
  const lines = useMemo(() => {
    if (items && items.length > 0) {
      return items.map((it: any) => {
        const qty = Number(it.quantity) || 0;
        const gross = Number(it.gross_amount) || 0;
        return {
          key: it.id as string,
          invoice_item_id: it.id as string,
          name: it.name as string,
          gross,
          quantity: qty,
          unit: (it.unit as string) || "szt.",
          unit_gross: qty > 0 ? gross / qty : 0,
        };
      });
    }
    return [
      {
        key: "__whole__",
        invoice_item_id: null as string | null,
        name: `Cała faktura — ${invoice.vendor}`,
        gross: Number(invoice.gross_amount) || 0,
        quantity: 0,
        unit: "",
        unit_gross: 0,
      },
    ];
  }, [items, invoice]);

  // Initialize allocations from existing splits when dialog opens
  useEffect(() => {
    if (!open) return;
    if (existingLoading || itemsLoading) return;

    const grouped: Record<string, Allocation[]> = {};
    for (const ln of lines) grouped[ln.key] = [];

    for (const c of existing || []) {
      const key = c.invoice_item_id && grouped[c.invoice_item_id] ? c.invoice_item_id : "__whole__";
      if (!grouped[key]) grouped[key] = [];
      const ln = lines.find((l) => l.key === key);
      let qtyStr = "";
      if (c.quantity != null && Number(c.quantity) > 0) {
        qtyStr = String(Number(c.quantity)).replace(".", ",");
      } else if (ln && ln.unit_gross > 0) {
        // Backfill qty from amount/unit_price if older row had no qty
        qtyStr = String(Number((c.gross_amount / ln.unit_gross).toFixed(4))).replace(".", ",");
      }
      grouped[key].push({
        uid: uid(),
        project_id: c.project_id,
        amount: fmt(c.gross_amount).replace(/\s/g, ""),
        qty: qtyStr,
        invoice_item_id: c.invoice_item_id,
        item_name: c.item_name,
      });
    }
    setAllocByLine(grouped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingLoading, itemsLoading, existing?.length, items?.length]);

  const addAllocation = (lineKey: string, line: typeof lines[number], remainingForLine: number, remainingQty: number) => {
    setAllocByLine((prev) => ({
      ...prev,
      [lineKey]: [
        ...(prev[lineKey] || []),
        {
          uid: uid(),
          project_id: "",
          amount: remainingForLine > 0 ? fmt(remainingForLine).replace(/\s/g, "") : "",
          qty:
            line.unit_gross > 0 && remainingQty > 0
              ? String(Number(remainingQty.toFixed(4))).replace(".", ",")
              : "",
          invoice_item_id: line.invoice_item_id,
          item_name: line.name,
        },
      ],
    }));
  };

  const removeAllocation = (lineKey: string, allocUid: string) => {
    setAllocByLine((prev) => ({
      ...prev,
      [lineKey]: (prev[lineKey] || []).filter((a) => a.uid !== allocUid),
    }));
  };

  const updateAllocation = (lineKey: string, allocUid: string, patch: Partial<Allocation>) => {
    setAllocByLine((prev) => ({
      ...prev,
      [lineKey]: (prev[lineKey] || []).map((a) => (a.uid === allocUid ? { ...a, ...patch } : a)),
    }));
  };

  const parseAmt = (s: string) => {
    const n = Number(String(s).replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const formatQty = (n: number) => {
    const fixed = Number(n.toFixed(4));
    return String(fixed).replace(".", ",");
  };

  // When user changes qty, sync amount = qty * unit_gross
  const handleQtyChange = (line: typeof lines[number], allocUid: string, value: string) => {
    const qty = parseAmt(value);
    const newAmount = line.unit_gross > 0 ? qty * line.unit_gross : NaN;
    updateAllocation(line.key, allocUid, {
      qty: value,
      ...(Number.isFinite(newAmount) ? { amount: fmt(newAmount).replace(/\s/g, "") } : {}),
    });
  };

  // When user changes amount, sync qty = amount / unit_gross
  const handleAmountChange = (line: typeof lines[number], allocUid: string, value: string) => {
    const amount = parseAmt(value);
    const newQty = line.unit_gross > 0 ? amount / line.unit_gross : NaN;
    updateAllocation(line.key, allocUid, {
      amount: value,
      ...(Number.isFinite(newQty) && line.unit_gross > 0 ? { qty: formatQty(newQty) } : {}),
    });
  };

  const lineTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ln of lines) {
      map[ln.key] = (allocByLine[ln.key] || []).reduce((s, a) => s + parseAmt(a.amount), 0);
    }
    return map;
  }, [allocByLine, lines]);

  const lineQtyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ln of lines) {
      map[ln.key] = (allocByLine[ln.key] || []).reduce((s, a) => s + parseAmt(a.qty), 0);
    }
    return map;
  }, [allocByLine, lines]);

  const invoiceGross = Number(invoice.gross_amount) || 0;
  const totalAllocated = useMemo(
    () => Object.values(lineTotals).reduce((s, v) => s + v, 0),
    [lineTotals]
  );
  const remaining = invoiceGross - totalAllocated;
  const isBalanced = Math.abs(remaining) < 0.01;

  // Validation
  const hasEmptyProject = useMemo(
    () => Object.values(allocByLine).some((arr) => arr.some((a) => !a.project_id)),
    [allocByLine]
  );
  const hasZeroAmount = useMemo(
    () => Object.values(allocByLine).some((arr) => arr.some((a) => parseAmt(a.amount) <= 0)),
    [allocByLine]
  );
  const lineOverflow = useMemo(
    () => lines.some((ln) => lineTotals[ln.key] - ln.gross > 0.01),
    [lineTotals, lines]
  );
  const qtyOverflow = useMemo(
    () => lines.some((ln) => ln.quantity > 0 && lineQtyTotals[ln.key] - ln.quantity > 0.0001),
    [lineQtyTotals, lines]
  );

  const canSave =
    isBalanced &&
    !hasEmptyProject &&
    !hasZeroAmount &&
    !lineOverflow &&
    !qtyOverflow &&
    !saveMutation.isPending;

  const handleSave = () => {
    if (!canSave) return;

    const allocations: ProjectCostInput[] = [];
    for (const ln of lines) {
      const arr = allocByLine[ln.key] || [];
      for (const a of arr) {
        const gross = parseAmt(a.amount);
        const qty = parseAmt(a.qty);
        let net = 0;
        if (ln.invoice_item_id && items) {
          const it = items.find((i: any) => i.id === ln.invoice_item_id);
          const ratio = it && Number(it.gross_amount) > 0 ? Number(it.net_amount) / Number(it.gross_amount) : 0;
          net = gross * ratio;
        }
        allocations.push({
          invoice_item_id: a.invoice_item_id,
          item_name: a.item_name || ln.name,
          project_id: a.project_id,
          gross_amount: Number(gross.toFixed(2)),
          net_amount: Number(net.toFixed(2)),
          quantity: qty > 0 ? Number(qty.toFixed(4)) : null,
          unit: ln.unit || null,
        });
      }
    }

    saveMutation.mutate(
      { invoice_id: invoice.id, company_id: companyId, allocations },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  const isLoading = projectsLoading || existingLoading || itemsLoading;
  const activeProjects = (projects || []).filter((p) => p.status === "active");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            Rozdziel koszty faktury na projekty
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between text-sm border border-border/50 rounded-lg px-4 py-3 bg-muted/30">
          <div>
            <p className="font-medium text-foreground">{invoice.vendor}</p>
            <p className="text-xs text-muted-foreground">NIP: {invoice.nip} · {invoice.date}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Kwota brutto faktury</p>
            <p className="text-lg font-semibold text-foreground font-mono">{fmt(invoiceGross)} zł</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : activeProjects.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Brak aktywnych projektów. Najpierw utwórz projekt, aby móc rozdzielić koszty.
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-3">
            {!items?.length && (
              <p className="text-xs text-muted-foreground italic">
                Brak pobranych pozycji z KSeF — możesz rozdzielić całą wartość brutto faktury między projekty.
              </p>
            )}

            {lines.map((ln) => {
              const allocs = allocByLine[ln.key] || [];
              const sum = lineTotals[ln.key] || 0;
              const lineRemaining = ln.gross - sum;
              const lineBalanced = Math.abs(lineRemaining) < 0.01;
              const overflow = lineRemaining < -0.01;
              const qtySum = lineQtyTotals[ln.key] || 0;
              const qtyRemaining = ln.quantity > 0 ? ln.quantity - qtySum : 0;
              const qtyOver = ln.quantity > 0 && qtyRemaining < -0.0001;
              const hasQtyMode = ln.quantity > 0 && ln.unit_gross > 0;

              return (
                <div key={ln.key} className="rounded-lg border border-border/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2">{ln.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>
                          Brutto: <span className="font-mono">{fmt(ln.gross)} zł</span>
                        </span>
                        {hasQtyMode && (
                          <>
                            <span>
                              Ilość: <span className="font-mono">{ln.quantity}</span> {ln.unit}
                            </span>
                            <span>
                              Cena/jm: <span className="font-mono">{fmt(ln.unit_gross)} zł</span>
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Pozostało</p>
                      <p
                        className={`text-sm font-mono font-semibold ${
                          overflow ? "text-destructive" : lineBalanced ? "text-emerald-600" : "text-foreground"
                        }`}
                      >
                        {fmt(lineRemaining)} zł
                      </p>
                      {hasQtyMode && (
                        <p
                          className={`text-[11px] font-mono ${
                            qtyOver ? "text-destructive" : Math.abs(qtyRemaining) < 0.0001 ? "text-emerald-600" : "text-muted-foreground"
                          }`}
                        >
                          {Number(qtyRemaining.toFixed(4))} {ln.unit}
                        </p>
                      )}
                    </div>
                  </div>

                  {allocs.length > 0 && (
                    <div className="space-y-1.5">
                      {/* Header */}
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1">
                        <span className="flex-1">Projekt</span>
                        {hasQtyMode && <span className="w-24 text-right">Ilość ({ln.unit})</span>}
                        <span className="w-32 text-right">Kwota brutto</span>
                        <span className="w-9" />
                      </div>
                      {allocs.map((a) => (
                        <div key={a.uid} className="flex items-center gap-2">
                          <Select
                            value={a.project_id}
                            onValueChange={(v) => updateAllocation(ln.key, a.uid, { project_id: v })}
                          >
                            <SelectTrigger className="h-9 flex-1">
                              <SelectValue placeholder="Wybierz projekt..." />
                            </SelectTrigger>
                            <SelectContent>
                              {activeProjects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    {p.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {hasQtyMode && (
                            <div className="relative w-24">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={a.qty}
                                onChange={(e) => handleQtyChange(ln, a.uid, e.target.value)}
                                placeholder="0"
                                className="h-9 pr-8 text-right font-mono"
                                title={`Ilość w jednostce: ${ln.unit}`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                                {ln.unit}
                              </span>
                            </div>
                          )}

                          <div className="relative w-32">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={a.amount}
                              onChange={(e) => handleAmountChange(ln, a.uid, e.target.value)}
                              placeholder="0,00"
                              className="h-9 pr-9 text-right font-mono"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              zł
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeAllocation(ln.key, a.uid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      addAllocation(
                        ln.key,
                        ln,
                        lineRemaining > 0 ? lineRemaining : 0,
                        qtyRemaining > 0 ? qtyRemaining : 0
                      )
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj projekt
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer with global counter and save */}
        <div className="border-t border-border/50 pt-3 mt-2 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-2.5">
            <div>
              <p className="text-xs text-muted-foreground">Pozostało do przypisania</p>
              <p
                className={`text-lg font-mono font-semibold ${
                  Math.abs(remaining) < 0.01
                    ? "text-emerald-600"
                    : remaining < 0
                    ? "text-destructive"
                    : "text-foreground"
                }`}
              >
                {fmt(remaining)} zł
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Przypisane</p>
              <p className="text-sm font-mono font-medium text-foreground">
                {fmt(totalAllocated)} / {fmt(invoiceGross)} zł
              </p>
            </div>
          </div>

          {(hasEmptyProject || hasZeroAmount || lineOverflow) && (
            <p className="text-xs text-destructive">
              {lineOverflow
                ? "Suma przypisana w jednej z pozycji przekracza jej wartość."
                : hasEmptyProject
                ? "Każde przypisanie musi mieć wybrany projekt."
                : "Każde przypisanie musi mieć kwotę większą od zera."}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              title={!isBalanced ? "Suma musi się zgadzać z kwotą brutto faktury" : undefined}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Split className="h-4 w-4 mr-1" />
              )}
              Zapisz rozdzielenie
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
