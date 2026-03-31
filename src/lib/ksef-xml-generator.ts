import type { NewInvoiceData, InvoiceLineItem } from "@/types/new-invoice";
import type { Company } from "@/types/company";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatAmount(val: number): string {
  return val.toFixed(2);
}

function vatRateTag(rate: string): string {
  if (rate === "zw") return "<P_12>zw</P_12>";
  if (rate === "np") return "<P_12>np</P_12>";
  return `<P_12>${rate}</P_12>`;
}

function paymentMethodCode(method: string): string {
  switch (method) {
    case "przelew": return "6";
    case "gotówka": return "1";
    case "karta": return "2";
    case "kompensata": return "4";
    default: return "6";
  }
}

interface VatSummary {
  rate: string;
  netTotal: number;
  vatTotal: number;
}

function buildVatSummaries(lines: InvoiceLineItem[]): VatSummary[] {
  const map = new Map<string, VatSummary>();
  for (const line of lines) {
    const existing = map.get(line.vatRate);
    if (existing) {
      existing.netTotal += line.netAmount;
      existing.vatTotal += line.vatAmount;
    } else {
      map.set(line.vatRate, { rate: line.vatRate, netTotal: line.netAmount, vatTotal: line.vatAmount });
    }
  }
  return Array.from(map.values());
}

export function generateKsefXml(invoice: NewInvoiceData, company: Company): string {
  const totalNet = invoice.lines.reduce((s, l) => s + l.netAmount, 0);
  const totalVat = invoice.lines.reduce((s, l) => s + l.vatAmount, 0);
  const totalGross = invoice.lines.reduce((s, l) => s + l.grossAmount, 0);
  const vatSummaries = buildVatSummaries(invoice.lines);

  const isKOR = invoice.type === "KOR";
  const isZAL = invoice.type === "ZAL";

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2023/06/29/12648/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>${invoice.issueDate}T00:00:00Z</DataWytworzeniaFa>
    <SystemInfo>KSeF Haven</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>${escapeXml(company.nip)}</NIP>
      <Nazwa>${escapeXml(company.name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>${escapeXml(company.country_code || "PL")}</KodKraju>
      <AdresL1>${escapeXml([company.street, company.city].filter(Boolean).join(", ") || company.name)}</AdresL1>
      <AdresL2>${escapeXml([company.postal_code, company.city].filter(Boolean).join(" ") || "")}</AdresL2>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>${escapeXml(invoice.buyer.nip)}</NIP>
      <Nazwa>${escapeXml(invoice.buyer.name)}</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>${escapeXml(invoice.buyer.countryCode)}</KodKraju>
      <AdresL1>${escapeXml([invoice.buyer.street, invoice.buyer.city].filter(Boolean).join(", "))}</AdresL1>
      <AdresL2>${escapeXml([invoice.buyer.postalCode, invoice.buyer.city].filter(Boolean).join(" "))}</AdresL2>
    </Adres>
  </Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>${invoice.issueDate}</P_1>
    <P_1M>${invoice.saleDate}</P_1M>
    <P_2>${escapeXml(invoice.invoiceNumber)}</P_2>`;

  if (isKOR && invoice.correctedInvoiceNumber) {
    xml += `
    <P_2KOR>${escapeXml(invoice.correctedInvoiceNumber)}</P_2KOR>
    <PrzyczynaKorekty>${escapeXml(invoice.correctionReason || "Korekta")}</PrzyczynaKorekty>
    <TypKorekty>1</TypKorekty>`;
  }

  if (isZAL) {
    xml += `
    <RodzajFaktury>ZAL</RodzajFaktury>`;
  } else if (isKOR) {
    xml += `
    <RodzajFaktury>KOR</RodzajFaktury>`;
  } else {
    xml += `
    <RodzajFaktury>VAT</RodzajFaktury>`;
  }

  // VAT summary lines
  for (const vs of vatSummaries) {
    if (vs.rate === "zw") {
      xml += `
    <P_13_6_1>${formatAmount(vs.netTotal)}</P_13_6_1>`;
    } else if (vs.rate === "np") {
      xml += `
    <P_13_7>${formatAmount(vs.netTotal)}</P_13_7>`;
    } else if (vs.rate === "23") {
      xml += `
    <P_13_1>${formatAmount(vs.netTotal)}</P_13_1>
    <P_14_1>${formatAmount(vs.vatTotal)}</P_14_1>`;
    } else if (vs.rate === "8") {
      xml += `
    <P_13_2>${formatAmount(vs.netTotal)}</P_13_2>
    <P_14_2>${formatAmount(vs.vatTotal)}</P_14_2>`;
    } else if (vs.rate === "5") {
      xml += `
    <P_13_3>${formatAmount(vs.netTotal)}</P_13_3>
    <P_14_3>${formatAmount(vs.vatTotal)}</P_14_3>`;
    } else if (vs.rate === "0") {
      xml += `
    <P_13_6_2>${formatAmount(vs.netTotal)}</P_13_6_2>`;
    }
  }

  xml += `
    <P_15>${formatAmount(totalGross)}</P_15>
    <Adnotacje>
      <P_16>2</P_16>
      <P_17>2</P_17>
      <P_18>2</P_18>
      <P_18A>2</P_18A>
      <Zwolnienie>
        <P_19N>1</P_19N>
      </Zwolnienie>
      <NoweSrodkiTransportu>
        <P_22N>1</P_22N>
      </NoweSrodkiTransportu>
      <P_23>2</P_23>
      <PMarzy>
        <P_PMarzyN>1</P_PMarzyN>
      </PMarzy>
    </Adnotacje>`;

  // Line items
  for (let i = 0; i < invoice.lines.length; i++) {
    const line = invoice.lines[i];
    xml += `
    <FaWiersz>
      <NrWierszaFa>${i + 1}</NrWierszaFa>
      <P_7>${escapeXml(line.name)}</P_7>
      <P_8A>${escapeXml(line.unit)}</P_8A>
      <P_8B>${line.quantity}</P_8B>
      <P_9A>${formatAmount(line.unitPrice)}</P_9A>
      <P_11>${formatAmount(line.netAmount)}</P_11>
      <P_11A>${formatAmount(line.grossAmount)}</P_11A>
      ${vatRateTag(line.vatRate)}
    </FaWiersz>`;
  }

  // Payment
  xml += `
    <Platnosc>
      <TerminPlatnosci>
        <Termin>${invoice.dueDate}</Termin>
      </TerminPlatnosci>
      <FormaPlatnosci>${paymentMethodCode(invoice.paymentMethod)}</FormaPlatnosci>`;

  if (invoice.paymentMethod === "przelew" && company.bank_account) {
    xml += `
      <RachunekBankowy>
        <NrRB>${escapeXml(company.bank_account.replace(/\s/g, ""))}</NrRB>
      </RachunekBankowy>`;
  }

  xml += `
    </Platnosc>`;

  if (invoice.notes) {
    xml += `
    <DodatkowyOpis>
      <Klucz>Uwagi</Klucz>
      <Wartosc>${escapeXml(invoice.notes)}</Wartosc>
    </DodatkowyOpis>`;
  }

  xml += `
  </Fa>
</Faktura>`;

  return xml;
}

export function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
