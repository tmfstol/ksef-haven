import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Shield, RefreshCw, Download, BarChart3, Mail, CheckCircle2 } from "lucide-react";

const features = [
  {
    icon: RefreshCw,
    title: "Automatyczna synchronizacja KSeF",
    description: "Połącz się z Krajowym Systemem e-Faktur i automatycznie pobieraj wszystkie faktury kosztowe. Koniec z ręcznym ściąganiem dokumentów.",
  },
  {
    icon: FileText,
    title: "Wystawianie faktur FA(3)",
    description: "Twórz faktury sprzedażowe zgodne ze schematem FA(3) bezpośrednio w aplikacji. Generuj XML gotowy do wysyłki do KSeF.",
  },
  {
    icon: Download,
    title: "Pobieranie PDF z QR kodem",
    description: "Każda faktura dostępna w formacie PDF z kodem QR zgodnym z wymogami KSeF. Gotowe do archiwizacji i udostępniania.",
  },
  {
    icon: Shield,
    title: "Bezpieczne przechowywanie",
    description: "Twoje dane są szyfrowane i przechowywane zgodnie z najwyższymi standardami bezpieczeństwa. Pełna izolacja danych między firmami.",
  },
  {
    icon: BarChart3,
    title: "Dashboard i analityka",
    description: "Przejrzysty panel z filtrami, statystykami i podglądem faktur. Śledź koszty w podziale na kontrahentów i okresy.",
  },
  {
    icon: Mail,
    title: "Wysyłka email do klientów",
    description: "Wysyłaj faktury bezpośrednio na email klienta jednym kliknięciem. Automatyczne załączniki PDF i powiadomienia.",
  },
];

const benefits = [
  "Obsługa wielu firm z jednego konta",
  "Automatyczna numeracja faktur",
  "Filtrowanie po kontrahentach, datach i kwotach",
  "Podgląd pozycji faktury bez otwierania PDF",
  "Podświetlanie nowych faktur od ostatniej wizyty",
  "Eksport danych do księgowości",
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
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight max-w-3xl mx-auto">
          Zarządzaj fakturami KSeF w jednym miejscu
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          KSeF Archiwum to nowoczesna aplikacja do automatycznego pobierania, przeglądania
          i wystawiania faktur w Krajowym Systemie e-Faktur. Oszczędź czas i uprość
          obieg dokumentów w swojej firmie.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link to="/login">
            <Button size="lg" className="text-base px-8">
              Rozpocznij za darmo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Wszystko czego potrzebujesz do obsługi KSeF
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
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Załóż konto", desc: "Zarejestruj się i dodaj swoją firmę z numerem NIP oraz tokenem autoryzacyjnym KSeF." },
            { step: "2", title: "Synchronizuj faktury", desc: "Kliknij przycisk synchronizacji, a aplikacja automatycznie pobierze wszystkie Twoje faktury kosztowe z KSeF." },
            { step: "3", title: "Zarządzaj i wystawiaj", desc: "Przeglądaj, filtruj, pobieraj PDF-y i wystawiaj nowe faktury sprzedażowe – wszystko w jednym panelu." },
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
          Gotowy na prostszą obsługę faktur?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Dołącz do użytkowników, którzy oszczędzają czas dzięki automatyzacji KSeF.
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
            <span>KSeF Archiwum — system zarządzania fakturami KSeF</span>
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
