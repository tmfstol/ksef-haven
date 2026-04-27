import { xml2js } from "xml-js";

// ── XML Parsing using DOMParser (kept for line-item extraction) ──

function getText(el: Element | null, tag: string): string {
  if (!el) return "";
  const found = el.getElementsByTagName(tag)[0]
    || el.getElementsByTagNameNS("*", tag)[0];
  return found?.textContent?.trim() || "";
}

function getDirectText(el: Element | null, tag: string): string {
  if (!el) return "";
  const children = el.children;
  for (let i = 0; i < children.length; i++) {
    if (children[i].localName === tag) {
      return children[i].textContent?.trim() || "";
    }
  }
  return "";
}

function getEl(el: Element | null, tag: string): Element | null {
  if (!el) return null;
  const found = el.getElementsByTagName(tag)[0]
    || el.getElementsByTagNameNS("*", tag)[0];
  return found || null;
}

function getAllEls(el: Element | null, tag: string): Element[] {
  if (!el) return [];
  const list = el.getElementsByTagName(tag);
  if (list.length > 0) return Array.from(list);
  return Array.from(el.getElementsByTagNameNS("*", tag));
}

// ── Data types ──

interface InvoiceParty {
  nip: string;
  nazwa: string;
  adres: string;
  email: string;
  telefon: string;
  eori: string;
  prefiksVat: string;
}

interface InvoiceLine {
  nr: string;
  opis: string;
  jm: string;
  ilosc: string;
  cenaNetto: string;
  wartoscNetto: string;
  stawkaVat: string;
  kwotaVat: string;
  brutto: string;
}

interface ZamowienieLine {
  nr: string;
  opis: string;
  jm: string;
  ilosc: string;
  cenaNetto: string;
  wartoscNetto: string;
  stawkaVat: string;
}

interface ZaliczkaLine {
  nrZaliczki: string;
  opis: string;
  kwota: string;
  stawkaVat: string;
}

export interface ParsedInvoice {
  ksefNumber: string;
  rodzajFaktury: string;
  kodWaluty: string;
  nrFaktury: string;
  dataWystawienia: string;
  dataSprzedazy: string;
  miejsceWystawienia: string;
  okresOd: string;
  okresDo: string;
  sprzedawca: InvoiceParty;
  nabywca: InvoiceParty;
  pozycje: InvoiceLine[];
  zamowienie: ZamowienieLine[];
  zaliczki: ZaliczkaLine[];
  sumaNettoWgStawek: { stawka: string; netto: string; vat: string }[];
  sumaNetto: string;
  sumaVat: string;
  sumaBrutto: string;
  terminPlatnosci: string;
  formaPlatnosci: string;
  opisPlatnosci: string;
  nrRachunku: string;
  nazwaBanku: string;
  doZaplaty: string;
  uwagi: { klucz: string; wartosc: string }[];
  nrWZ: string;
  nrZamowienia: string;
  stopka: string;
  krs: string;
  regon: string;
  bdo: string;
}

function parseAddr(adresEl: Element | null): string {
  if (!adresEl) return "";
  const addrL1 = getText(adresEl, "AdresL1");
  const addrL2 = getText(adresEl, "AdresL2");
  if (addrL1 || addrL2) return [addrL1, addrL2].filter(Boolean).join(", ");
  const street = getText(adresEl, "Ulica");
  const nr = getText(adresEl, "NrDomu");
  const nrLok = getText(adresEl, "NrLokalu");
  const code = getText(adresEl, "KodPocztowy");
  const city = getText(adresEl, "Miejscowosc");
  const country = getText(adresEl, "KodKraju") || "";
  const streetLine = [street, [nr, nrLok].filter(Boolean).join("/")].filter(Boolean).join(" ");
  const cityLine = [code, city].filter(Boolean).join(" ");
  return [streetLine, cityLine, country ? `${country} (POLSKA)` : ""].filter(Boolean).join(", ");
}

function parseParty(el: Element | null): InvoiceParty {
  if (!el) return { nip: "", nazwa: "", adres: "", email: "", telefon: "", eori: "", prefiksVat: "" };
  const ident = getEl(el, "DaneIdentyfikacyjne");
  const adresEl = getEl(el, "Adres");
  const kontakt = getEl(el, "DaneKontaktowe");
  return {
    nip: getText(ident, "NIP") || getText(el, "NIP") || "",
    nazwa: getText(ident, "Nazwa") || getText(ident, "PelnaNazwa") || "",
    adres: parseAddr(adresEl),
    email: getText(kontakt, "Email") || "",
    telefon: getText(kontakt, "Telefon") || "",
    eori: getText(ident, "NrEORI") || getText(el, "NrEORI") || "",
    prefiksVat: getText(ident, "PrefiksVAT") || getText(el, "PrefiksVAT") || getText(ident, "PrefVAT") || "",
  };
}

