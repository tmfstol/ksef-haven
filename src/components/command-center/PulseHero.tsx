import { Building2, TrendingUp, TrendingDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCountUp } from "@/hooks/useCountUp";

interface Company {
  id: string;
  name: string;
  nip: string;
}

interface PulseHeroProps {
  companies: Company[] | undefined;
  activeCompany: Company | null;
  activeCompanyId: string | null;
  onChangeCompany: (id: string) => void;
  profit: number;
  prevProfit: number;
  revenue: number;
  costs: number;
}

function formatPln(amount: number, fractionDigits = 0) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

const monthNamesPl = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];

export function PulseHero({
  companies,
  activeCompany,
  activeCompanyId,
  onChangeCompany,
  profit,
  prevProfit,
  revenue,
  costs,
}: PulseHeroProps) {
  const animatedProfit = useCountUp(profit);
  const animatedRevenue = useCountUp(revenue);
  const animatedCosts = useCountUp(costs);

  const now = new Date();
  const monthLabel = `${monthNamesPl[now.getMonth()]} ${now.getFullYear()}`;
  const greeting = (() => {
    const h = now.getHours();
    if (h < 11) return "Dzień dobry";
    if (h < 18) return "Witaj ponownie";
    return "Dobry wieczór";
  })();

  const profitPct = prevProfit !== 0 ? Math.round(((profit - prevProfit) / Math.abs(prevProfit)) * 100) : (profit > 0 ? 100 : 0);
  const profitPositive = profit >= prevProfit;
  const TrendIcon = profitPositive ? TrendingUp : TrendingDown;

  return (
    <div className="pulse-hero p-6 md:p-8 lg:p-10 pulse-fade-up">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* LEFT: greeting + company */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-white/60 uppercase tracking-[0.2em]">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 pulse-live-dot" />
              <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Pulse · na żywo
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
            {greeting}<span className="text-white/50">.</span>
          </h1>
          <p className="text-sm md:text-base text-white/70 max-w-xl">
            Oto puls Twojej firmy — <span className="text-white font-medium capitalize">{monthLabel}</span>. Wszystko, co musisz wiedzieć, w jednym miejscu.
          </p>

          <div className="pt-2">
            {companies && companies.length > 1 ? (
              <Select value={activeCompanyId || ""} onValueChange={onChangeCompany}>
                <SelectTrigger className="w-[260px] h-10 rounded-xl text-sm bg-white/10 border-white/15 text-white hover:bg-white/15 backdrop-blur-md">
                  <Building2 className="h-4 w-4 mr-1 opacity-70" />
                  <SelectValue placeholder="Wybierz firmę" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : activeCompany ? (
              <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 border border-white/15 rounded-xl backdrop-blur-md">
                <Building2 className="h-4 w-4 text-white/70" />
                <span className="text-sm font-medium text-white">{activeCompany.name}</span>
                <span className="text-xs text-white/50">NIP: {activeCompany.nip}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT: signature profit */}
        <div className="lg:text-right space-y-2 min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/50">
            Zysk · ten miesiąc
          </div>
          <div className="flex lg:justify-end items-baseline gap-2 flex-wrap">
            <span className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight tabular-nums ${profit >= 0 ? "text-white" : "text-rose-300"}`}>
              {formatPln(animatedProfit)}
            </span>
          </div>
          <div className="flex lg:justify-end items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${profitPositive ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {profitPositive ? "+" : ""}{profitPct}%
            </span>
            <span className="text-xs text-white/50">vs poprzedni miesiąc</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 lg:pt-4 max-w-sm lg:ml-auto">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Przychód</div>
              <div className="text-sm md:text-base font-semibold text-emerald-300 tabular-nums truncate">{formatPln(animatedRevenue)}</div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-[10px] uppercase tracking-wider text-white/50 mb-0.5">Koszty</div>
              <div className="text-sm md:text-base font-semibold text-rose-300 tabular-nums truncate">{formatPln(animatedCosts)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
