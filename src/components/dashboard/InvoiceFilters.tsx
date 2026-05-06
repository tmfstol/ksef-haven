import { useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Invoice, Vendor } from "@/types/invoice";

export interface InvoiceFiltersState {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  vendor: string | null;
  status: Invoice["status"] | null;
  amountMin: string;
  amountMax: string;
}

const EMPTY_FILTERS: InvoiceFiltersState = {
  dateFrom: undefined,
  dateTo: undefined,
  vendor: null,
  status: null,
  amountMin: "",
  amountMax: "",
};

interface InvoiceFiltersProps {
  filters: InvoiceFiltersState;
  onChange: (filters: InvoiceFiltersState) => void;
  vendors: Vendor[];
}

const statusOptions: { value: Invoice["status"]; label: string }[] = [
  { value: "new", label: "Do sprawdzenia" },
  { value: "processed", label: "Przetworzona" },
  { value: "error", label: "Błąd" },
];

export function InvoiceFilters({ filters, onChange, vendors }: InvoiceFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.vendor,
    filters.status,
    filters.amountMin,
    filters.amountMax,
  ].filter(Boolean).length;

  const update = (patch: Partial<InvoiceFiltersState>) =>
    onChange({ ...filters, ...patch });

  const clearAll = () => onChange({ ...EMPTY_FILTERS });

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtry
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={clearAll}>
            <X className="h-3 w-3" />
            Wyczyść
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border/50 bg-secondary/20">
          {/* Date from */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data od</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-[140px] justify-start text-left text-xs font-normal", !filters.dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {filters.dateFrom ? format(filters.dateFrom, "dd.MM.yyyy") : "Wybierz"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(d) => update({ dateFrom: d })}
                  locale={pl}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date to */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data do</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("w-[140px] justify-start text-left text-xs font-normal", !filters.dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {filters.dateTo ? format(filters.dateTo, "dd.MM.yyyy") : "Wybierz"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(d) => update({ dateTo: d })}
                  locale={pl}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Vendor */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kontrahent</label>
            <Select
              value={filters.vendor || "all"}
              onValueChange={(v) => update({ vendor: v === "all" ? null : v })}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Wszyscy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszyscy</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.nip} value={v.nip}>
                    {v.name} ({v.invoiceCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) => update({ status: v === "all" ? null : (v as Invoice["status"]) })}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Wszystkie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount min */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kwota od (PLN)</label>
            <input
              type="number"
              placeholder="0"
              value={filters.amountMin}
              onChange={(e) => update({ amountMin: e.target.value })}
              className="h-8 w-[110px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Amount max */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Kwota do (PLN)</label>
            <input
              type="number"
              placeholder="∞"
              value={filters.amountMax}
              onChange={(e) => update({ amountMax: e.target.value })}
              className="h-8 w-[110px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function applyFilters(invoices: Invoice[], filters: InvoiceFiltersState): Invoice[] {
  let result = invoices;

  if (filters.dateFrom) {
    const from = format(filters.dateFrom, "yyyy-MM-dd");
    result = result.filter((i) => i.date >= from);
  }
  if (filters.dateTo) {
    const to = format(filters.dateTo, "yyyy-MM-dd");
    result = result.filter((i) => i.date <= to);
  }
  if (filters.vendor) {
    result = result.filter((i) => i.nip === filters.vendor);
  }
  if (filters.status) {
    result = result.filter((i) => i.status === filters.status);
  }
  if (filters.amountMin) {
    const min = parseFloat(filters.amountMin);
    if (!isNaN(min)) result = result.filter((i) => i.gross_amount >= min);
  }
  if (filters.amountMax) {
    const max = parseFloat(filters.amountMax);
    if (!isNaN(max)) result = result.filter((i) => i.gross_amount <= max);
  }

  return result;
}
