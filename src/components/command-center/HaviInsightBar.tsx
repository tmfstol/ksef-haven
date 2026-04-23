import { Sparkles } from "lucide-react";
import { useMemo } from "react";

interface Props {
  ksefToReview: number;
  projectsNearLimit: { name: string; pct: number }[];
  overduePayments: number;
  totalDueSoon: number;
  peopleOnSite: number;
  companyName?: string;
}

function formatPln(v: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", minimumFractionDigits: 0 }).format(v);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return "Dzień dobry";
  if (h < 18) return "Witaj";
  return "Dobry wieczór";
}

/**
 * Wąski pasek na górze dashboardu — Havi generuje krótkie podsumowanie
 * najważniejszych spraw z dzisiejszego dnia.
 */
export function HaviInsightBar({
  ksefToReview,
  projectsNearLimit,
  overduePayments,
  totalDueSoon,
  peopleOnSite,
}: Props) {
  const insights = useMemo(() => {
    const items: string[] = [];
    if (ksefToReview > 0) {
      items.push(`Masz ${ksefToReview} ${ksefToReview === 1 ? "fakturę KSeF" : "faktur KSeF"} do rozdzielenia.`);
    }
    if (projectsNearLimit.length > 0) {
      const top = projectsNearLimit[0];
      items.push(`Projekt ${top.name} zbliża się do limitu budżetu (${top.pct}%).`);
    }
    if (overduePayments > 0) {
      items.push(`${overduePayments} ${overduePayments === 1 ? "płatność jest" : "płatności jest"} po terminie.`);
    } else if (totalDueSoon > 0) {
      items.push(`Najbliższe płatności: ${formatPln(totalDueSoon)}.`);
    }
    if (peopleOnSite > 0) {
      items.push(`Dziś w terenie: ${peopleOnSite} ${peopleOnSite === 1 ? "osoba" : "osób"}.`);
    }
    if (items.length === 0) {
      items.push("Wszystko pod kontrolą — brak spraw wymagających uwagi.");
    }
    return items.slice(0, 3);
  }, [ksefToReview, projectsNearLimit, overduePayments, totalDueSoon, peopleOnSite]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card animate-fade-in">
      <div className="flex items-center gap-3 px-4 py-3 md:px-5 md:py-3.5">
        {/* Avatar AI */}
        <div className="relative flex-shrink-0">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
        </div>

        {/* Treść */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Raport Havi</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">{getGreeting()}</span>
          </div>
          <p className="text-sm text-foreground leading-snug">
            {insights.map((insight, idx) => (
              <span key={idx}>
                {insight}
                {idx < insights.length - 1 && <span className="text-muted-foreground"> </span>}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
