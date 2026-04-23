import { Link } from "react-router-dom";
import { ArrowUpRight, FolderKanban } from "lucide-react";

interface ProjectBudget {
  id: string;
  name: string;
  color: string;
  budget: number | null;
  spent: number;
  status: string;
}

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(v);
}

export function ProjectsHealth({ projects }: { projects: ProjectBudget[] }) {
  // Top 3 projekty wg wykorzystania budżetu (lub kosztów jeśli brak budżetu)
  const top = [...projects]
    .sort((a, b) => {
      const aPct = a.budget ? a.spent / a.budget : a.spent / 1_000_000;
      const bPct = b.budget ? b.spent / b.budget : b.spent / 1_000_000;
      return bPct - aPct;
    })
    .slice(0, 3);

  return (
    <div className="bg-card border border-border rounded-xl p-5 md:p-6 h-full flex flex-col animate-fade-in">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground tracking-tight">Kondycja projektów</h2>
          </div>
          <p className="text-xs text-muted-foreground">Budżet zaplanowany vs koszty rzeczywiste</p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Zobacz wszystkie
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Brak aktywnych projektów
        </div>
      ) : (
        <div className="space-y-5 flex-1">
          {top.map((p, idx) => {
            const pct = p.budget ? (p.spent / p.budget) * 100 : 0;
            const clampedPct = Math.min(pct, 100);
            const overflowPct = Math.max(0, pct - 100);
            const isCritical = pct >= 90;
            const isWarning = pct >= 75 && pct < 90;

            const barColor = !p.budget
              ? "hsl(220 9% 46%)"
              : isCritical
                ? "hsl(8 70% 60%)" // koralowy
                : isWarning
                  ? "hsl(38 85% 55%)"
                  : "hsl(160 60% 45%)"; // pastelowy emerald

            return (
              <div key={p.id} className="animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
                <div className="flex items-end justify-between mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                  </div>
                  <div className="flex items-baseline gap-2 flex-shrink-0">
                    <span className="text-sm font-semibold text-foreground tabular-nums">{formatPln(p.spent)}</span>
                    {p.budget && (
                      <span className="text-xs text-muted-foreground tabular-nums">/ {formatPln(p.budget)}</span>
                    )}
                  </div>
                </div>

                {p.budget ? (
                  <>
                    <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                        style={{ width: `${clampedPct}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        {p.budget && (
                          <>Pozostało: <span className="text-foreground tabular-nums">{formatPln(Math.max(0, p.budget - p.spent))}</span></>
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-semibold tabular-nums ${
                          isCritical ? "text-rose-500" : isWarning ? "text-amber-500" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {Math.round(pct)}%
                        {overflowPct > 0 && <span className="text-rose-500"> · +{Math.round(overflowPct)}% nad</span>}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Brak ustawionego budżetu</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
