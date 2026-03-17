import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// ── XML Parsing using DOMParser ──

function getText(el: Element | null, tag: string): string {
  if (!el) return "";
  // Try without namespace first, then with wildcard namespace
  const found = el.getElementsByTagName(tag)[0] 
    || el.getElementsByTagNameNS("*", tag)[0];
  return found?.textContent?.trim() || "";
}

function getDirectText(el: Element | null, tag: string): string {
  if (!el) return "";
  // Only match direct children to avoid picking up nested elements
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
  sumaNettoWgStawek: { stawka: string; netto: string; vat: string }[];
  sumaNetto: string;
  sumaVat: string;
  sumaBrutto: string;
  terminPlatnosci: string;
  formaPlatnosci: string;
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
  VAT: "Faktura VAT",
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
  return [street, [nr, nrLok].filter(Boolean).join("/"), [code, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function parseParty(el: Element | null): InvoiceParty {
  if (!el) return { nip: "", nazwa: "", adres: "", email: "", telefon: "" };
  const ident = getEl(el, "DaneIdentyfikacyjne");
  const adresEl = getEl(el, "Adres");
  const kontakt = getEl(el, "DaneKontaktowe");
  return {
    nip: getText(ident, "NIP") || getText(el, "NIP") || "",
    nazwa: getText(ident, "Nazwa") || getText(ident, "PelnaNazwa") || "",
    adres: parseAddr(adresEl),
    email: getText(kontakt, "Email") || "",
    telefon: getText(kontakt, "Telefon") || "",
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
  
  // Check for parsing errors
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

  // VAT summary by rate - read from official P_13_x/P_14_x FA(3) fields
  const sumaNettoWgStawek: { stawka: string; netto: string; vat: string }[] = [];
  
  // P_13_1/P_14_1 = 23% (or 22%)
  const p13_1 = getText(faEl, "P_13_1");
  const p14_1 = getText(faEl, "P_14_1");
  if (p13_1) sumaNettoWgStawek.push({ stawka: "23", netto: p13_1, vat: p14_1 || "0" });
  
  // P_13_2/P_14_2 = 8% (or 7%)
  const p13_2 = getText(faEl, "P_13_2");
  const p14_2 = getText(faEl, "P_14_2");
  if (p13_2) sumaNettoWgStawek.push({ stawka: "8", netto: p13_2, vat: p14_2 || "0" });
  
  // P_13_3/P_14_3 = 5%
  const p13_3 = getText(faEl, "P_13_3");
  const p14_3 = getText(faEl, "P_14_3");
  if (p13_3) sumaNettoWgStawek.push({ stawka: "5", netto: p13_3, vat: p14_3 || "0" });
  
  // P_13_4/P_14_4 = ryczalt taksowki
  const p13_4 = getText(faEl, "P_13_4");
  const p14_4 = getText(faEl, "P_14_4");
  if (p13_4) sumaNettoWgStawek.push({ stawka: "ryczalt", netto: p13_4, vat: p14_4 || "0" });
  
  // P_13_6_1 = 0%
  const p13_6_1 = getText(faEl, "P_13_6_1");
  if (p13_6_1) sumaNettoWgStawek.push({ stawka: "0", netto: p13_6_1, vat: "0" });
  
  // P_13_7 = zwolnione (ZW)
  const p13_7 = getText(faEl, "P_13_7");
  if (p13_7) sumaNettoWgStawek.push({ stawka: "zw", netto: p13_7, vat: "0" });
  
  // P_13_8 = odwrotne obciazenie (OO) 
  const p13_8 = getText(faEl, "P_13_8");
  if (p13_8) sumaNettoWgStawek.push({ stawka: "oo", netto: p13_8, vat: "0" });
  
  // P_13_9 = np (nie podlega)
  const p13_9 = getText(faEl, "P_13_9");
  if (p13_9) sumaNettoWgStawek.push({ stawka: "np", netto: p13_9, vat: "0" });
  
  // P_13_10 = np-ue
  const p13_10 = getText(faEl, "P_13_10");
  if (p13_10) sumaNettoWgStawek.push({ stawka: "np-ue", netto: p13_10, vat: "0" });
  
  // P_13_11 = np-kraj
  const p13_11 = getText(faEl, "P_13_11");
  if (p13_11) sumaNettoWgStawek.push({ stawka: "np-kraj", netto: p13_11, vat: "0" });
  
  // Fallback: if no P_13 fields found, compute from line items
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
    sumaNettoWgStawek,
    sumaNetto,
    sumaVat,
    sumaBrutto,
    terminPlatnosci: getText(terminEl, "Termin") || "",
    formaPlatnosci: getText(platnoscEl, "FormaPlatnosci") || "",
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

// ── PDF Generation (KSeF FA(3) compliant layout) ──

function fmtNum(val: string | number): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function generateInvoicePdf(inv: ParsedInvoice): void {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const mg = 12;
  const cw = pw - 2 * mg;
  let y = 12;

  // All text goes through stripPl to handle Polish diacritics
  const t = (s: string) => stripPl(s);

  const bold = (s = 9) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(s); };
  const norm = (s = 8) => { pdf.setFont("helvetica", "normal"); pdf.setFontSize(s); };
  const setClr = (r: number, g: number, b: number) => pdf.setTextColor(r, g, b);
  const BLACK = () => setClr(0, 0, 0);
  const GRAY = () => setClr(100, 100, 100);
  const BLUE = () => setClr(25, 65, 148);
  const WHITE = () => setClr(255, 255, 255);
  const hline = (x1: number, y1: number, x2: number, c = [200, 200, 200]) => {
    pdf.setDrawColor(c[0], c[1], c[2]);
    pdf.setLineWidth(0.3);
    pdf.line(x1, y1, x2, y1);
  };
  const checkPage = (need: number) => {
    if (y + need > 275) { pdf.addPage(); y = 12; }
  };

  // Helper: label + value pair
  const labelVal = (lx: number, ly: number, label: string, value: string, labelW = 35) => {
    norm(7); GRAY();
    pdf.text(t(label), lx, ly);
    bold(8); BLACK();
    pdf.text(t(value), lx + labelW, ly);
  };

  // ── 1. HEADER ──
  const rodzaj = RODZAJ_FAKTURY[inv.rodzajFaktury] || `Faktura ${inv.rodzajFaktury}`;
  bold(14); BLUE();
  pdf.text(t(rodzaj.toUpperCase()), mg, y);
  hline(mg, y + 1.5, pw - mg, [25, 65, 148]);
  y += 6;

  // KSeF number
  norm(7); GRAY();
  pdf.text(`Numer KSeF: ${inv.ksefNumber}`, mg, y);
  y += 7;

  // ── 2. INVOICE DETAILS ──
  const infoStartY = y;

  // Left column
  labelVal(mg, y, "Numer faktury:", inv.nrFaktury);
  y += 4.5;
  labelVal(mg, y, "Data wystawienia:", inv.dataWystawienia);
  y += 4.5;
  if (inv.dataSprzedazy) {
    labelVal(mg, y, "Data sprzedazy:", inv.dataSprzedazy);
    y += 4.5;
  }
  if (inv.okresOd && inv.okresDo) {
    labelVal(mg, y, "Okres:", `${inv.okresOd} - ${inv.okresDo}`);
    y += 4.5;
  }
  if (inv.miejsceWystawienia) {
    labelVal(mg, y, "Miejsce wystawienia:", inv.miejsceWystawienia);
    y += 4.5;
  }
  labelVal(mg, y, "Waluta:", inv.kodWaluty);
  y += 4.5;

  // Right column
  let yr = infoStartY;
  const rx = pw / 2 + 10;
  labelVal(rx, yr, "Forma platnosci:", FORMA_PLATNOSCI[inv.formaPlatnosci] || inv.formaPlatnosci || "-");
  yr += 4.5;
  if (inv.terminPlatnosci) {
    labelVal(rx, yr, "Termin platnosci:", inv.terminPlatnosci);
    yr += 4.5;
  }
  if (inv.nrRachunku) {
    labelVal(rx, yr, "Nr rachunku:", inv.nrRachunku);
    yr += 4.5;
  }
  if (inv.nazwaBanku) {
    labelVal(rx, yr, "Bank:", inv.nazwaBanku);
    yr += 4.5;
  }
  if (inv.nrWZ) {
    labelVal(rx, yr, "Nr WZ:", inv.nrWZ);
    yr += 4.5;
  }
  if (inv.nrZamowienia) {
    labelVal(rx, yr, "Nr zamowienia:", inv.nrZamowienia, 30);
    yr += 4.5;
  }

  y = Math.max(y, yr) + 4;

  // ── 3. PARTIES ──
  const colW = cw / 2 - 3;
  const partyH = 30;

  // Seller box
  pdf.setFillColor(240, 243, 248);
  pdf.rect(mg, y, colW, partyH, "F");
  hline(mg, y, mg + colW, [25, 65, 148]);

  bold(7); BLUE();
  pdf.text("SPRZEDAWCA", mg + 3, y + 5);
  bold(9); BLACK();
  const sellerLines = pdf.splitTextToSize(t(inv.sprzedawca.nazwa), colW - 6);
  pdf.text(sellerLines.slice(0, 2), mg + 3, y + 10);
  const sellerNameH = Math.min(sellerLines.length, 2) * 4;
  norm(8); GRAY();
  pdf.text(`NIP: ${inv.sprzedawca.nip}`, mg + 3, y + 10 + sellerNameH);
  const sellerAddrLines = pdf.splitTextToSize(t(inv.sprzedawca.adres), colW - 6);
  pdf.text(sellerAddrLines.slice(0, 2), mg + 3, y + 14 + sellerNameH);
  if (inv.sprzedawca.email) {
    norm(7);
    pdf.text(t(inv.sprzedawca.email), mg + 3, y + 22 + sellerNameH);
  }

  // Buyer box
  const bx = mg + colW + 6;
  pdf.setFillColor(240, 243, 248);
  pdf.rect(bx, y, colW, partyH, "F");
  hline(bx, y, bx + colW, [25, 65, 148]);

  bold(7); BLUE();
  pdf.text("NABYWCA", bx + 3, y + 5);
  bold(9); BLACK();
  const buyerLines = pdf.splitTextToSize(t(inv.nabywca.nazwa), colW - 6);
  pdf.text(buyerLines.slice(0, 2), bx + 3, y + 10);
  const buyerNameH = Math.min(buyerLines.length, 2) * 4;
  norm(8); GRAY();
  pdf.text(`NIP: ${inv.nabywca.nip}`, bx + 3, y + 10 + buyerNameH);
  const buyerAddrLines = pdf.splitTextToSize(t(inv.nabywca.adres), colW - 6);
  pdf.text(buyerAddrLines.slice(0, 2), bx + 3, y + 14 + buyerNameH);
  if (inv.nabywca.email) {
    norm(7);
    pdf.text(t(inv.nabywca.email), bx + 3, y + 22 + buyerNameH);
  }

  y += partyH + 6;

  // ── 4. LINE ITEMS TABLE ──
  const cols = [
    { label: "Lp.", w: 8, align: "left" as const },
    { label: "Nazwa towaru / uslugi", w: 52, align: "left" as const },
    { label: "J.m.", w: 10, align: "left" as const },
    { label: "Ilosc", w: 14, align: "right" as const },
    { label: "Cena netto", w: 22, align: "right" as const },
    { label: "Wart. netto", w: 22, align: "right" as const },
    { label: "St. VAT", w: 14, align: "right" as const },
    { label: "Kwota VAT", w: 20, align: "right" as const },
    { label: "Wart. brutto", w: 24, align: "right" as const },
  ];

  checkPage(10 + inv.pozycje.length * 5);

  // Table header
  pdf.setFillColor(25, 65, 148);
  pdf.rect(mg, y, cw, 6, "F");
  bold(6.5); WHITE();
  let cx = mg + 1;
  cols.forEach((col) => {
    if (col.align === "right") {
      pdf.text(col.label, cx + col.w - 2, y + 4, { align: "right" });
    } else {
      pdf.text(col.label, cx + 1, y + 4);
    }
    cx += col.w;
  });
  y += 6;

  // Table rows
  inv.pozycje.forEach((p, i) => {
    checkPage(5.5);
    if (i % 2 === 0) {
      pdf.setFillColor(248, 249, 252);
      pdf.rect(mg, y - 0.5, cw, 5, "F");
    }
    norm(7); BLACK();
    cx = mg + 1;

    const rowNr = p.nr ? p.nr.replace(/^0+/, "") || "1" : String(i + 1);
    const vals = [
      { v: rowNr, a: "left" },
      { v: t(p.opis), a: "left", maxW: 50 },
      { v: p.jm, a: "left" },
      { v: p.ilosc, a: "right" },
      { v: fmtNum(p.cenaNetto), a: "right" },
      { v: fmtNum(p.wartoscNetto), a: "right" },
      { v: `${p.stawkaVat}%`, a: "right" },
      { v: fmtNum(p.kwotaVat), a: "right" },
      { v: fmtNum(p.brutto), a: "right" },
    ];
    vals.forEach((item, j) => {
      let text = item.v;
      if (item.maxW) {
        const maxChars = Math.floor(item.maxW / 1.8);
        if (text.length > maxChars) text = text.substring(0, maxChars - 1) + "...";
      }
      if (item.a === "right") {
        pdf.text(text, cx + cols[j].w - 2, y + 3, { align: "right" });
      } else {
        pdf.text(text, cx + 1, y + 3);
      }
      cx += cols[j].w;
    });
    y += 5;
  });

  hline(mg, y, mg + cw);
  y += 4;

  // ── 5. VAT SUMMARY ──
  checkPage(25);
  const sumX = mg + cw - 90;

  bold(7); BLUE();
  pdf.text("PODSUMOWANIE VAT", sumX, y);
  y += 4;

  pdf.setFillColor(240, 243, 248);
  pdf.rect(sumX, y - 1, 90, 5, "F");
  bold(6.5); GRAY();
  pdf.text("Stawka VAT", sumX + 2, y + 2.5);
  pdf.text("Netto", sumX + 30, y + 2.5, { align: "right" });
  pdf.text("VAT", sumX + 55, y + 2.5, { align: "right" });
  pdf.text("Brutto", sumX + 88, y + 2.5, { align: "right" });
  y += 5;

  inv.sumaNettoWgStawek.forEach((s) => {
    norm(7); BLACK();
    const stawkaLabel = ["zw", "oo", "np", "np-ue", "np-kraj", "ryczalt"].includes(s.stawka) 
      ? s.stawka.toUpperCase() 
      : `${s.stawka}%`;
    pdf.text(stawkaLabel, sumX + 2, y + 2.5);
    pdf.text(fmtNum(s.netto), sumX + 30, y + 2.5, { align: "right" });
    pdf.text(fmtNum(s.vat), sumX + 55, y + 2.5, { align: "right" });
    const brutto = (parseFloat(s.netto) + parseFloat(s.vat)).toFixed(2);
    pdf.text(fmtNum(brutto), sumX + 88, y + 2.5, { align: "right" });
    y += 4.5;
  });

  hline(sumX, y, sumX + 90, [25, 65, 148]);
  y += 1;
  bold(8); BLACK();
  pdf.text("RAZEM:", sumX + 2, y + 3);
  pdf.text(fmtNum(inv.sumaNetto), sumX + 30, y + 3, { align: "right" });
  pdf.text(fmtNum(inv.sumaVat), sumX + 55, y + 3, { align: "right" });
  bold(9);
  pdf.text(fmtNum(inv.sumaBrutto) + " " + inv.kodWaluty, sumX + 88, y + 3, { align: "right" });
  y += 8;

  // ── 6. AMOUNT DUE ──
  checkPage(14);
  pdf.setFillColor(25, 65, 148);
  pdf.rect(sumX, y, 90, 9, "F");
  bold(8); WHITE();
  pdf.text("DO ZAPLATY:", sumX + 4, y + 6);
  bold(11);
  pdf.text(fmtNum(inv.doZaplaty) + " " + inv.kodWaluty, sumX + 86, y + 6, { align: "right" });
  y += 14;

  // ── 7. ADDITIONAL INFO ──
  if (inv.uwagi.length > 0) {
    checkPage(8 + inv.uwagi.length * 8);
    bold(7); BLUE();
    pdf.text("INFORMACJE DODATKOWE", mg, y);
    y += 4;
    inv.uwagi.forEach((u) => {
      norm(7); GRAY();
      pdf.text(t(u.klucz) + ":", mg, y);
      y += 3.5;
      norm(7); BLACK();
      const lines = pdf.splitTextToSize(t(u.wartosc), cw - 4);
      pdf.text(lines.slice(0, 3), mg + 2, y);
      y += lines.slice(0, 3).length * 3.5 + 2;
    });
    y += 2;
  }

  // ── 8. FOOTER ──
  const footerParts: string[] = [];
  if (inv.krs) footerParts.push(`KRS: ${inv.krs}`);
  if (inv.regon) footerParts.push(`REGON: ${inv.regon}`);
  if (inv.bdo) footerParts.push(`BDO: ${inv.bdo}`);

  if (footerParts.length > 0 || inv.stopka) {
    const fy = 273;
    hline(mg, fy, pw - mg);
    norm(6); GRAY();
    if (footerParts.length > 0) {
      pdf.text(footerParts.join("  |  "), pw / 2, fy + 3, { align: "center" });
    }
    if (inv.stopka) {
      const stopkaLines = pdf.splitTextToSize(t(inv.stopka), cw);
      pdf.text(stopkaLines.slice(0, 2), pw / 2, fy + 6, { align: "center" });
    }
  }

  // KSeF watermark
  norm(6); GRAY();
  pdf.text(
    `Wizualizacja faktury ustrukturyzowanej KSeF  |  ${inv.ksefNumber}`,
    pw / 2,
    288,
    { align: "center" }
  );

  pdf.save(`${inv.ksefNumber}.pdf`);
}
