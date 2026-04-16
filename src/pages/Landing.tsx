import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText, Shield, RefreshCw, Download, BarChart3, Mail,
  CheckCircle2, Brain, Receipt, Users, Calculator,
  Zap, ArrowRight, Sparkles, Lock, Clock, Newspaper,
  TrendingUp, ChevronRight, Globe, Star
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
  { icon: RefreshCw, title: "Sync z KSeF", description: "Automatyczne pobieranie faktur kosztowych i przychodowych z Krajowego Systemu e-Faktur." },
  { icon: FileText, title: "Faktury FA(3)", description: "Wystawianie faktur zgodnych ze schematem FA(3) z generowaniem XML." },
  { icon: Download, title: "PDF z QR", description: "Oficjalny format PDF identyczny z KSeF, z kodem QR do weryfikacji." },
  { icon: Shield, title: "Bezpieczeństwo", description: "Szyfrowanie danych, izolacja firm i pełna kontrola dostępu z rolami." },
  { icon: BarChart3, title: "Analityka", description: "Dashboard z filtrami, statystykami i podziałem na kosztowe/przychodowe." },
  { icon: Mail, title: "Wysyłka", description: "Automatyczna wysyłka PDF na email lub webhook jednym kliknięciem." },
];

const modules = [
  {
    icon: Brain, gradient: "from-violet-500 to-fuchsia-500", bgGlow: "bg-violet-500/20",
    title: "Asystent AI", description: "Inteligentny asystent wspiera codzienną pracę księgową — rozpoznaje dokumenty, kategoryzuje transakcje i analizuje koszty.",
    items: ["Rozpoznawanie dokumentów", "Kategoryzowanie transakcji", "OCR faktur i paragonów", "Analiza kosztów"],
  },
  {
    icon: Calculator, gradient: "from-emerald-400 to-cyan-500", bgGlow: "bg-emerald-500/20",
    title: "Rozliczenia", description: "Automatyczne generowanie deklaracji podatkowych i plików JPK zgodnych z wymogami urzędów.",
    items: ["Rozliczenia podatkowe", "Deklaracje PIT", "Generowanie JPK-V7M", "Sync z systemem"],
  },
  {
    icon: Users, gradient: "from-blue-500 to-indigo-500", bgGlow: "bg-blue-500/20",
    title: "CRM", description: "Zarządzanie relacjami z klientami, monitorowanie płatności i automatyczne alerty.",
    items: ["Monitoring transakcji", "Dopasowywanie płatności", "Alerty o transakcjach", "Historia per klient"],
  },
  {
    icon: Receipt, gradient: "from-orange-400 to-rose-500", bgGlow: "bg-orange-500/20",
    title: "Wydatki", description: "Rejestruj, kategoryzuj i analizuj wydatki firmowe z pełną kontrolą nad kosztami.",
    items: ["Skanowanie dokumentów", "Auto-kategoryzowanie", "Raporty księgowe", "Analiza w czasie"],
  },
];

const steps = [
  { num: "01", title: "Załóż konto", desc: "Rejestracja zajmuje 30 sekund. Bez karty kredytowej.", icon: Star },
  { num: "02", title: "Dodaj firmę", desc: "Podaj NIP i token KSeF — reszta automatycznie.", icon: Globe },
  { num: "03", title: "Synchronizuj", desc: "Faktury pobierają się z KSeF jednym kliknięciem.", icon: RefreshCw },
  { num: "04", title: "Zarządzaj", desc: "Przeglądaj, analizuj i wysyłaj — wszystko w jednym.", icon: TrendingUp },
];

