import { Wallet, Receipt, FolderKanban, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  cash: { balance: number; sparkline: number[]; hasBank: boolean };
  nextPayment: {
    nearest: { vendor: string; gross_amount: number; days_until_due: number } | null;
    totalDueSoon: number;
    countDueSoon: number;
  } | null;
  activeProjects: number;
  peopleOnSite: number;
}

function formatPln(v: number, frac = 0) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: frac, maximumFractionDigits: frac }).format(v);
}

interface TileProps {
  label: string;
  value: string;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconFg: string;
  to?: string;
  children?: React.ReactNode;
  delay?: number;
}

function Tile({ label, value, hint, icon: Icon, iconBg, iconFg, to, children, delay = 0 }: TileProps) {
  const inner = (
    <div
      className="group relative h-full bg-card border border-border rounded-xl p-4 md:p-5 transition-all duration-200 hover:border-foreground/15 hover:shadow-sm animate-fade-in flex flex-col"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">{label}</span>
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconFg}`} />
        </div>
      </div>
      <div className="text-[26px] md:text-[28px] font-semibold text-foreground tracking-tight tabular-nums leading-none mb-2">
        {value}
      </div>
      <div className="mt-auto min-h-[28px] text-[12px] text-muted-foreground">
        {hint}
      </div>
      {children}
    </div>
  );
  return to ? <Link to={to} className="block h-full">{inner}</Link> : inner;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <div className="absolute inset-x-0 bottom-0 h-12 opacity-70 pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#sparkGrad)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BentoKpiGrid({ cash, nextPayment, activeProjects, peopleOnSite }: Props) {
  const cashTrend = cash.sparkline.length > 1 && cash.sparkline[cash.sparkline.length - 1] >= cash.sparkline[0];
  const cashColor = cashTrend ? "hsl(160 60% 45%)" : "hsl(8 70% 60%)";

  const nearestText = nextPayment?.nearest
    ? nextPayment.nearest.days_until_due < 0
      ? `${Math.abs(nextPayment.nearest.days_until_due)} dni po terminie`
      : nextPayment.nearest.days_until_due === 0
        ? "termin dziś"
        : `za ${nextPayment.nearest.days_until_due} dni`
    : "brak płatności";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[160px]">
      {/* Stan konta / Płynność */}
      <div className="relative">
        <Tile
          label="Płynność"
          value={formatPln(cash.balance)}
          hint={cash.hasBank ? (cashTrend ? "Trend rosnący · 30 dni" : "Trend spadkowy · 30 dni") : "Bilans szacunkowy z faktur"}
          icon={Wallet}
          iconBg="bg-emerald-500/10"
          iconFg="text-emerald-600 dark:text-emerald-400"
          delay={0}
        >
          <Sparkline data={cash.sparkline} color={cashColor} />
        </Tile>
      </div>

      {/* Do zapłaty */}
      <Tile
        label="Do zapłaty"
        value={nextPayment ? formatPln(nextPayment.totalDueSoon) : formatPln(0)}
        hint={
          nextPayment?.nearest ? (
            <span className="block truncate">
              <span className="font-medium text-foreground">{nextPayment.nearest.vendor}</span>
              <span className="text-muted-foreground"> · {nearestText}</span>
            </span>
          ) : (
            "Brak nadchodzących płatności"
          )
        }
        icon={Receipt}
        iconBg="bg-amber-500/10"
        iconFg="text-amber-600 dark:text-amber-400"
        delay={70}
      />

      {/* Aktywne projekty */}
      <Tile
        label="Aktywne projekty"
        value={String(activeProjects)}
        hint={activeProjects === 1 ? "trwająca budowa" : "trwających budów"}
        icon={FolderKanban}
        iconBg="bg-primary/10"
        iconFg="text-primary"
        to="/projects"
        delay={140}
      />

      {/* Ludzie w terenie */}
      <Tile
        label="Ludzie w terenie"
        value={String(peopleOnSite)}
        hint={peopleOnSite === 0 ? "Nikt nie ma dziś zaplanowanych zadań" : peopleOnSite === 1 ? "1 osoba w pracy" : `${peopleOnSite} osób w pracy`}
        icon={Users}
        iconBg="bg-violet-500/10"
        iconFg="text-violet-600 dark:text-violet-400"
        to="/schedule"
        delay={210}
      />
    </div>
  );
}
