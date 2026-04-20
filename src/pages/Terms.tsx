import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LEGAL_OPERATOR, LEGAL_SERVICE, LEGAL_LAST_UPDATED, LEGAL_VERSION } from "@/lib/legal-config";

export default function Terms() {
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
          <h1>Regulamin korzystania z {LEGAL_SERVICE.productName}</h1>
          <p className="text-sm text-muted-foreground">
            Wersja {LEGAL_VERSION} · obowiązuje od {LEGAL_LAST_UPDATED}
          </p>

          <h2>§1. Postanowienia ogólne</h2>
          <ol>
            <li>
              Niniejszy Regulamin określa zasady korzystania z aplikacji {LEGAL_SERVICE.productName}{" "}
              dostępnej pod adresem {LEGAL_SERVICE.url} (dalej: „Aplikacja").
            </li>
            <li>
              Operatorem Aplikacji (dalej: „Operator") jest {LEGAL_OPERATOR.legalName}, NIP{" "}
              {LEGAL_OPERATOR.nip}, adres: {LEGAL_OPERATOR.address}, e-mail: {LEGAL_OPERATOR.email}.
            </li>
            <li>
              Z Aplikacji mogą korzystać zarówno przedsiębiorcy (B2B), jak i osoby fizyczne nieprowadzące
              działalności gospodarczej (Konsumenci) oraz osoby fizyczne zawierające umowę bezpośrednio
              związaną z ich działalnością gospodarczą, gdy z treści tej umowy wynika, że nie posiada ona
              dla nich charakteru zawodowego (Przedsiębiorcy na prawach konsumenta).
            </li>
            <li>
              Korzystanie z Aplikacji wymaga akceptacji niniejszego Regulaminu oraz Polityki prywatności
              i cookies.
            </li>
          </ol>

          <h2>§2. Definicje</h2>
          <ul>
            <li>
              <strong>Użytkownik</strong> — osoba fizyczna, prawna lub jednostka organizacyjna
              korzystająca z Aplikacji.
            </li>
            <li>
              <strong>Konto</strong> — indywidualny zbiór danych Użytkownika w Aplikacji,
              zabezpieczony loginem i hasłem.
            </li>
            <li>
              <strong>Usługa</strong> — funkcjonalności Aplikacji opisane w §3.
            </li>
            <li>
              <strong>KSeF</strong> — Krajowy System e-Faktur prowadzony przez Ministerstwo
              Finansów RP.
            </li>
          </ul>

          <h2>§3. Zakres usług</h2>
          <ol>
            <li>{LEGAL_SERVICE.description}</li>
            <li>
              Aplikacja udostępniana jest w modelu SaaS (oprogramowanie jako usługa) — Operator nie
              dostarcza Użytkownikowi kopii oprogramowania, lecz zapewnia dostęp przez przeglądarkę.
            </li>
            <li>
              Funkcjonalności mogą być rozwijane, modyfikowane, dodawane lub wycofywane. Istotne zmiany
              będą komunikowane Użytkownikom z wyprzedzeniem.
            </li>
          </ol>

          <h2>§4. Wymagania techniczne</h2>
          <ol>
            <li>Aktualna przeglądarka internetowa (Chrome, Safari, Firefox, Edge) z włączoną obsługą JavaScript i cookies.</li>
            <li>Stałe połączenie z Internetem.</li>
            <li>Aktywne konto e-mail.</li>
            <li>Do funkcji integracji z Google Workspace — aktywne konto Google.</li>
            <li>Do funkcji integracji z KSeF — aktywny token autoryzacyjny KSeF wystawiony przez Użytkownika.</li>
          </ol>

          <h2>§5. Rejestracja i konto</h2>
          <ol>
            <li>Założenie Konta jest dobrowolne i bezpłatne (poza opłatami abonamentowymi za korzystanie z funkcji płatnych).</li>
            <li>Użytkownik podaje dane prawdziwe, kompletne i aktualne, oraz zobowiązuje się je aktualizować.</li>
            <li>Użytkownik odpowiada za zachowanie poufności danych logowania i wszelkie działania wykonane na swoim Koncie.</li>
            <li>Operator może zablokować Konto w przypadku rażącego naruszenia Regulaminu, prób obejścia zabezpieczeń lub działań na szkodę innych użytkowników.</li>
          </ol>

          <h2>§6. Płatności i abonament</h2>
          <ol>
            <li>Aplikacja udostępniana jest w modelu abonamentowym. Aktualne ceny publikowane są w Aplikacji.</li>
            <li>Płatności realizowane są przez zewnętrznego operatora płatności (Stripe). Operator nie przechowuje danych kart płatniczych.</li>
            <li>Abonament odnawia się automatycznie do czasu rezygnacji przez Użytkownika.</li>
            <li>Rezygnacji można dokonać w panelu Konta — dostęp do funkcji płatnych zachowany jest do końca opłaconego okresu rozliczeniowego.</li>
            <li>Konsument ma prawo żądać wystawienia faktury VAT.</li>
          </ol>

          <h2>§7. Prawo odstąpienia (Konsumenci)</h2>
          <ol>
            <li>
              Konsumentowi (oraz Przedsiębiorcy na prawach konsumenta) przysługuje prawo do odstąpienia od
              umowy zawartej na odległość w terminie 14 dni od jej zawarcia, bez podania przyczyny.
            </li>
            <li>
              Oświadczenie o odstąpieniu należy przesłać na adres {LEGAL_OPERATOR.email} lub pisemnie na
              adres {LEGAL_OPERATOR.contactAddress}.
            </li>
            <li>
              Zgodnie z art. 38 ustawy o prawach konsumenta, prawo odstąpienia nie przysługuje, jeżeli
              Operator wykonał w pełni usługę za wyraźną zgodą Użytkownika, który został poinformowany,
              że po spełnieniu świadczenia utraci prawo odstąpienia. Rozpoczęcie świadczenia usługi przed
              upływem 14 dni wymaga wyraźnej zgody Użytkownika.
            </li>
          </ol>

          <h2>§8. Obowiązki Użytkownika</h2>
          <ol>
            <li>Użytkownik korzysta z Aplikacji zgodnie z prawem, dobrymi obyczajami i Regulaminem.</li>
            <li>Zakazane jest dostarczanie treści bezprawnych, w szczególności naruszających prawa osób trzecich, prawa autorskie, dane osobowe ani treści obraźliwych.</li>
            <li>Zakazane jest podejmowanie działań mogących destabilizować pracę Aplikacji (ataki, masowe zapytania, scraping bez zgody).</li>
            <li>Użytkownik odpowiada za poprawność i zgodność z prawem danych wprowadzanych do Aplikacji (faktur, danych kontrahentów, danych podatkowych).</li>
          </ol>

          <h2>§9. Integracja z KSeF i Google Workspace</h2>
          <ol>
            <li>Aplikacja umożliwia opcjonalne połączenie z KSeF oraz Google Workspace przy użyciu danych autoryzacyjnych Użytkownika.</li>
            <li>Tokeny i dane autoryzacyjne przechowywane są w zaszyfrowanej formie i wykorzystywane wyłącznie do realizacji żądanych przez Użytkownika operacji.</li>
            <li>Użytkownik może w każdej chwili odłączyć integrację w panelu Konta.</li>
            <li>Operator nie odpowiada za przerwy lub błędy po stronie KSeF, Google ani innych dostawców zewnętrznych.</li>
          </ol>

          <h2>§10. Odpowiedzialność Operatora</h2>
          <ol>
            <li>
              Operator dokłada starań, by Aplikacja działała w sposób ciągły i prawidłowy, jednak nie
              gwarantuje 100% dostępności. Dopuszczalne są przerwy techniczne i serwisowe.
            </li>
            <li>
              Aplikacja jest narzędziem wspierającym pracę księgową — <strong>nie zastępuje doradztwa
              podatkowego, prawnego ani księgowego</strong>. Wszelkie deklaracje, faktury i decyzje
              podatkowe wymagają weryfikacji przez Użytkownika lub jego doradców.
            </li>
            <li>
              Operator nie ponosi odpowiedzialności za skutki błędnych danych wprowadzonych przez
              Użytkownika ani za decyzje podatkowe podjęte na ich podstawie.
            </li>
            <li>
              W stosunkach z Przedsiębiorcami (B2B) odpowiedzialność Operatora ograniczona jest do
              wysokości opłat abonamentowych uiszczonych przez Użytkownika w okresie 12 miesięcy
              poprzedzających zdarzenie. Wyłączona jest odpowiedzialność za utracone korzyści.
            </li>
            <li>
              Powyższe ograniczenia nie dotyczą odpowiedzialności za szkody wyrządzone z winy umyślnej
              ani odpowiedzialności wobec Konsumentów w zakresie wynikającym z bezwzględnie obowiązujących
              przepisów prawa.
            </li>
          </ol>

          <h2>§11. Reklamacje</h2>
          <ol>
            <li>
              Reklamacje można składać na adres {LEGAL_OPERATOR.email} lub pisemnie na adres{" "}
              {LEGAL_OPERATOR.contactAddress}.
            </li>
            <li>Reklamacja powinna zawierać dane Użytkownika, opis problemu i oczekiwany sposób rozwiązania.</li>
            <li>Operator rozpatruje reklamacje w terminie 14 dni roboczych.</li>
            <li>
              Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji (UOKiK,
              platforma ODR: https://ec.europa.eu/consumers/odr).
            </li>
          </ol>

          <h2>§12. Dane osobowe</h2>
          <p>
            Zasady przetwarzania danych osobowych opisuje{" "}
            <Link to="/privacy" className="underline">Polityka prywatności i cookies</Link>.
          </p>

          <h2>§13. Własność intelektualna</h2>
          <ol>
            <li>Wszelkie prawa do Aplikacji, jej kodu, grafiki, logotypów, treści i baz danych przysługują Operatorowi.</li>
            <li>Użytkownik otrzymuje niewyłączną, niezbywalną licencję na korzystanie z Aplikacji w zakresie i w okresie obowiązywania umowy.</li>
            <li>Dane wprowadzone przez Użytkownika pozostają jego własnością. Operator przetwarza je wyłącznie w celu świadczenia Usługi.</li>
          </ol>

          <h2>§14. Zmiany Regulaminu</h2>
          <ol>
            <li>Operator może zmienić Regulamin z ważnych przyczyn (zmiana przepisów, rozwój funkcjonalności, względy bezpieczeństwa).</li>
            <li>O zmianach Użytkownik zostanie poinformowany e-mailem oraz w Aplikacji z co najmniej 14-dniowym wyprzedzeniem.</li>
            <li>Brak akceptacji zmian uprawnia Użytkownika do rozwiązania umowy ze skutkiem natychmiastowym.</li>
          </ol>

          <h2>§15. Postanowienia końcowe</h2>
          <ol>
            <li>W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeks cywilny, ustawę o prawach konsumenta oraz ustawę o świadczeniu usług drogą elektroniczną.</li>
            <li>Spory z Konsumentami rozstrzyga sąd właściwy zgodnie z przepisami ogólnymi. Spory z Przedsiębiorcami (B2B) rozstrzyga sąd właściwy dla siedziby Operatora.</li>
            <li>Jeśli którekolwiek postanowienie Regulaminu zostanie uznane za nieważne, pozostałe postanowienia pozostają w mocy.</li>
          </ol>
        </article>
      </div>
    </div>
  );
}
