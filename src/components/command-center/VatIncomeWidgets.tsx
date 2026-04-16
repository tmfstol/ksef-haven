import { Card, CardContent } from "@/components/ui/card";
import { Receipt, TrendingUp, Calculator } from "lucide-react";

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(v);
}

const TAX_LABELS: Record<string, string> = {
  liniowy: "Podatek liniowy 19%",
  ryczałt: "Ryczałt",
  skala: "Skala podatkowa",
};

interface Props {
  vat: { vatDue: number; vatDeductible: number; vatBalance: number };
  income: { revenue: number; costs: number; income: number };
  taxType: string;
}

export function VatIncomeWidgets({ vat, income, taxType }: Props) {
  return (
    <div className="space-y-4">
      {/* VAT Widget */}
      <Card className="fintech-card overflow-hidden">
        <div className="fintech-gradient p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/60 font-medium">Prognoza VAT</p>
              <p className="text-[10px] text-white/40">bieżący miesiąc</p>
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatPln(vat.vatBalance)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-[10px] text-white/50">VAT należny</p>
              <p className="text-sm font-semibold text-white">{formatPln(vat.vatDue)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-[10px] text-white/50">VAT naliczony</p>
              <p className="text-sm font-semibold text-accent">{formatPln(vat.vatDeductible)}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Income Widget */}
      <Card className="fintech-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prognoza dochodu</p>
              <p className="text-[10px] text-muted-foreground">{TAX_LABELS[taxType] || taxType}</p>
            </div>
          </div>
          <div className={`text-xl font-bold tracking-tight ${income.income >= 0 ? "text-accent" : "text-destructive"}`}>
            {formatPln(income.income)}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-accent" />{formatPln(income.revenue)}</span>
            <span>−</span>
            <span>{formatPln(income.costs)} kosztów</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
