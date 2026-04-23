import { Link } from "react-router-dom";
import { ChevronRight, Inbox, AlertCircle, FileWarning } from "lucide-react";

interface ActionItem {
  id: string;
  label: string;
  count: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  tone: "primary" | "warning" | "danger";
}

interface Props {
  ksefToReview: number;
  overduePayments: number;
  invoicesToVerify: number;
}

const TONE_BG: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export function PendingActions({ ksefToReview, overduePayments, invoicesToVerify }: Props) {
  const actions: ActionItem[] = [];
  if (ksefToReview > 0) {
    actions.push({
      id: "ksef",
      label: "Rozdziel pozycje z KSeF",
      count: ksefToReview,
      hint: ksefToReview === 1 ? "1 nowa faktura" : `${ksefToReview} nowych faktur`,
      icon: Inbox,
      to: "/dashboard",
      tone: "primary",
    });
  }
  if (overduePayments > 0) {
    actions.push({
      id: "overdue",
      label: "Płatności po terminie",
      count: overduePayments,
      hint: overduePayments === 1 ? "1 wymaga uwagi" : `${overduePayments} wymaga uwagi`,
      icon: AlertCircle,
      to: "/dashboard",
      tone: "danger",
    });
  }
  if (invoicesToVerify > 0) {
    actions.push({
      id: "verify",
      label: "Faktury do weryfikacji",
      count: invoicesToVerify,
      hint: "Wymagają zatwierdzenia",
      icon: FileWarning,
      to: "/dashboard",
      tone: "warning",
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">Oczekujące akcje</h3>
        {actions.length > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums">{actions.length}</span>
        )}
      </div>

      {actions.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">Wszystko obsłużone — brak zaległych zadań.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {actions.map((a) => (
            <Link
              key={a.id}
              to={a.to}
              className="flex items-center gap-3 px-2.5 py-2.5 -mx-1.5 rounded-lg hover:bg-secondary/60 transition-colors group"
            >
              <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${TONE_BG[a.tone]}`}>
                <a.icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{a.hint}</p>
              </div>
              <span className="text-sm font-semibold text-foreground tabular-nums">{a.count}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
