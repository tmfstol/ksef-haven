import { FileText, FileCode, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/types/invoice";
import { motion } from "framer-motion";
import { useState } from "react";

interface InvoiceTableProps {
  invoices: Invoice[];
}

type SortKey = "date" | "vendor" | "grossAmount";

const statusStyles: Record<Invoice["status"], string> = {
  new: "bg-primary/10 text-primary",
  processed: "bg-success/10 text-success",
  error: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<Invoice["status"], string> = {
  new: "New",
  processed: "Processed",
  error: "Error",
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

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...invoices].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "date") cmp = a.date.localeCompare(b.date);
    else if (sortKey === "vendor") cmp = a.vendor.localeCompare(b.vendor);
    else cmp = a.grossAmount - b.grossAmount;
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
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
              <SortHeader label="Date" sortKeyName="date" />
            </th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              <SortHeader label="Vendor" sortKeyName="vendor" />
            </th>
            <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              NIP
            </th>
            <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              <SortHeader label="Gross Amount" sortKeyName="grossAmount" />
            </th>
            <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              Status
            </th>
            <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3.5">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((invoice, i) => (
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
              <td className="px-5 py-3.5 text-sm font-medium text-foreground">
                {invoice.vendor}
              </td>
              <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">
                {invoice.nip}
              </td>
              <td className="px-5 py-3.5 text-sm text-foreground text-right font-semibold tabular-nums">
                {formatCurrency(invoice.grossAmount)}
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
                    onClick={() => {
                      if (invoice.xmlPath) window.open(invoice.xmlPath);
                    }}
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    XML
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-xs rounded-lg gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      if (invoice.pdfPath) window.open(invoice.pdfPath);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
