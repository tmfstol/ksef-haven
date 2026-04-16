import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, FolderOpen } from "lucide-react";

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

export function ProjectBudgets({ projects }: { projects: ProjectBudget[] }) {
  if (projects.length === 0) {
    return (
      <Card className="fintech-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" /> Projekty & Budżety
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">Brak aktywnych projektów</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="fintech-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-primary" /> Projekty & Budżety
        </CardTitle>
        <p className="text-xs text-muted-foreground">{projects.length} aktywnych</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.map((p) => {
          const pct = p.budget ? Math.min((p.spent / p.budget) * 100, 100) : 0;
          const isOver80 = p.budget && pct >= 80;
          const isOver100 = p.budget && p.spent > p.budget;
          return (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isOver100 ? <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    : isOver80 ? <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    : p.budget ? <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> : null}
                  <span className="text-xs text-muted-foreground">
                    {formatPln(p.spent)}{p.budget ? ` / ${formatPln(p.budget)}` : ""}
                  </span>
                </div>
              </div>
              {p.budget ? (
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isOver100 ? "hsl(0, 84%, 60%)" : isOver80 ? "hsl(38, 92%, 50%)" : p.color,
                    }}
                  />
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">Bez limitu budżetu</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