export function parseKsefXml(xml: string, ksefNumber: string): ParsedInvoice {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    console.error("XML parse error:", parseError.textContent);
  }

  const root = doc.documentElement;
  const podmiot1 = getEl(root, "Podmiot1");
  const podmiot2 = getEl(root, "Podmiot2");
  const faEl = getEl(root, "Fa");
  const platnoscEl = getEl(faEl, "Platnosc");
  const rozliczenieEl = getEl(faEl, "Rozliczenie");
  const stopkaEl = getEl(root, "Stopka");
  const rejestrEl = getEl(stopkaEl, "Rejestry");
  const warunkiEl = getEl(faEl, "WarunkiTransakcji");
  const okresEl = getEl(faEl, "OkresFa");

  const wiersze = getAllEls(faEl, "FaWiersz");
  const pozycje: InvoiceLine[] = wiersze.map((w) => {
    const net = getText(w, "P_11") || "0";
    const vatRate = getText(w, "P_12") || "0";
    const netNum = parseFloat(net) || 0;
    const vatNum = parseFloat(getText(w, "P_11Vat") || "") || netNum * (parseFloat(vatRate) / 100);
    return {
      nr: getText(w, "NrWierszaFa") || "",
      opis: getText(w, "P_7") || "-",
      jm: getText(w, "P_8A") || "",
      ilosc: getText(w, "P_8B") || "1",
      cenaNetto: (getText(w, "P_9A") || getText(w, "P_9B") || "0").trim(),
      wartoscNetto: net,
      stawkaVat: vatRate,
      kwotaVat: vatNum.toFixed(2),
      brutto: (netNum + vatNum).toFixed(2),
    };
  });

  const zamowienieEl = getEl(faEl, "Zamowienie");
  const zamowienieWiersze = getAllEls(zamowienieEl, "ZamowienieWiersz");
  const zamowienie: ZamowienieLine[] = zamowienieWiersze.map((w) => ({
    nr: getText(w, "NrWierszaZam") || "",
    opis: getText(w, "P_7Z") || "-",
    jm: getText(w, "P_8AZ") || "",
    ilosc: getText(w, "P_8BZ") || "1",
    cenaNetto: (getText(w, "P_9AZ") || getText(w, "P_9BZ") || "0").trim(),
    wartoscNetto: getText(w, "P_11NettoZ") || "0",
    stawkaVat: getText(w, "P_12Z") || "0",
  }));

  const zaliczkaEl = getEl(faEl, "Zaliczka");
  const zaliczkaWiersze = getAllEls(zaliczkaEl, "ZaliczkaWiersz");
  const zaliczki: ZaliczkaLine[] = zaliczkaWiersze.map((w) => ({
    nrZaliczki: getText(w, "NrWierszaZal") || "",
    opis: getText(w, "OpisZaliczki") || getText(w, "P_7Z") || "-",
    kwota: getText(w, "KwotaZaliczki") || "0",
    stawkaVat: getText(w, "P_12Z") || "",
  }));

  if (zamowienie.length > 0) {
    pozycje.forEach((p) => {
      if (p.opis === "-" || !p.opis) {
        const matching = zamowienie.find((z) => z.nr === p.nr);
        if (matching) p.opis = matching.opis;
      }
    });
  }

  const sumaNettoWgStawek: { stawka: string; netto: string; vat: string }[] = [];
  const p13_1 = getText(faEl, "P_13_1");
  const p14_1 = getText(faEl, "P_14_1");
  if (p13_1) sumaNettoWgStawek.push({ stawka: "23", netto: p13_1, vat: p14_1 || "0" });
  const p13_2 = getText(faEl, "P_13_2");
  const p14_2 = getText(faEl, "P_14_2");
  if (p13_2) sumaNettoWgStawek.push({ stawka: "8", netto: p13_2, vat: p14_2 || "0" });
  const p13_3 = getText(faEl, "P_13_3");
  const p14_3 = getText(faEl, "P_14_3");
  if (p13_3) sumaNettoWgStawek.push({ stawka: "5", netto: p13_3, vat: p14_3 || "0" });
  const p13_4 = getText(faEl, "P_13_4");
  const p14_4 = getText(faEl, "P_14_4");
  if (p13_4) sumaNettoWgStawek.push({ stawka: "ryczalt", netto: p13_4, vat: p14_4 || "0" });
  const p13_6_1 = getText(faEl, "P_13_6_1");
  if (p13_6_1) sumaNettoWgStawek.push({ stawka: "0", netto: p13_6_1, vat: "0" });
  const p13_7 = getText(faEl, "P_13_7");
  if (p13_7) sumaNettoWgStawek.push({ stawka: "zw", netto: p13_7, vat: "0" });
  const p13_8 = getText(faEl, "P_13_8");
  if (p13_8) sumaNettoWgStawek.push({ stawka: "oo", netto: p13_8, vat: "0" });
  const p13_9 = getText(faEl, "P_13_9");
  if (p13_9) sumaNettoWgStawek.push({ stawka: "np", netto: p13_9, vat: "0" });
  const p13_10 = getText(faEl, "P_13_10");
  if (p13_10) sumaNettoWgStawek.push({ stawka: "np-ue", netto: p13_10, vat: "0" });
  const p13_11 = getText(faEl, "P_13_11");
  if (p13_11) sumaNettoWgStawek.push({ stawka: "np-kraj", netto: p13_11, vat: "0" });

  if (sumaNettoWgStawek.length === 0) {
    const vatMap = new Map<string, { netto: number; vat: number }>();
    pozycje.forEach((p) => {
      const key = p.stawkaVat;
      const prev = vatMap.get(key) || { netto: 0, vat: 0 };
      prev.netto += parseFloat(p.wartoscNetto) || 0;
      prev.vat += parseFloat(p.kwotaVat) || 0;
      vatMap.set(key, prev);
    });
    [...vatMap.entries()].forEach(([stawka, v]) => {
      sumaNettoWgStawek.push({
        stawka,
        netto: v.netto.toFixed(2),
        vat: v.vat.toFixed(2),
      });
    });
  }

  const uwagi: { klucz: string; wartosc: string }[] = [];
  const opisEls = getAllEls(faEl, "DodatkowyOpis");
  opisEls.forEach((b) => {
    const k = getText(b, "Klucz");
    const v = getText(b, "Wartosc");
    if (k || v) uwagi.push({ klucz: k, wartosc: v });
  });

  const sumaNetto = getText(faEl, "P_13_1") || getText(faEl, "P_13_2") || "0";
  const sumaVat = getText(faEl, "P_14_1") || getText(faEl, "P_14_2") || "0";
  const sumaBrutto = getText(faEl, "P_15") || "0";
  const rachunekEl = getEl(platnoscEl, "RachunekBankowy");
  const terminEl = getEl(platnoscEl, "TerminPlatnosci");

  return {
    ksefNumber,
    rodzajFaktury: getText(faEl, "RodzajFaktury") || "VAT",
    kodWaluty: getText(faEl, "KodWaluty") || "PLN",
    nrFaktury: getText(faEl, "P_2") || getText(root, "NrFaWewnetrzny") || ksefNumber,
    dataWystawienia: getText(faEl, "P_1") || getText(root, "DataWytworzeniaFa") || "",
    dataSprzedazy: getDirectText(faEl, "P_6") || "",
    miejsceWystawienia: getText(faEl, "P_1M") || "",
    okresOd: getText(okresEl, "P_6_Od") || "",
    okresDo: getText(okresEl, "P_6_Do") || "",
    sprzedawca: parseParty(podmiot1),
    nabywca: parseParty(podmiot2),
    pozycje,
    zamowienie,
    zaliczki,
    sumaNettoWgStawek,
    sumaNetto,
    sumaVat,
    sumaBrutto,
    terminPlatnosci: getText(terminEl, "Termin") || "",
    formaPlatnosci: getText(platnoscEl, "FormaPlatnosci") || "",
    opisPlatnosci: getText(terminEl, "OpisPlatnosci") || "",
    nrRachunku: getText(rachunekEl, "NrRB") || "",
    nazwaBanku: getText(rachunekEl, "NazwaBanku") || "",
    doZaplaty: getText(rozliczenieEl, "DoZaplaty") || sumaBrutto,
    uwagi,
    nrWZ: getText(faEl, "WZ") || "",
    nrZamowienia: getText(getEl(warunkiEl, "Zamowienia"), "NrZamowienia") || "",
    stopka: getText(getEl(stopkaEl, "Informacje"), "StopkaFaktury") || "",
    krs: getText(rejestrEl, "KRS") || "",
    regon: getText(rejestrEl, "REGON") || "",
    bdo: getText(rejestrEl, "BDO") || "",
  };
}

