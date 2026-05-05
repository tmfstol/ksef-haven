import SeoLandingTemplate from "@/components/seo/SeoLandingTemplate";

export default function KosztorysBudowlanyOnline() {
  return (
    <SeoLandingTemplate
      path="/kosztorys-budowlany-online"
      title="Kosztorys budowlany online — Facturo | Kosztorysowanie z AI"
      description="Twórz kosztorysy budowlane online z marżami, etapami i własnym katalogiem cen. Import przedmiarów, branże, oferty dla klienta. Wypróbuj za darmo."
      keywords="kosztorys budowlany online, kosztorysowanie budowlane, program do kosztorysów, kosztorys online, kosztorys inwestorski, kosztorys ofertowy, Norma Pro alternatywa"
      h1="Kosztorys budowlany online — szybciej niż w Norma Pro"
      lead="Twórz kosztorysy budowlane w przeglądarce. Importuj przedmiary, ustaw marże osobno na materiał i robociznę, podziel projekt na etapy i branże — wszystko bez instalowania ciężkich programów."
      ctaLabel="Stwórz pierwszy kosztorys"
      bullets={[
        "Import przedmiarów (PDF, Excel) z dopasowaniem AI",
        "Marże osobne dla materiałów i robocizny",
        "Etapowanie projektu (np. fundamenty, stan surowy, wykończenie)",
        "Branże: budowlana, instalacyjna, elektryczna, meblarska",
        "Własny katalog cen materiałów i robocizny",
        "Generowanie oferty PDF dla klienta + kosztorys wewnętrzny",
      ]}
      sections={[
        {
          heading: "Kosztorysowanie online — nowoczesne podejście",
          body: (
            <p>
              Tradycyjne kosztorysowanie w Norma Pro czy WinBud wymaga instalacji,
              licencji per stanowisko i godzin szkolenia. Facturo daje Ci kosztorys
              budowlany online w przeglądarce — z dostępem z biura, telefonu i z budowy.
            </p>
          ),
        },
        {
          heading: "Import przedmiaru z AI",
          body: (
            <p>
              Wgraj przedmiar z projektu (PDF lub Excel). Asystent AI rozpozna pozycje,
              dopasuje je do Twojego katalogu cen i automatycznie wyceni. Resztę poprawiasz
              ręcznie w kilka minut.
            </p>
          ),
        },
        {
          heading: "Oferta dla klienta vs kosztorys wewnętrzny",
          body: (
            <>
              <p>
                Facturo prowadzi <strong>dwa równoległe widoki</strong>:
              </p>
              <ul>
                <li><strong>Kosztorys wewnętrzny</strong> — Twoje koszty zakupu i robocizny, kontrola marży</li>
                <li><strong>Oferta dla klienta</strong> — pozycje z marżą, gotowy PDF do wysłania</li>
              </ul>
              <p>Dzięki temu nigdy nie pokazujesz klientowi swoich zakupowych cen.</p>
            </>
          ),
        },
        {
          heading: "Pełne zarządzanie projektem budowlanym",
          body: (
            <p>
              Po zatwierdzeniu kosztorysu Facturo pozwala śledzić rentowność —
              przypisywać faktury kosztowe do projektu, prowadzić karty pracy
              pracowników i porównywać plan z wykonaniem.
            </p>
          ),
        },
      ]}
      faq={[
        { q: "Czy mogę zaimportować przedmiar w PDF?", a: "Tak. Asystent AI odczytuje pozycje z PDF i Excel, dopasowuje je do Twojego katalogu i wycenia automatycznie." },
        { q: "Czy mogę mieć osobne marże na materiał i robociznę?", a: "Tak — to standardowa funkcja w Facturo. Możesz też ustawić różne marże per branża i per etap." },
        { q: "Czy kosztorys można podzielić na etapy?", a: "Tak. Etapy (np. fundamenty, stan surowy, wykończenie) pozwalają fakturować klienta częściowo i kontrolować postęp." },
        { q: "Czy mam własny katalog cen?", a: "Tak. Każda firma buduje własny katalog cen materiałów i robocizny, dostępny we wszystkich kosztorysach." },
        { q: "Czy mogę wystawić fakturę zaliczkową z kosztorysu?", a: "Tak. Facturo łączy kosztorys → fakturę zaliczkową/końcową → KSeF jednym workflow." },
      ]}
      internalLinks={[
        { to: "/karty-pracy-online", label: "Karty pracy pracowników" },
        { to: "/program-do-faktur-ksef", label: "Faktury KSeF" },
        { to: "/darmowy-program-do-faktur", label: "Darmowy program do faktur" },
        { to: "/blog", label: "Blog o kosztorysowaniu" },
        { to: "/pricing", label: "Cennik" },
      ]}
    />
  );
}
