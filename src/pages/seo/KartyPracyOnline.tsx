import SeoLandingTemplate from "@/components/seo/SeoLandingTemplate";

export default function KartyPracyOnline() {
  return (
    <SeoLandingTemplate
      path="/karty-pracy-online"
      title="Karty pracy online + harmonogram pracowników — Facturo"
      description="Cyfrowe karty pracy pracowników, harmonogram brygad i pojazdów, skanowanie odręcznych kart przez AI. Idealne dla firm budowlanych i wykonawczych."
      keywords="karty pracy online, harmonogram pracowników, karta pracy budowlana, ewidencja czasu pracy, harmonogram brygad, system kart pracy, skanowanie kart pracy"
      h1="Karty pracy online dla firm budowlanych"
      lead="Zastąp papierowe karty pracy nowoczesnym systemem online. Pracownicy raportują godziny z telefonu, brygadzista skanuje odręczne karty AI-em, a Ty widzisz wszystko w jednym harmonogramie."
      ctaLabel="Wypróbuj za darmo"
      bullets={[
        "Cyfrowe karty pracy z poziomu telefonu pracownika",
        "Skanowanie odręcznych kart pracy przez AI",
        "Harmonogram pracowników, brygad i pojazdów",
        "Przypisywanie godzin do projektów (rentowność)",
        "Weryfikacja i akceptacja kart pracy przez kierownika",
        "Eksport do PDF dla biura rachunkowego",
      ]}
      sections={[
        {
          heading: "Koniec z papierowymi kartami pracy",
          body: (
            <p>
              W większości firm budowlanych pracownicy nadal piszą karty pracy ręcznie,
              brygadzista zbiera je raz w tygodniu, a kierownik przepisuje do Excela.
              W rezultacie tracisz godziny i mieszają Ci się projekty.
              Facturo zastępuje cały ten proces jednym ekranem.
            </p>
          ),
        },
        {
          heading: "Skanowanie odręcznych kart przez AI",
          body: (
            <p>
              Jeśli Twoi pracownicy nie chcą używać aplikacji, brygadzista
              robi zdjęcie ich karty papierowej. Nasz model AI rozpoznaje pismo
              odręczne, identyfikuje pracownika, godziny i projekt — następnie
              zapisuje rekord w systemie do akceptacji.
            </p>
          ),
        },
        {
          heading: "Harmonogram pracowników i pojazdów",
          body: (
            <p>
              Wizualny timeline: kto pracuje na której budowie, jakim pojazdem
              jedzie, w jakich godzinach. Konflikty (np. dwa projekty na jednego
              człowieka) widać od razu.
            </p>
          ),
        },
        {
          heading: "Karty pracy + rentowność projektu",
          body: (
            <p>
              Każda godzina pracownika trafia do projektu razem z kosztem
              roboczogodziny. Łącząc to z fakturami kosztowymi i przychodowymi
              z KSeF, Facturo pokazuje realną marżę projektu w czasie rzeczywistym.
            </p>
          ),
        },
      ]}
      faq={[
        { q: "Czy pracownik musi mieć smartfon?", a: "Nie. Brygadzista może zeskanować papierową kartę — AI ją odczyta. Aplikacja w telefonie jest opcjonalna." },
        { q: "Jak działa skanowanie AI?", a: "Robisz zdjęcie karty pracy, system rozpoznaje pracownika, datę, godziny i projekt. Wyniki wyświetlają się do akceptacji przed zapisem." },
        { q: "Czy mogę przypisać karty pracy do konkretnego projektu?", a: "Tak. Każda karta jest powiązana z projektem, dzięki czemu widzisz koszt robocizny per budowa." },
        { q: "Czy widzę harmonogram brygad i pojazdów?", a: "Tak — wizualny timeline pokazuje przypisanie pracowników, brygad i pojazdów do projektów na każdy dzień." },
        { q: "Czy karty można eksportować?", a: "Tak, generujemy PDF zaakceptowanych kart pracy do wysłania do biura rachunkowego." },
      ]}
      internalLinks={[
        { to: "/kosztorys-budowlany-online", label: "Kosztorysowanie budowlane" },
        { to: "/program-do-faktur-ksef", label: "Faktury KSeF" },
        { to: "/darmowy-program-do-faktur", label: "Darmowy program do faktur" },
        { to: "/blog", label: "Blog o zarządzaniu firmą" },
        { to: "/pricing", label: "Cennik" },
      ]}
    />
  );
}
