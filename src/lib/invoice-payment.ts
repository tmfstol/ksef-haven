export type InvoicePaymentKind = "transfer" | "cash" | "other" | "unknown";

export interface InvoicePaymentDetails {
  iban: string;
  paymentMethodCode: string;
  paymentMethodLabel: string;
  kind: InvoicePaymentKind;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  "1": "Gotówka",
  "2": "Karta",
  "3": "Bon",
  "4": "Czek",
  "5": "Kredyt",
  "6": "Przelew",
  "7": "Płatność mobilna",
};

function getXmlText(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<\\/[^>]*${tag}[^>]*>`, "i"));
  return match?.[1]?.trim() || "";
}

export function normalizeBankAccount(value?: string | null) {
  return (value || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export function classifyPaymentMethod(value?: string | null): InvoicePaymentKind {
  const raw = (value || "").trim().toLowerCase();
  if (!raw) return "unknown";
  if (raw === "6" || raw.includes("przelew") || raw.includes("transfer")) return "transfer";
  if (raw === "1" || raw.includes("gotów") || raw.includes("gotow") || raw.includes("cash")) return "cash";
  return "other";
}

export function getPaymentMethodLabel(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "Nie określono";
  return PAYMENT_METHOD_LABELS[raw] || raw;
}

export function buildInvoicePaymentDetails(params: { iban?: string | null; paymentMethodCode?: string | null }): InvoicePaymentDetails {
  const paymentMethodCode = (params.paymentMethodCode || "").trim();
  return {
    iban: normalizeBankAccount(params.iban),
    paymentMethodCode,
    paymentMethodLabel: getPaymentMethodLabel(paymentMethodCode),
    kind: classifyPaymentMethod(paymentMethodCode),
  };
}

export function extractPaymentDetailsFromXml(xml: string): InvoicePaymentDetails {
  return buildInvoicePaymentDetails({
    iban: getXmlText(xml, "NrRB"),
    paymentMethodCode: getXmlText(xml, "FormaPlatnosci"),
  });
}

export function getPaymentQrBlockReason(details: InvoicePaymentDetails) {
  if (details.kind === "cash") {
    return "Ta faktura jest oznaczona jako gotówkowa — QR przelewu nie jest potrzebny.";
  }
  if (details.kind === "other") {
    return `Forma płatności: ${details.paymentMethodLabel}. QR przelewu pokazuję tylko dla przelewu.`;
  }
  if (!details.iban) {
    return "Brak numeru rachunku bankowego w danych faktury.";
  }
  return null;
}