// ── PDF Generation using official CIRFMF/ksef-pdf-generator ──

function stripPrefix(key: string): string {
  return key.includes(":") ? key.split(":")[1] : key;
}

/**
 * Generate QR code URL (KOD I) zgodnie z oficjalną specyfikacją MF KSeF 2.0.
 * Źródło: https://github.com/CIRFMF/ksef-docs/blob/main/kody-qr.md
 *
 * Format:
 *   {baseUrl}/invoice/{NIP_sprzedawcy}/{DD-MM-RRRR}/{hash_base64url}
 * gdzie hash_base64url = Base64URL( SHA-256( XML faktury ) ).
 *
 * Środowiska:
 *   PRD  -> https://qr.ksef.mf.gov.pl
 *   DEMO -> https://qr-demo.ksef.mf.gov.pl
 *   TE   -> https://qr-test.ksef.mf.gov.pl
 */
async function generateKsefQrUrl(
  xmlString: string,
  nipSprzedawcy: string,
  dataWystawienia: string,
): Promise<string> {
  // SHA-256 z XML faktury
  const data = new TextEncoder().encode(xmlString);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const hashBase64Url = btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Format daty: DD-MM-RRRR (z YYYY-MM-DD wg pola P_1)
  const cleanNip = (nipSprzedawcy || "").replace(/[^0-9]/g, "");
  let dateFormatted = dataWystawienia || "";
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateFormatted);
  if (isoMatch) {
    dateFormatted = `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  return `https://qr.ksef.mf.gov.pl/invoice/${cleanNip}/${dateFormatted}/${hashBase64Url}`;
}

