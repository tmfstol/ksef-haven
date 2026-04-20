// Konfiguracja danych operatora aplikacji.
// UZUPEŁNIJ TE DANE — są podstawą prawną regulaminu i polityki prywatności.
// Po każdej istotnej zmianie zwiększ LEGAL_VERSION (np. "1.1") — wymusi to ponowną akceptację u wszystkich użytkowników.

export const LEGAL_VERSION = "1.0";

export const LEGAL_OPERATOR = {
  // Dane operatora (JDG)
  legalName: "[Imię i nazwisko / nazwa działalności]",
  tradeName: "e-KSEF.AI",
  nip: "[NIP]",
  regon: "[REGON, jeżeli posiadasz]",
  address: "[ulica i nr, kod pocztowy, miejscowość]",
  email: "kontakt@e-ksefai.pl",
  // Adres do reklamacji może być inny niż siedziba (np. punkt korespondencyjny)
  contactAddress: "[adres do korespondencji]",
} as const;

export const LEGAL_SERVICE = {
  productName: "e-KSEF.AI",
  url: "https://e-ksefai.lovable.app",
  description:
    "Aplikacja webowa wspierająca obsługę faktur (w tym integrację z KSeF), zarządzanie kontrahentami, projektami, wydatkami oraz pracę z Google Workspace przez asystenta głosowego.",
} as const;

export const LEGAL_LAST_UPDATED = "2026-04-20";
