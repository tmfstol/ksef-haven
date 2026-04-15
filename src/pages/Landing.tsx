import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText, Shield, RefreshCw, Download, BarChart3, Mail,
  CheckCircle2, Brain, Receipt, Users, Calculator,
  Zap, Bell, PieChart, CreditCard, Bot, ScanLine,
  FileCheck, TrendingUp, Clock
} from "lucide-react";

const features = [
  {
    icon: RefreshCw,
    title: "Automatyczna synchronizacja KSeF",
    description: "Połącz się z Krajowym Systemem e-Faktur i automatycznie pobieraj wszystkie faktury kosztowe.",
  },
  {
    icon: FileText,
    title: "Wystawianie faktur FA(3)",
    description: "Twórz faktury sprzedażowe zgodne ze schematem FA(3) z generowaniem XML do KSeF.",
  },
  {
    icon: Download,
    title: "PDF z QR kodem",
    description: "Każda faktura w formacie PDF z kodem QR zgodnym z KSeF, gotowa do archiwizacji.",
  },
  {
    icon: Shield,
    title: "Bezpieczne przechowywanie",
    description: "Szyfrowanie danych i pełna izolacja między firmami zgodnie z najwyższymi standardami.",
  },
  {
    icon: BarChart3,
    title: "Dashboard i analityka",
    description: "Panel z filtrami, statystykami i podglądem faktur w podziale na kontrahentów.",
  },
  {
    icon: Mail,
    title: "Wysyłka email",
    description: "Wysyłaj faktury na email klienta jednym kliknięciem z automatycznym załącznikiem PDF.",
  },
];

const modules = [
  {
    icon: Brain,
    color: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-400",
    title: "Asystent Księgowy AI",
    description: "Inteligentny asystent oparty na sztucznej inteligencji, który pomaga w codziennej pracy księgowej.",
    items: [
      { icon: Bot, text: "Automatyczne rozpoznawanie dokumentów" },
      { icon: Zap, text: "Inteligentne kategoryzowanie transakcji" },
      { icon: ScanLine, text: "OCR — skanowanie faktur i paragonów" },
      { icon: PieChart, text: "Analiza kosztów i rekomendacje" },
    ],
  },
  {
    icon: Calculator,
    color: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-400",
    title: "Rozliczenia Podatkowe",
    description: "Automatyczne generowanie deklaracji podatkowych i plików JPK zgodnych z wymogami urzędów.",
    items: [
      { icon: FileCheck, text: "Automatyczne rozliczenia podatkowe" },
      { icon: FileText, text: "Generowanie deklaracji PIT" },
      { icon: Download, text: "Generowanie JPK-V7M" },
      { icon: RefreshCw, text: "Synchronizacja z systemem podatkowym" },
    ],
  },
  {
    icon: Users,
    color: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400",
    title: "CRM i Klienci",
    description: "Pełne zarządzanie relacjami z klientami, monitorowanie płatności i automatyczne alerty.",
    items: [
      { icon: Clock, text: "Monitorowanie transakcji w czasie rzeczywistym" },
      { icon: CreditCard, text: "Automatyczne dopasowywanie płatności" },
      { icon: Bell, text: "Alerty o nowych transakcjach" },
      { icon: TrendingUp, text: "Historia transakcji per klient" },
    ],
  },
  {
    icon: Receipt,
    color: "from-orange-500/20 to-amber-500/20",
    iconColor: "text-orange-400",
    title: "Zarządzanie Wydatkami",
    description: "Rejestruj, kategoryzuj i analizuj wydatki firmowe. Pełna kontrola nad kosztami.",
    items: [
      { icon: ScanLine, text: "Skanowanie i OCR dokumentów" },
      { icon: Zap, text: "Automatyczne kategoryzowanie" },
      { icon: PieChart, text: "Profesjonalne raporty księgowe" },
      { icon: BarChart3, text: "Analiza wydatków w czasie" },
    ],
  },
];

const benefits = [
  "Obsługa wielu firm z jednego konta",
  "Automatyczna numeracja faktur",
  "Filtrowanie po kontrahentach, datach i kwotach",
  "Podgląd pozycji faktury bez otwierania PDF",
  "Podświetlanie nowych faktur od ostatniej wizyty",
  "Eksport danych do księgowości",
  "Asystent AI dostępny 24/7",
  "Automatyczne generowanie JPK i PIT",
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-foreground">KSeF Archiwum</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Zaloguj się</Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Załóż konto</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
          <Brain className="h-4 w-4" />
          <span>Nowy moduł: Asystent Księgowy AI</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight max-w-4xl mx-auto">
          Kompleksowa platforma księgowa z&nbsp;AI dla&nbsp;Twojej firmy
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          KSeF Archiwum to nie tylko faktury. Zarządzaj wydatkami, klientami, podatkami i dokumentami
          z pomocą inteligentnego asystenta AI. Wszystko w jednym miejscu.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link to="/login">
            <Button size="lg" className="text-base px-8">
              Rozpocznij za darmo
            </Button>
          </Link>
          <a href="#modules">
            <Button size="lg" variant="outline" className="text-base px-8">
              Poznaj moduły
            </Button>
          </a>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-4">
          Moduły platformy
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Cztery zintegrowane moduły, które automatyzują pracę księgową i oszczędzają czas.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {modules.map((module) => (
            <div
              key={module.title}
              className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 hover:border-primary/20 transition-all hover:shadow-lg"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${module.color} mb-5`}>
                <module.icon className={`h-6 w-6 ${module.iconColor}`} />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{module.title}</h3>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{module.description}</p>
              <div className="space-y-3">
                {module.items.map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Obsługa KSeF i faktur
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/20 transition-colors"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm p-10">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">
            Dlaczego KSeF Archiwum?
          </h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Jak to działa?
        </h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { step: "1", title: "Załóż konto", desc: "Zarejestruj się i dodaj firmę z tokenem KSeF." },
            { step: "2", title: "Synchronizuj", desc: "Pobierz faktury automatycznie z KSeF." },
            { step: "3", title: "Zarządzaj", desc: "Przeglądaj, kategoryzuj i analizuj dokumenty." },
            { step: "4", title: "Rozliczaj", desc: "Generuj JPK, PIT i raporty jednym kliknięciem." },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg mb-4">
                {item.step}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Gotowy na prostszą księgowość?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Dołącz do użytkowników, którzy oszczędzają czas dzięki automatyzacji.
          Rejestracja zajmuje mniej niż minutę.
        </p>
        <Link to="/login">
          <Button size="lg" className="text-base px-8">
            Załóż darmowe konto
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>KSeF Archiwum — kompleksowa platforma księgowa z AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} KSeF Archiwum. Wszelkie prawa zastrzeżone.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
