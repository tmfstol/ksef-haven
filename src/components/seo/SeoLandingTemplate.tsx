import { Link } from "react-router-dom";
import PublicNav from "@/components/PublicNav";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { ReactNode } from "react";

export interface SeoLandingProps {
  path: string;
  title: string;
  description: string;
  keywords: string;
  h1: string;
  lead: string;
  ctaLabel?: string;
  sections: { heading: string; body: ReactNode }[];
  faq: { q: string; a: string }[];
  bullets: string[];
  internalLinks?: { to: string; label: string }[];
}

export default function SeoLandingTemplate(p: SeoLandingProps) {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: p.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Strona główna", item: "https://facturo.info/" },
      { "@type": "ListItem", position: 2, name: p.h1, item: `https://facturo.info${p.path}` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={p.title}
        description={p.description}
        keywords={p.keywords}
        path={p.path}
        jsonLd={[faqLd, breadcrumbLd]}
      />
      <PublicNav variant="light" />
      <div className="h-16" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
            <Sparkles className="h-3 w-3" />
            Facturo
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mt-4 leading-tight">
            {p.h1}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl leading-relaxed">
            {p.lead}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/login">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-fuchsia-500 border-0">
                {p.ctaLabel ?? "Załóż darmowe konto"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline">Zobacz cennik</Button>
            </Link>
          </div>
        </motion.div>

        {/* Bullets */}
        <ul className="mt-10 grid sm:grid-cols-2 gap-3">
          {p.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/80">
              <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Sections */}
        <div className="mt-14 space-y-10">
          {p.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">{s.heading}</h2>
              <div className="prose prose-sm sm:prose-base max-w-none text-foreground/70 leading-relaxed">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6">Najczęściej zadawane pytania</h2>
          <div className="space-y-4">
            {p.faq.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border bg-card p-4 sm:p-5">
                <summary className="cursor-pointer font-medium text-foreground flex items-center justify-between">
                  {f.q}
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Internal links */}
        {p.internalLinks && p.internalLinks.length > 0 && (
          <section className="mt-16 pt-10 border-t border-border">
            <h2 className="text-lg font-semibold mb-4">Sprawdź również</h2>
            <div className="flex flex-wrap gap-2">
              {p.internalLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="text-sm px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-16 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-fuchsia-500/5 p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Zacznij używać Facturo dziś</h2>
          <p className="mt-3 text-muted-foreground">Bez karty kredytowej. Pełen dostęp w 30 sekund.</p>
          <Link to="/login" className="inline-block mt-6">
            <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-fuchsia-500 border-0">
              Załóż konto <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </section>
      </main>
    </div>
  );
}
