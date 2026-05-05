// Polski standard QR do przelewu (Związek Banków Polskich)
// Format: NIP|Kraj|RachunekBankowy|Kwota(grosze)|Nazwa|Tytuł|Rezerwa1|Rezerwa2|Rezerwa3
// Działa w aplikacjach mobilnych polskich banków (Santander, mBank, ING, PKO BP, BLIK)

export interface PaymentQrData {
  nip?: string;
  iban: string; // 26-cyfrowy numer konta (PL) lub IBAN
  amount: number; // PLN
  recipientName: string;
  title: string;
}

function cleanDigits(s: string) {
  return (s || "").replace(/[^0-9]/g, "");
}

function trimField(s: string, max: number) {
  return (s || "").replace(/\|/g, " ").substring(0, max).trim();
}

export function buildPolishPaymentQr(data: PaymentQrData): string {
  const nip = cleanDigits(data.nip || "");
  let acc = cleanDigits(data.iban);
  // Strip "PL" country prefix if present (24 -> 26 digit form)
  if (acc.length === 28 && acc.startsWith("00")) acc = acc.substring(2);
  const account = acc.padStart(26, "0").substring(0, 26);
  const grosze = Math.round((data.amount || 0) * 100).toString();
  const name = trimField(data.recipientName, 20);
  const title = trimField(data.title, 32);
  return [nip, "PL", account, grosze, name, title, "", "", ""].join("|");
}
