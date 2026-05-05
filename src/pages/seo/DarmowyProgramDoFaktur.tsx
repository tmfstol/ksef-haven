import SeoLandingTemplate from "@/components/seo/SeoLandingTemplate";

export default function DarmowyProgramDoFaktur() {
  return (
    <SeoLandingTemplate
      path="/darmowy-program-do-faktur"
      title="Darmowy program do faktur online — Facturo | Wystaw fakturę za darmo"
      description="Wystawiaj faktury online za darmo przez 14 dni. Facturo to prosty program do faktur z integracją KSeF, PDF, wysyłką email i CRM. Bez karty kredytowej."
      keywords="darmowy program do faktur, faktury online, program do faktur online, faktura online, darmowe faktury, prosty program do faktur, faktury VAT online"
      h1="Darmowy program do faktur online"
      lead="Wystaw pierwszą fakturę w 30 sekund. Facturo daje Ci pełnowartościowy program do faktur online z KSeF, PDF, wysyłką email i prostym dashboardem — bez karty kredytowej."
      ctaLabel="Wystaw fakturę za darmo"
      bullets={[
        "Wystawianie faktur VAT w kilka sekund",
        "Automatyczne generowanie PDF i wysyłka emailem",
        "Integracja z KSeF (Krajowy System e-Faktur)",
        "Faktury, faktury proforma, zaliczkowe, korygujące",
        "Baza kontrahentów i automatyczne uzupełnianie z GUS",
        "Bez instalacji — działa w przeglądarce",
      ]}
      sections={[
        {
          heading: "Dlaczego Facturo?",
          body: (
            <p>
              Większość darmowych programów do faktur online ma ukryte limity — np. 3 faktury
              miesięcznie, brak KSeF, brak wysyłki email. Facturo daje Ci wszystko od razu.
              Po okresie próbnym pełen dostęp kosztuje 15 zł / mies., bez limitu faktur i firm.
            </p>
          ),
        },
        {
          heading: "Faktury online dla każdej branży",
          body: (
            <ul>
              <li>JDG, spółki z o.o., działalność nierejestrowana</li>
              <li>Branża budowlana — z modułem kosztorysowym i kartami pracy</li>
              <li>Usługi i handel — z prostym CRM</li>
              <li>Biura rachunkowe — z dostępem dla wielu firm</li>
            </ul>
          ),
        },
        {
          heading: "Jak wystawić fakturę online w Facturo?",
          body: (
            <ol>
              <li>Załóż darmowe konto (30 sekund, bez karty)</li>
              <li>Dodaj swoją firmę (NIP — reszta z GUS automatycznie)</li>
              <li>Kliknij „Nowa faktura", wybierz kontrahenta i pozycje</li>
              <li>Pobierz PDF lub wyślij faktura emailem jednym kliknięciem</li>
              <li>Opcjonalnie: wyślij do KSeF</li>
            </ol>
          ),
        },
      ]}
      faq={[
        { q: "Czy program jest naprawdę darmowy?", a: "Tak, masz 14-dniowy okres próbny z pełnym dostępem. Po nim 15 zł / mies. za nielimitowane faktury i wszystkie moduły." },
        { q: "Czy potrzebuję instalować coś na komputerze?", a: "Nie. Facturo działa w przeglądarce — na Windowsie, Macu, Linuksie i smartfonie." },
        { q: "Czy mogę wystawiać faktury bez VAT?", a: "Tak, Facturo wspiera fakturowanie zwolnione z VAT, faktury bez VAT (np. dla działalności nierejestrowanej) oraz odwrotne obciążenie." },
        { q: "Czy moje dane są bezpieczne?", a: "Tak. Każda firma ma izolowane dane (RLS), szyfrowanie SSL, kopie zapasowe, zgodność z RODO." },
        { q: "Czy mogę pobrać fakturę jako PDF?", a: "Tak, każda faktura jest dostępna jako PDF zgodny z KSeF z kodem QR." },
      ]}
      internalLinks={[
        { to: "/program-do-faktur-ksef", label: "Program do faktur KSeF" },
        { to: "/kosztorys-budowlany-online", label: "Kosztorysowanie budowlane" },
        { to: "/karty-pracy-online", label: "Karty pracy online" },
        { to: "/pricing", label: "Cennik" },
        { to: "/blog", label: "Blog" },
      ]}
    />
  );
}
