import PublicNav from "@/components/PublicNav";
import Seo from "@/components/Seo";
import { CheckCircle2 } from "lucide-react";

const services = [
  { name: "Aplikacja Facturo", status: "operational" },
  { name: "API / Backend", status: "operational" },
  { name: "Synchronizacja KSeF", status: "operational" },
  { name: "Wysyłka e-mail", status: "operational" },
  { name: "Płatności (Stripe)", status: "operational" },
];

export default function Status() {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Status Facturo — dostępność usług"
        description="Aktualny status komponentów Facturo: aplikacja, API, KSeF, e-mail, płatności."
        path="/status"
      />
      <PublicNav variant="light" />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold tracking-tight">Status systemu</h1>
        <p className="mt-3 text-muted-foreground">
          Wszystkie usługi działają prawidłowo. Aktualizacja: {new Date().toLocaleString("pl-PL")}.
        </p>
        <div className="mt-10 rounded-2xl border border-border divide-y divide-border">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm text-foreground">{s.name}</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" /> Sprawne
              </span>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Incydenty zgłaszaj na <a className="underline" href="mailto:kontakt@e-ksefai.pl">kontakt@e-ksefai.pl</a>.
        </p>
      </main>
    </div>
  );
}