const blogPosts = [
  {
    date: "15 kwi 2026",
    category: "KSeF",
    title: "Obowiązkowy KSeF od 2026 — co musisz wiedzieć?",
    excerpt: "Ministerstwo Finansów potwierdziło termin wdrożenia obowiązkowego KSeF. Sprawdź jak przygotować swoją firmę na zmiany.",
    gradient: "from-violet-600 to-fuchsia-600",
  },
  {
    date: "12 kwi 2026",
    category: "AI",
    title: "Jak AI zmienia pracę księgowych w 2026 roku",
    excerpt: "Automatyczne kategoryzowanie, OCR faktur i inteligentne sugestie — poznaj narzędzia AI dla księgowości.",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    date: "8 kwi 2026",
    category: "Poradnik",
    title: "10 błędów w rozliczeniach VAT, których łatwo uniknąć",
    excerpt: "Najczęstsze pułapki przy generowaniu JPK-V7M i jak nasz system pomaga je wyeliminować automatycznie.",
    gradient: "from-orange-500 to-rose-500",
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-foreground overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-muted-foreground/10 backdrop-blur-2xl bg-foreground/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-background tracking-tight">KSeF Archiwum</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-background/50">
            <a href="#modules" className="hover:text-background transition-colors">Moduły</a>
            <a href="#features" className="hover:text-background transition-colors">Funkcje</a>
            <a href="#blog" className="hover:text-background transition-colors">Blog</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-sm text-background/70 hover:text-background hover:bg-muted-foreground/10">
                Zaloguj się
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="text-sm gap-1.5 bg-gradient-to-r from-primary to-fuchsia-500 border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow">
                Rozpocznij
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Animated gradient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] rounded-full bg-gradient-to-br from-primary/20 via-fuchsia-500/10 to-cyan-500/10 blur-[150px] animate-pulse-soft" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-gradient-to-tl from-cyan-500/15 to-transparent blur-[120px]" />
          <div className="absolute top-1/3 left-0 w-[400px] h-[400px] rounded-full bg-gradient-to-r from-fuchsia-600/10 to-transparent blur-[100px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8 backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>Nowy moduł: Asystent Księgowy AI</span>
            <ChevronRight className="h-3.5 w-3.5 text-primary/60" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold text-background leading-[1.08] tracking-tight"
          >
            Twoja księgowość.
            <br />
            <span className="bg-gradient-to-r from-primary via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Inteligentna.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 text-lg md:text-xl text-background/50 max-w-2xl mx-auto leading-relaxed"
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
              <Button size="lg" className="text-base px-8 h-13 bg-gradient-to-r from-primary to-fuchsia-500 border-0 shadow-xl shadow-primary/30 gap-2 hover:shadow-primary/50 transition-all">
                Załóż darmowe konto
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#modules">
              <Button size="lg" variant="outline" className="text-base px-8 h-13 border-background/20 text-background/80 hover:bg-background/10 hover:text-background backdrop-blur-sm">
                Poznaj moduły
              </Button>
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-16 flex items-center justify-center gap-8 text-sm text-background/40"
          >
            {[
              { icon: Shield, text: "Szyfrowanie end-to-end" },
              { icon: Lock, text: "Zgodne z RODO" },
              { icon: Zap, text: "Darmowy start" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary/50" />
                <span>{text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-6">
          {[
            { value: "KSeF v2", label: "Oficjalne API", gradient: "from-violet-500/20 to-fuchsia-500/20" },
            { value: "FA(3)", label: "Najnowszy schemat", gradient: "from-cyan-500/20 to-blue-500/20" },
            { value: "24/7", label: "Asystent AI", gradient: "from-emerald-500/20 to-cyan-500/20" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className={`text-center py-6 rounded-2xl border border-background/5 bg-gradient-to-br ${stat.gradient} backdrop-blur-sm`}
            >
              <div className="text-2xl font-bold text-background">{stat.value}</div>
              <div className="text-sm text-background/40 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="max-w-7xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-widest">Platforma</span>
          <h2 className="text-3xl md:text-4xl font-bold text-background tracking-tight mt-3">
            Cztery moduły, jedna platforma
          </h2>
          <p className="text-background/40 mt-4 max-w-xl mx-auto text-lg">
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
              className="relative group rounded-2xl border border-background/5 bg-background/[0.03] backdrop-blur-sm p-8 hover:border-primary/30 transition-all duration-500 hover:bg-background/[0.06] overflow-hidden"
            >
              <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full ${module.bgGlow} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

              <div className="relative">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${module.gradient} mb-5 shadow-lg`}>
                  <module.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-background mb-2">{module.title}</h3>
                <p className="text-sm text-background/40 mb-6 leading-relaxed">{module.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  {module.items.map((item) => (
                    <div key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary/70 shrink-0" />
                      <span className="text-sm text-background/70">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-widest">Funkcje</span>
          <h2 className="text-3xl md:text-4xl font-bold text-background tracking-tight mt-3">
            Obsługa KSeF i faktur
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="group rounded-2xl border border-background/5 bg-background/[0.03] backdrop-blur-sm p-6 hover:border-primary/20 transition-all duration-500 hover:bg-background/[0.06]"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-fuchsia-500/20 mb-4 group-hover:from-primary/30 group-hover:to-fuchsia-500/30 transition-colors">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-background mb-2">{feature.title}</h3>
              <p className="text-sm text-background/40 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Blog / Aktualności */}
      <section id="blog" className="max-w-7xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="flex items-end justify-between mb-16">
          <div>
            <span className="text-sm font-medium text-primary uppercase tracking-widest">Blog</span>
            <h2 className="text-3xl md:text-4xl font-bold text-background tracking-tight mt-3">
              Aktualności i poradniki
            </h2>
            <p className="text-background/40 mt-3 max-w-lg text-lg">
              Bądź na bieżąco z przepisami, nowościami KSeF i praktycznymi wskazówkami.
            </p>
          </div>
          <Button variant="ghost" className="hidden md:inline-flex text-background/50 hover:text-background hover:bg-background/10 gap-1.5">
            Wszystkie wpisy
            <ArrowRight className="h-4 w-4" />
          </Button>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {blogPosts.map((post, i) => (
            <motion.article
              key={post.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="group rounded-2xl border border-background/5 bg-background/[0.03] backdrop-blur-sm overflow-hidden hover:border-primary/20 transition-all duration-500 hover:bg-background/[0.06] cursor-pointer"
            >
              {/* Decorative top bar */}
              <div className={`h-1 bg-gradient-to-r ${post.gradient}`} />
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">{post.category}</span>
                  <span className="text-xs text-background/30 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {post.date}
                  </span>
                </div>
                <h3 className="font-semibold text-background mb-2 group-hover:text-primary transition-colors leading-snug">
                  {post.title}
                </h3>
                <p className="text-sm text-background/40 leading-relaxed">{post.excerpt}</p>
                <div className="mt-4 flex items-center gap-1.5 text-sm text-primary/70 group-hover:text-primary transition-colors">
                  Czytaj więcej
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0} className="text-center mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-widest">Jak zacząć</span>
          <h2 className="text-3xl md:text-4xl font-bold text-background tracking-tight mt-3">
            Zacznij w 4 krokach
          </h2>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="text-center group"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-fuchsia-500/20 flex items-center justify-center mb-4 group-hover:from-primary/30 group-hover:to-fuchsia-500/30 transition-colors">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-xs font-bold text-primary/40 mb-2 tracking-widest">{step.num}</div>
              <h3 className="font-semibold text-background mb-2">{step.title}</h3>
              <p className="text-sm text-background/40 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="relative rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-fuchsia-500 to-cyan-500" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />

          <div className="relative px-10 py-20 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4 tracking-tight">
              Gotowy na prostszą księgowość?
            </h2>
            <p className="text-primary-foreground/70 mb-8 max-w-lg mx-auto text-lg">
              Dołącz do użytkowników, którzy oszczędzają godziny dzięki automatyzacji.
              Rejestracja zajmuje 30 sekund.
            </p>
            <Link to="/login">
              <Button size="lg" className="text-base px-8 h-13 bg-foreground text-background hover:bg-foreground/90 gap-2 shadow-2xl">
                Załóż darmowe konto
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-background/5 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm text-background/30">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/20 to-fuchsia-500/20 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-primary" />
            </div>
            <span>KSeF Archiwum — platforma księgowa z AI</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-background/20">
            <a href="#" className="hover:text-background/50 transition-colors">Polityka prywatności</a>
            <a href="#" className="hover:text-background/50 transition-colors">Regulamin</a>
            <span>© {new Date().getFullYear()} KSeF Archiwum</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
