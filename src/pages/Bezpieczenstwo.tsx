import PublicNav from "@/components/PublicNav";
import Seo from "@/components/Seo";
import { Shield, Lock, Database, Server, RefreshCw, FileCheck } from "lucide-react";

const items = [
  { icon: Lock, title: "Szyfrowanie danych", desc: "Cała komunikacja idzie po HTTPS (TLS 1.2+). Dane wrażliwe (np. tokeny KSeF) są szyfrowane symetrycznie po stronie backendu, a w UI maskowane." },
  { icon: Database, title: "Izolacja firm (RLS)", desc: "Każda firma ma własną przestrzeń danych zabezpieczoną Row Level Security w bazie PostgreSQL. Użytkownik widzi tylko dane firm, do których ma uprawnienia." },
  { icon: Server, title: "Hosting w UE", desc: "Backend i baza danych działają na infrastrukturze chmurowej w regionie europejskim, zgodnie z RODO." },
  { icon: RefreshCw, title: "Backupy", desc: "Automatyczne, codzienne kopie zapasowe bazy danych z możliwością odtworzenia point-in-time." },
  { icon: FileCheck, title: "Zgodność z KSeF", desc: "Integracja z produkcyjnym API KSeF v2 Ministerstwa Finansów. Faktury w schemacie FA(3), uwierzytelnianie tokenem RSA-OAEP." },
  { icon: Shield, title: "RODO", desc: "Realizujemy prawa użytkowników (dostęp, poprawianie, usunięcie). Pełne informacje w Polityce prywatności." },
];

export default function Bezpieczenstwo() {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Bezpieczeństwo Facturo — szyfrowanie, RODO, KSeF"
        description="Jak Facturo chroni dane Twojej firmy: szyfrowanie, izolacja danych, hosting w UE, backupy, zgodność z KSeF i RODO."
        path="/bezpieczenstwo"
      />
      <PublicNav variant="light" />
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        <h1 className="text-4xl font-bold tracking-tight">Bezpieczeństwo</h1>
        <p className="mt-4 text-muted-foreground text-lg">
          Facturo to aplikacja księgowa — bezpieczeństwo danych traktujemy priorytetowo.
        </p>
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {items.map((it) => (
            <section key={it.title} className="rounded-2xl border border-border p-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mb-4">
                <it.icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-semibold text-foreground">{it.title}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{it.desc}</p>
            </section>
          ))}
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          Zgłaszanie podatności: <a className="underline" href="mailto:kontakt@e-ksefai.pl">kontakt@e-ksefai.pl</a>
        </p>
      </main>
    </div>
  );
}
