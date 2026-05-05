import SeoLandingTemplate from "@/components/seo/SeoLandingTemplate";

export default function ProgramDoFakturKsef() {
  return (
    <SeoLandingTemplate
      path="/program-do-faktur-ksef"
      title="Program do faktur KSeF 2026 — Facturo | Wystawiaj i synchronizuj"
      description="Facturo to nowoczesny program do faktur KSeF zgodny ze schematem FA(3). Automatyczna synchronizacja z Krajowym Systemem e-Faktur, PDF z QR, asystent AI. Załóż konto."
      keywords="program do faktur KSeF, KSeF, faktury KSeF, FA(3), Krajowy System e-Faktur, e-faktury, program do KSeF, faktura ustrukturyzowana"
      h1="Program do faktur KSeF zgodny z FA(3)"
      lead="Facturo automatycznie pobiera faktury z Krajowego Systemu e-Faktur, generuje PDF-y z kodem QR i wystawia faktury w schemacie FA(3) — wszystko w jednym panelu, bez konieczności znajomości XML."
      bullets={[
        "Pełna integracja z KSeF (środowisko produkcyjne)",
        "Automatyczna synchronizacja faktur kosztowych i przychodowych",
        "Wystawianie faktur FA(3) z generowaniem XML",
        "Oficjalny PDF KSeF z kodem QR do weryfikacji",
        "Faktury zaliczkowe (ZAL) i korygujące (KOR)",
        "Wsparcie dla tokenów MCU i kluczy RSA-OAEP",
      ]}
      sections={[
        {
          heading: "Czym jest KSeF i dlaczego potrzebujesz programu?",
          body: (
            <>
              <p>
                Krajowy System e-Faktur (KSeF) to centralna platforma Ministerstwa Finansów,
                w której od 2026 roku przedsiębiorcy mają obowiązek wystawiać i odbierać faktury
                ustrukturyzowane w formacie XML zgodnym ze schematem FA(3).
              </p>
              <p>
                Bez dedykowanego programu wystawienie faktury KSeF wymaga ręcznego budowania
                pliku XML i autoryzacji tokenem RSA — to praca dla programisty, nie księgowej.
                Facturo robi to za Ciebie w tle.
              </p>
            </>
          ),
        },
        {
          heading: "Jak działa Facturo z KSeF?",
          body: (
            <>
              <p>
                Po podaniu NIP-u i wgraniu tokena KSeF aplikacja automatycznie pobiera ostatnie
                3 miesiące faktur, a następnie odświeża je codziennie. Wystawiona faktura
                trafia do KSeF jednym kliknięciem — generujemy XML zgodny z FA(3),
                podpisujemy go i wysyłamy przez API v2.
              </p>
              <p>
                Każda faktura ma generowany oficjalny PDF identyczny z tym, który zwraca KSeF —
                z kodem QR pozwalającym na weryfikację dokumentu.
              </p>
            </>
          ),
        },
        {
          heading: "Co zyskujesz dzięki Facturo zamiast ręcznej obsługi KSeF",
          body: (
            <ul>
              <li>Brak ryzyka błędu w schemacie XML — walidacja po stronie aplikacji</li>
              <li>Automatyczne numerowanie faktur w dwóch seriach (sprzedaż / koszt)</li>
              <li>Wysyłka PDF do biura rachunkowego jednym kliknięciem</li>
              <li>Asystent AI rozpoznaje dokumenty i kategoryzuje koszty</li>
              <li>Wsparcie wielu firm (multi-tenant) na jednym koncie</li>
            </ul>
          ),
        },
      ]}
      faq={[
        { q: "Czy Facturo działa z produkcyjnym KSeF?", a: "Tak, korzystamy z API v2 KSeF (api.ksef.mf.gov.pl) — środowisko produkcyjne. Nie potrzebujesz osobnego konta deweloperskiego." },
        { q: "Czy mogę wystawiać faktury FA(3)?", a: "Tak, Facturo generuje XML zgodny ze schematem FA(3) Ministerstwa Finansów oraz oficjalne PDF-y z kodem QR." },
        { q: "Czy obsługujecie faktury korygujące i zaliczkowe?", a: "Tak — wspieramy faktury FA, ZAL (zaliczkowe) oraz KOR (korygujące), wszystkie w pełnej zgodności z KSeF." },
        { q: "Ile kosztuje program?", a: "15 zł miesięcznie za pełny dostęp do wszystkich modułów (KSeF, CRM, wydatki, AI, kosztorysy, karty pracy). Bez limitu faktur." },
        { q: "Jak długo trwa konfiguracja?", a: "Około 30 sekund — wystarczy podać NIP i token KSeF z portalu Ministerstwa Finansów. Reszta dzieje się automatycznie." },
      ]}
      internalLinks={[
        { to: "/darmowy-program-do-faktur", label: "Darmowy program do faktur" },
        { to: "/kosztorys-budowlany-online", label: "Kosztorysowanie budowlane" },
        { to: "/karty-pracy-online", label: "Karty pracy online" },
        { to: "/blog", label: "Blog o KSeF" },
        { to: "/pricing", label: "Cennik" },
      ]}
    />
  );
}
