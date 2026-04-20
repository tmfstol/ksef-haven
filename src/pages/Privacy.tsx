import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LEGAL_OPERATOR, LEGAL_SERVICE, LEGAL_LAST_UPDATED, LEGAL_VERSION } from "@/lib/legal-config";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Powrót
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Polityka prywatności i cookies</h1>
          <p className="text-sm text-muted-foreground">
            Wersja {LEGAL_VERSION} · obowiązuje od {LEGAL_LAST_UPDATED}
          </p>

          <h2>1. Administrator danych</h2>
          <p>
            Administratorem danych osobowych Użytkowników aplikacji {LEGAL_SERVICE.productName} jest{" "}
            {LEGAL_OPERATOR.legalName}, NIP {LEGAL_OPERATOR.nip}, adres: {LEGAL_OPERATOR.address}.
            Kontakt w sprawach danych: <a href={`mailto:${LEGAL_OPERATOR.email}`}>{LEGAL_OPERATOR.email}</a>.
          </p>

          <h2>2. Zakres przetwarzanych danych</h2>
          <ul>
            <li>Dane konta: adres e-mail, hasło (w postaci zaszyfrowanej), nazwa wyświetlana.</li>
            <li>Dane firmy Użytkownika: nazwa, NIP, adres, dane bankowe, dane do faktur.</li>
            <li>Dane kontrahentów wprowadzane przez Użytkownika do Aplikacji.</li>
            <li>Dane faktur, wydatków, projektów.</li>
            <li>Tokeny autoryzacyjne KSeF i Google Workspace (zaszyfrowane).</li>
            <li>Dane techniczne: adres IP, typ przeglądarki, logi aktywności, czas korzystania.</li>
            <li>Dane płatności: obsługiwane przez Stripe — Operator nie przechowuje danych kart.</li>
          </ul>

          <h2>3. Cele i podstawy prawne</h2>
          <table>
            <thead>
              <tr><th>Cel</th><th>Podstawa prawna (RODO)</th></tr>
            </thead>
            <tbody>
              <tr><td>Świadczenie usługi (prowadzenie konta, funkcje aplikacji)</td><td>art. 6 ust. 1 lit. b — wykonanie umowy</td></tr>
              <tr><td>Rozliczenia, faktury, księgowość</td><td>art. 6 ust. 1 lit. c — obowiązek prawny</td></tr>
              <tr><td>Bezpieczeństwo, wykrywanie nadużyć</td><td>art. 6 ust. 1 lit. f — uzasadniony interes</td></tr>
              <tr><td>Marketing własnych usług</td><td>art. 6 ust. 1 lit. f — uzasadniony interes; e-mail marketing — zgoda</td></tr>
              <tr><td>Obsługa reklamacji i roszczeń</td><td>art. 6 ust. 1 lit. b i f</td></tr>
            </tbody>
          </table>

          <h2>4. Okres przechowywania</h2>
          <ul>
            <li>Dane konta — przez okres korzystania z Aplikacji oraz 12 miesięcy po jego zamknięciu.</li>
            <li>Dane faktur i rozliczeń — 5 lat od końca roku podatkowego (obowiązek podatkowy).</li>
            <li>Dane do dochodzenia roszczeń — do upływu okresu przedawnienia.</li>
            <li>Dane marketingowe — do wycofania zgody lub wniesienia sprzeciwu.</li>
          </ul>

          <h2>5. Odbiorcy danych</h2>
          <ul>
            <li>Dostawcy infrastruktury chmurowej (hosting, baza danych) — w ramach umów powierzenia.</li>
            <li>Operator płatności Stripe — w zakresie realizacji płatności.</li>
            <li>Google (przy korzystaniu z integracji Workspace) — wyłącznie w zakresie zleconym przez Użytkownika.</li>
            <li>Krajowy System e-Faktur (Ministerstwo Finansów) — przy operacjach KSeF.</li>
            <li>Dostawcy usług AI (OpenAI, Google AI, ElevenLabs) — w zakresie funkcji asystenta.</li>
            <li>Organy publiczne — wyłącznie na podstawie obowiązujących przepisów.</li>
          </ul>

          <h2>6. Przekazywanie poza EOG</h2>
          <p>
            Część dostawców (np. Stripe, OpenAI) może przetwarzać dane poza Europejskim Obszarem
            Gospodarczym. W takich przypadkach stosowane są standardowe klauzule umowne UE
            zatwierdzone przez Komisję Europejską oraz dodatkowe środki zabezpieczające.
          </p>

          <h2>7. Prawa Użytkownika</h2>
          <p>Użytkownikowi przysługują następujące prawa wynikające z RODO:</p>
          <ul>
            <li>dostępu do danych i otrzymania ich kopii,</li>
            <li>sprostowania i uzupełnienia,</li>
            <li>usunięcia („prawo do bycia zapomnianym"),</li>
            <li>ograniczenia przetwarzania,</li>
            <li>przenoszenia danych,</li>
            <li>sprzeciwu wobec przetwarzania w celach marketingowych lub opartych na uzasadnionym interesie,</li>
            <li>cofnięcia zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed cofnięciem),</li>
            <li>wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (uodo.gov.pl).</li>
          </ul>

          <h2>8. Bezpieczeństwo</h2>
          <p>
            Operator stosuje środki techniczne i organizacyjne zapewniające bezpieczeństwo danych:
            szyfrowanie transmisji (HTTPS/TLS), szyfrowanie wrażliwych pól (np. tokenów KSeF),
            izolację danych między kontami użytkowników (Row Level Security), kontrolę dostępu i
            regularne kopie zapasowe.
          </p>

          <h2>9. Pliki cookies i podobne technologie</h2>
          <p>Aplikacja wykorzystuje pliki cookies oraz mechanizmy lokalnego przechowywania (localStorage) w celach:</p>
          <ul>
            <li>
              <strong>Niezbędne</strong> — utrzymanie sesji logowania, bezpieczeństwo, zapamiętanie
              akceptacji regulaminu. Nie wymagają zgody.
            </li>
            <li>
              <strong>Funkcjonalne</strong> — zapamiętanie ustawień interfejsu (np. aktywna firma,
              preferencje widoku).
            </li>
            <li>
              <strong>Analityczne</strong> — anonimowe statystyki ruchu (jeżeli włączone).
            </li>
          </ul>
          <p>
            Użytkownik może w każdej chwili zmienić ustawienia cookies w swojej przeglądarce.
            Wyłączenie cookies niezbędnych może uniemożliwić korzystanie z Aplikacji.
          </p>

          <h2>10. Zautomatyzowane podejmowanie decyzji</h2>
          <p>
            Aplikacja korzysta z modeli AI (m.in. do rozpoznawania treści faktur, asystenta głosowego).
            Nie podejmuje jednak decyzji wywołujących skutki prawne wobec Użytkownika w sposób w pełni
            zautomatyzowany — wszystkie istotne operacje (księgowanie, wysyłka faktur do KSeF) wymagają
            potwierdzenia Użytkownika.
          </p>

          <h2>11. Zmiany polityki</h2>
          <p>
            Polityka może być aktualizowana. Aktualna wersja jest zawsze dostępna w Aplikacji.
            O istotnych zmianach Użytkownicy zostaną poinformowani e-mailem oraz w Aplikacji.
          </p>

          <p className="mt-8 text-sm text-muted-foreground">
            Zobacz także: <Link to="/terms" className="underline">Regulamin</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
