import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// ── XML Parsing using DOMParser ──

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

interface ParsedInvoice {
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

const FORMA_PLATNOSCI: Record<string, string> = {
  "1": "Gotowka",
  "2": "Karta",
  "3": "Bon",
  "4": "Czek",
  "5": "Kredyt",
  "6": "Przelew",
};

const RODZAJ_FAKTURY: Record<string, string> = {
  VAT: "Faktura podstawowa",
  KOR: "Faktura korygujaca",
  ZAL: "Faktura zaliczkowa",
  ROZ: "Faktura rozliczeniowa",
  UPR: "Faktura uproszczona",
  KOR_ZAL: "Korekta faktury zaliczkowej",
  KOR_ROZ: "Korekta faktury rozliczeniowej",
};

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

// Strip Polish diacritics for jsPDF (helvetica font doesn't support them)
function stripPl(s: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  };
  return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (c) => map[c] || c);
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

  // Parse line items
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

  // Parse Zamowienie (order items for advance invoices)
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

  // Parse Zaliczka (advance payment lines)
  const zaliczkaEl = getEl(faEl, "Zaliczka");
  const zaliczkaWiersze = getAllEls(zaliczkaEl, "ZaliczkaWiersz");
  const zaliczki: ZaliczkaLine[] = zaliczkaWiersze.map((w) => ({
    nrZaliczki: getText(w, "NrWierszaZal") || "",
    opis: getText(w, "OpisZaliczki") || getText(w, "P_7Z") || "-",
    kwota: getText(w, "KwotaZaliczki") || "0",
    stawkaVat: getText(w, "P_12Z") || "",
  }));

  // For advance invoices: if pozycje have empty descriptions, try to fill from zamowienie
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

  // Fallback: compute from line items
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

  // Additional descriptions
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

// ── PDF Generation – official KSeF visualization style ──

function fmtNum(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function generateInvoicePdf(inv: ParsedInvoice): Promise<void> {
  const pdfBase64 = await generateInvoicePdfBase64(inv);
  const anchor = document.createElement("a");
  anchor.href = `data:application/pdf;base64,${pdfBase64}`;
  anchor.download = `${inv.ksefNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function generateInvoicePdfBase64(inv: ParsedInvoice): Promise<string> {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const mg = 15;
  const cw = pw - 2 * mg;
  let y = 15;

  const t = (s: string) => stripPl(s);
  const bold = (s = 9) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(s); };
  const norm = (s = 8) => { pdf.setFont("helvetica", "normal"); pdf.setFontSize(s); };
  const BLACK = () => pdf.setTextColor(0, 0, 0);
  const GRAY = () => pdf.setTextColor(80, 80, 80);

  // Simplified PDF for portal - header
  bold(14); BLACK();
  pdf.text(t("FAKTURA"), mg, y); y += 6;
  norm(9); GRAY();
  pdf.text(t(`Nr KSeF: ${inv.ksefNumber}`), mg, y); y += 5;
  pdf.text(t(`Nr faktury: ${inv.nrFaktury}`), mg, y); y += 5;
  pdf.text(t(`Data wystawienia: ${inv.dataWystawienia}`), mg, y); y += 8;

  // Seller / Buyer
  bold(9); BLACK();
  pdf.text(t("Sprzedawca:"), mg, y);
  pdf.text(t("Nabywca:"), mg + cw / 2, y); y += 5;
  norm(8); GRAY();
  pdf.text(t(inv.sprzedawca.nazwa), mg, y);
  pdf.text(t(inv.nabywca.nazwa), mg + cw / 2, y); y += 4;
  pdf.text(t(`NIP: ${inv.sprzedawca.nip}`), mg, y);
  pdf.text(t(`NIP: ${inv.nabywca.nip}`), mg + cw / 2, y); y += 4;
  pdf.text(t(inv.sprzedawca.adres), mg, y, { maxWidth: cw / 2 - 5 });
  pdf.text(t(inv.nabywca.adres), mg + cw / 2, y, { maxWidth: cw / 2 - 5 }); y += 10;

  // Items table
  bold(8); BLACK();
  const cols = [mg, mg+8, mg+68, mg+83, mg+93, mg+113, mg+133, mg+148, mg+168];
  const headers = ["#", "Nazwa", "Jm.", "Ilosc", "Cena netto", "Netto", "VAT%", "VAT", "Brutto"];
  headers.forEach((h, i) => pdf.text(t(h), cols[i], y));
  y += 2;
  pdf.setDrawColor(180); pdf.setLineWidth(0.3); pdf.line(mg, y, pw - mg, y); y += 4;

  norm(7); GRAY();
  for (const p of inv.pozycje) {
    if (y > 270) { pdf.addPage(); y = 15; }
    pdf.text(p.nr, cols[0], y);
    pdf.text(t(p.opis).substring(0, 35), cols[1], y);
    pdf.text(t(p.jm), cols[2], y);
    pdf.text(p.ilosc, cols[3], y);
    pdf.text(p.cenaNetto, cols[4], y);
    pdf.text(p.wartoscNetto, cols[5], y);
    pdf.text(p.stawkaVat, cols[6], y);
    pdf.text(p.kwotaVat, cols[7], y);
    pdf.text(p.brutto, cols[8], y);
    y += 4;
  }

  y += 4;
  pdf.setDrawColor(180); pdf.line(mg, y, pw - mg, y); y += 5;
  bold(9); BLACK();
  pdf.text(t(`Netto: ${inv.sumaNetto}  VAT: ${inv.sumaVat}  Brutto: ${inv.sumaBrutto}`), mg, y); y += 6;
  if (inv.doZaplaty) {
    pdf.text(t(`Do zaplaty: ${inv.doZaplaty} ${inv.kodWaluty}`), mg, y); y += 5;
  }
  if (inv.formaPlatnosci) {
    norm(8); GRAY();
    pdf.text(t(`Forma platnosci: ${inv.formaPlatnosci}`), mg, y); y += 4;
  }
  if (inv.terminPlatnosci) {
    pdf.text(t(`Termin platnosci: ${inv.terminPlatnosci}`), mg, y); y += 4;
  }

  norm(6); GRAY();
  pdf.text("Krajowy System e-Faktur", pw / 2, 290, { align: "center" });

  const arrayBuf = pdf.output("arraybuffer");
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