async function generatePdfWithCirfmf(xmlString: string, ksefNumber: string): Promise<string> {
  // Dynamically import the CIRFMF library
  const { generateFA3, generateFA1, generateFA2 } = await import("@/lib/ksef-pdf/index.js");

  // Parse XML with xml-js (same way CIRFMF does it)
  const jsonDoc = xml2js(xmlString, {
    compact: true,
    cdataKey: "_text",
    trim: true,
    elementNameFn: stripPrefix,
    attributeNameFn: stripPrefix,
  }) as any;

  const invoice = jsonDoc.Faktura;
  const wersja = invoice?.Naglowek?.KodFormularza?._attributes?.kodSystemowy;

  // NIP sprzedawcy z Podmiot1 → DaneIdentyfikacyjne → NIP
  const nipSprzedawcy =
    invoice?.Podmiot1?.DaneIdentyfikacyjne?.NIP?._text ||
    invoice?.Podmiot1?.DaneIdentyfikacyjne?.NIP ||
    "";
  // Data wystawienia: FA → P_1 (YYYY-MM-DD)
  const dataWystawienia =
    invoice?.Fa?.P_1?._text ||
    invoice?.Fa?.P_1 ||
    "";

  const qrUrl = await generateKsefQrUrl(
    xmlString,
    String(nipSprzedawcy),
    String(dataWystawienia),
  );

  const additionalData = {
    nrKSeF: ksefNumber,
    qrCode: qrUrl,
  };

  let pdf: any;
  switch (wersja) {
    case "FA (1)":
      pdf = generateFA1(invoice, additionalData);
      break;
    case "FA (2)":
      pdf = generateFA2(invoice, additionalData);
      break;
    case "FA (3)":
    default:
      pdf = generateFA3(invoice, additionalData);
      break;
  }

  return new Promise<string>((resolve, reject) => {
    try {
      pdf.getBase64((base64: string) => {
        resolve(base64);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Download invoice PDF using official CIRFMF KSeF visualization
 */
export async function generateInvoicePdf(inv: ParsedInvoice, xmlString?: string): Promise<void> {
  if (!xmlString) {
    throw new Error("XML string is required for official KSeF PDF generation");
  }
  const pdfBase64 = await generatePdfWithCirfmf(xmlString, inv.ksefNumber);
  const anchor = document.createElement("a");
  anchor.href = `data:application/pdf;base64,${pdfBase64}`;
  anchor.download = `${inv.ksefNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Generate invoice PDF as base64 using official CIRFMF KSeF visualization
 */
export async function generateInvoicePdfBase64(inv: ParsedInvoice, xmlString?: string): Promise<string> {
  if (!xmlString) {
    throw new Error("XML string is required for official KSeF PDF generation");
  }
  return generatePdfWithCirfmf(xmlString, inv.ksefNumber);
}
