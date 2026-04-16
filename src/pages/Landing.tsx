import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText, Shield, RefreshCw, Download, BarChart3, Mail,
  CheckCircle2, Brain, Receipt, Users, Calculator,
  Zap, Bell, PieChart, CreditCard, Bot, ScanLine,
  FileCheck, TrendingUp, Clock, ArrowRight, Sparkles, Lock
} from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

const features = [
  {
    icon: RefreshCw,
    title: "Sync z KSeF",
    description: "Automatyczne pobieranie faktur kosztowych i przychodowych z Krajowego Systemu e-Faktur.",
  },
  {
    icon: FileText,
    title: "Faktury FA(3)",
    description: "Wystawianie faktur zgodnych ze schematem FA(3) z generowaniem XML.",
  },
  {
    icon: Download,
    title: "PDF z QR",
    description: "Oficjalny format PDF identyczny z KSeF, z kodem QR do weryfikacji.",
  },
  {
    icon: Shield,
    title: "Bezpieczeństwo",
    description: "Szyfrowanie danych, izolacja firm i pełna kontrola dostępu z rolami.",
  },
  {
    icon: BarChart3,
    title: "Analityka",
    description: "Dashboard z filtrami, statystykami i podziałem na kosztowe/przychodowe.",
  },
  {
    icon: Mail,
    title: "Wysyłka",
    description: "Automatyczna wysyłka PDF na email lub webhook jednym kliknięciem.",
  },
];

const modules = [
  {
    icon: Brain,
    gradient: "from-violet-500 to-purple-600",
    bgGlow: "bg-violet-500/10",
    title: "Asystent AI",
    description: "Inteligentny asystent wspiera codzienną pracę księgową — rozpoznaje dokumenty, kategoryzuje transakcje i analizuje koszty.",
    items: ["Rozpoznawanie dokumentów", "Kategoryzowanie transakcji", "OCR faktur i paragonów", "Analiza kosztów"],
  },
  {
    icon: Calculator,
    gradient: "from-emerald-500 to-green-600",
    bgGlow: "bg-emerald-500/10",
    title: "Rozliczenia",
    description: "Automatyczne generowanie deklaracji podatkowych i plików JPK zgodnych z wymogami urzędów.",
    items: ["Rozliczenia podatkowe", "Deklaracje PIT", "Generowanie JPK-V7M", "Sync z systemem"],
  },
  {
    icon: Users,
    gradient: "from-blue-500 to-cyan-600",
    bgGlow: "bg-blue-500/10",
    title: "CRM",
    description: "Zarządzanie relacjami z klientami, monitorowanie płatności i automatyczne alerty.",
    items: ["Monitoring transakcji", "Dopasowywanie płatności", "Alerty o transakcjach", "Historia per klient"],
  },
  {
    icon: Receipt,
    gradient: "from-orange-500 to-amber-600",
    bgGlow: "bg-orange-500/10",
    title: "Wydatki",
    description: "Rejestruj, kategoryzuj i analizuj wydatki firmowe z pełną kontrolą nad kosztami.",
    items: ["Skanowanie dokumentów", "Auto-kategoryzowanie", "Raporty księgowe", "Analiza w czasie"],
  },
];

const steps = [
  { num: "01", title: "Załóż konto", desc: "Rejestracja zajmuje 30 sekund. Bez karty kredytowej." },
  { num: "02", title: "Dodaj firmę", desc: "Podaj NIP i token KSeF — reszta automatycznie." },
  { num: "03", title: "Synchronizuj", desc: "Faktury pobierają się z KSeF jednym kliknięciem." },
  { num: "04", title: "Zarządzaj", desc: "Przeglądaj, analizuj i wysyłaj — wszystko w jednym." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">KSeF Archiwum</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-sm">Zaloguj się</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="text-sm gap-1.5 shadow-lg shadow-primary/25">
                Rozpocznij
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-500/5 blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8"
          >
            <Sparkles className="h-4 w-4" />
            <span>Nowy moduł: Asystent Księgowy AI</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight"
          >
            Twoja księgowość.
            <br />
            <span className="bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
              Inteligentna.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Synchronizuj faktury z KSeF, zarządzaj kosztami i przychodami,
            generuj deklaracje — wszystko z jednego panelu z asystentem AI.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/login">
              <Button size="lg" className="text-base px-8 h-12 shadow-xl shadow-primary/25 gap-2">
                Załóż darmowe konto
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#modules">
              <Button size="lg" variant="outline" className="text-base px-8 h-12">
                Poznaj moduły
              </Button>
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-14 flex items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary/60" />
              <span>Szyfrowanie end-to-end</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary/60" />
              <span>Zgodne z RODO</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary/60" />
              <span>Darmowy start</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6">
          {[
            { value: "KSeF v2", label: "Oficjalne API" },
            { value: "FA(3)", label: "Najnowszy schemat" },
            { value: "24/7", label: "Asystent AI" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center py-6 rounded-2xl glass-panel"
            >
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Cztery moduły, jedna platforma
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl mx-auto text-lg">
            Kompleksowa automatyzacja pracy księgowej — od faktur po deklaracje.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {modules.map((module, i) => (
            <motion.div
              key={module.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="relative group rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 hover:border-primary/30 transition-all duration-300 hover:shadow-xl overflow-hidden"
            >
              {/* Subtle glow */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full ${module.bgGlow} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className="relative">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${module.gradient} mb-5`}>
                  <module.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{module.title}</h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{module.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  {module.items.map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="text-3xl md:text-4xl font-bold text-foreground text-center mb-14 tracking-tight"
        >
          Obsługa KSeF i faktur
        </motion.h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="group rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="text-3xl md:text-4xl font-bold text-foreground text-center mb-14 tracking-tight"
        >
          Zacznij w 4 krokach
        </motion.h2>
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center"
            >
              <div className="text-4xl font-bold text-primary/20 mb-3 tabular-nums">{step.num}</div>
              <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-violet-600" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />

          <div className="relative px-10 py-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4 tracking-tight">
              Gotowy na prostszą księgowość?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto text-lg">
              Dołącz do użytkowników, którzy oszczędzają godziny dzięki automatyzacji.
              Rejestracja zajmuje 30 sekund.
            </p>
            <Link to="/login">
              <Button size="lg" variant="secondary" className="text-base px-8 h-12 gap-2 shadow-xl">
                Załóż darmowe konto
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>KSeF Archiwum — platforma księgowa z AI</span>
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
