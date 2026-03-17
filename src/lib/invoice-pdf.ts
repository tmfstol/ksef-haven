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

  // VAT summary by rate
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
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const mg = 15;
  const cw = pw - 2 * mg;
  let y = 15;

  const t = (s: string) => stripPl(s);

  const bold = (s = 9) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(s); };
  const norm = (s = 8) => { pdf.setFont("helvetica", "normal"); pdf.setFontSize(s); };
  const italic = (s = 8) => { pdf.setFont("helvetica", "italic"); pdf.setFontSize(s); };
  const BLACK = () => pdf.setTextColor(0, 0, 0);
  const GRAY = () => pdf.setTextColor(80, 80, 80);
  const RED = () => pdf.setTextColor(180, 0, 0);
  const DGRAY = () => pdf.setTextColor(50, 50, 50);

  const hline = (x1: number, yy: number, x2: number) => {
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.2);
    pdf.line(x1, yy, x2, yy);
  };

  const drawRect = (x: number, yy: number, w: number, h: number) => {
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.2);
    pdf.rect(x, yy, w, h);
  };

  const fillRect = (x: number, yy: number, w: number, h: number) => {
    pdf.setFillColor(235, 235, 235);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.2);
    pdf.rect(x, yy, w, h, "FD");
  };

  const checkPage = (need: number) => {
    if (y + need > 280) { pdf.addPage(); y = 15; }
  };

  // Wrap text and return lines
  const wrapText = (text: string, maxW: number, fontSize = 8): string[] => {
    pdf.setFontSize(fontSize);
    return pdf.splitTextToSize(t(text), maxW);
  };

  // ══════════════════════════════════════════
  // 1. HEADER - "Krajowy System e-Faktur"
  // ══════════════════════════════════════════
  italic(11); GRAY();
  pdf.text("Krajowy System e-Faktur", mg, y);

  // Right side: invoice number & type
  const rightX = pw - mg;
  norm(7); GRAY();
  pdf.text("Numer faktury", rightX, y - 3, { align: "right" });
  bold(11); BLACK();
  pdf.text(t(inv.nrFaktury), rightX, y + 1, { align: "right" });
  norm(7); DGRAY();
  const rodzaj = RODZAJ_FAKTURY[inv.rodzajFaktury] || `Faktura ${inv.rodzajFaktury}`;
  pdf.text(t(rodzaj), rightX, y + 5, { align: "right" });

  y += 8;
  RED(); norm(7);
  pdf.text(`Numer KSeF: ${inv.ksefNumber}`, rightX, y, { align: "right" });
  if (inv.dataWystawienia) {
    y += 3.5;
    DGRAY();
    pdf.text(`Data otrzymania w KSeF: ${inv.dataWystawienia}`, rightX, y, { align: "right" });
  }

  y += 6;
  hline(mg, y, pw - mg);
  y += 5;

  // ══════════════════════════════════════════
  // 2. PARTIES - Sprzedawca | Nabywca
  // ══════════════════════════════════════════
  const halfW = cw / 2 - 2;
  const partyStartY = y;

  // Helper to render party details
  const renderParty = (party: InvoiceParty, label: string, x: number, colW: number): number => {
    let py = partyStartY;
    bold(9); BLACK();
    pdf.text(t(label), x, py);
    py += 5;

    norm(7); DGRAY();
    if (party.eori) {
      pdf.text(`Numer EORI: ${party.eori}`, x + 2, py);
      py += 3.5;
    }
    if (party.prefiksVat) {
      pdf.text(`Prefiks VAT: ${party.prefiksVat}`, x + 2, py);
      py += 3.5;
    }
    if (party.nip) {
      pdf.text(`NIP: ${party.nip}`, x + 2, py);
      py += 3.5;
    }
    bold(8); BLACK();
    pdf.text(t("Nazwa"), x + 2, py);
    py += 3.5;
    norm(7); BLACK();
    const nameLines = wrapText(party.nazwa, colW - 4, 7);
    nameLines.forEach((line: string) => {
      pdf.text(line, x + 2, py);
      py += 3.5;
    });

    if (party.adres) {
      bold(7); DGRAY();
      pdf.text("Adres", x + 2, py);
      py += 3.5;
      norm(7);
      const addrLines = wrapText(party.adres, colW - 4, 7);
      addrLines.forEach((line: string) => {
        pdf.text(line, x + 2, py);
        py += 3.5;
      });
    }

    if (party.email) {
      norm(7);
      pdf.text(`Email: ${party.email}`, x + 2, py);
      py += 3.5;
    }
    if (party.telefon) {
      norm(7);
      pdf.text(`Tel: ${party.telefon}`, x + 2, py);
      py += 3.5;
    }
    return py;
  };

  const sellerEndY = renderParty(inv.sprzedawca, "Sprzedawca", mg, halfW);

  // Nabywca (right column)
  const bx = mg + halfW + 4;
  const buyerEndY = renderParty(inv.nabywca, "Nabywca", bx, halfW);

  y = Math.max(sellerEndY, buyerEndY) + 4;
  hline(mg, y, pw - mg);
  y += 6;

  // ══════════════════════════════════════════
  // 3. INVOICE DETAILS - Szczegoly faktury
  // ══════════════════════════════════════════
  bold(9); BLACK();
  italic(9);
  pdf.text(t("Szczegoly faktury"), mg, y);
  y += 5;

  norm(7); DGRAY();
  pdf.text(t(`Data wystawienia: ${inv.dataWystawienia}`), mg + 2, y);
  y += 3.5;
  if (inv.dataSprzedazy) {
    pdf.text(t(`Data sprzedazy: ${inv.dataSprzedazy}`), mg + 2, y);
    y += 3.5;
  }
  if (inv.okresOd && inv.okresDo) {
    pdf.text(t(`Okres: ${inv.okresOd} - ${inv.okresDo}`), mg + 2, y);
    y += 3.5;
  }
  if (inv.miejsceWystawienia) {
    pdf.text(t(`Miejsce wystawienia: ${inv.miejsceWystawienia}`), mg + 2, y);
    y += 3.5;
  }

  y += 4;
  hline(mg, y, pw - mg);
  y += 6;

  // ══════════════════════════════════════════
  // 4. LINE ITEMS - Pozycje
  // ══════════════════════════════════════════
  bold(9); BLACK();
  italic(9);
  pdf.text("Pozycje", mg, y);
  y += 3;
  norm(7); DGRAY();
  pdf.text(t(`Faktura wystawiona w cenach netto w walucie ${inv.kodWaluty}`), mg + 2, y);
  y += 5;

  // Table header
  const colDefs = [
    { label: "Lp.", w: 10, align: "left" as const },
    { label: "Nazwa towaru lub uslugi", w: 58, align: "left" as const },
    { label: "Cena jedn. netto", w: 24, align: "right" as const },
    { label: "Ilosc", w: 14, align: "right" as const },
    { label: "Miara", w: 16, align: "left" as const },
    { label: "Stawka podatku", w: 22, align: "right" as const },
    { label: t("Wartosc sprzedazy netto"), w: 36, align: "right" as const },
  ];

  const headerH = 8;
  fillRect(mg, y, cw, headerH);
  bold(6.5); BLACK();
  let cx = mg;
  colDefs.forEach((col) => {
    const textLines = pdf.splitTextToSize(col.label, col.w - 2);
    if (col.align === "right") {
      textLines.forEach((line: string, li: number) => {
        pdf.text(line, cx + col.w - 1.5, y + 3 + li * 2.5, { align: "right" });
      });
    } else {
      textLines.forEach((line: string, li: number) => {
        pdf.text(line, cx + 1.5, y + 3 + li * 2.5);
      });
    }
    cx += col.w;
  });
  y += headerH;

  // Table rows
  inv.pozycje.forEach((p, i) => {
    // Calculate row height based on text wrapping
    norm(7);
    const descLines = wrapText(p.opis, colDefs[1].w - 3, 7);
    const rowH = Math.max(6, descLines.length * 3.5 + 2);

    checkPage(rowH);

    if (i % 2 === 1) {
      pdf.setFillColor(245, 245, 245);
      pdf.rect(mg, y, cw, rowH, "F");
    }
    drawRect(mg, y, cw, rowH);

    norm(7); BLACK();
    cx = mg;

    const rowNr = p.nr ? p.nr.replace(/^0+/, "") || "1" : String(i + 1);
    // Lp.
    pdf.text(rowNr, cx + 1.5, y + 4);
    cx += colDefs[0].w;

    // Nazwa - full text with wrapping
    descLines.forEach((line: string, li: number) => {
      pdf.text(line, cx + 1.5, y + 4 + li * 3.5);
    });
    cx += colDefs[1].w;

    // Cena jedn. netto
    pdf.text(fmtNum(p.cenaNetto), cx + colDefs[2].w - 1.5, y + 4, { align: "right" });
    cx += colDefs[2].w;

    // Ilosc
    pdf.text(p.ilosc, cx + colDefs[3].w - 1.5, y + 4, { align: "right" });
    cx += colDefs[3].w;

    // Miara
    pdf.text(t(p.jm || "-"), cx + 1.5, y + 4);
    cx += colDefs[4].w;

    // Stawka podatku
    const stawkaLabel = ["zw", "oo", "np", "np-ue", "np-kraj", "ryczalt"].includes(p.stawkaVat)
      ? p.stawkaVat.toUpperCase()
      : `${p.stawkaVat}%`;
    pdf.text(stawkaLabel, cx + colDefs[5].w - 1.5, y + 4, { align: "right" });
    cx += colDefs[5].w;

    // Wartosc sprzedazy netto
    pdf.text(fmtNum(p.wartoscNetto), cx + colDefs[6].w - 1.5, y + 4, { align: "right" });

    y += rowH;
  });

  y += 4;

  // Kwota naleznosci ogolem
  bold(8); BLACK();
  pdf.text(t(`Kwota naleznosci ogolem : ${fmtNum(inv.sumaBrutto)} ${inv.kodWaluty}`), pw - mg, y, { align: "right" });
  y += 8;

  // ══════════════════════════════════════════
  // 5. VAT SUMMARY - Podsumowanie stawek podatku
  // ══════════════════════════════════════════
  checkPage(20 + inv.sumaNettoWgStawek.length * 7);
  bold(9); BLACK();
  italic(9);
  pdf.text(t("Podsumowanie stawek podatku"), mg, y);
  y += 5;

  // VAT summary table
  const vatCols = [
    { label: "Stawka podatku", w: 40 },
    { label: "Kwota netto", w: 35 },
    { label: "Kwota podatku", w: 35 },
    { label: "Kwota brutto", w: cw - 110 },
  ];

  // Header
  fillRect(mg, y, cw, 6);
  bold(7); BLACK();
  let vx = mg;
  vatCols.forEach((col) => {
    pdf.text(col.label, vx + 2, y + 4);
    vx += col.w;
  });
  y += 6;

  // VAT rows
  inv.sumaNettoWgStawek.forEach((s) => {
    const rowH = 7;
    checkPage(rowH);
    drawRect(mg, y, cw, rowH);

    norm(7); BLACK();
    vx = mg;

    const stawkaLabel = ["zw", "oo", "np", "np-ue", "np-kraj", "ryczalt"].includes(s.stawka)
      ? s.stawka.toUpperCase()
      : `22% lub ${s.stawka}%`;
    pdf.text(stawkaLabel, vx + 2, y + 5);
    vx += vatCols[0].w;

    pdf.text(fmtNum(s.netto), vx + 2, y + 5);
    vx += vatCols[1].w;

    pdf.text(fmtNum(s.vat), vx + 2, y + 5);
    vx += vatCols[2].w;

    const brutto = (parseFloat(s.netto) + parseFloat(s.vat)).toFixed(2);
    pdf.text(fmtNum(brutto), vx + 2, y + 5);

    y += rowH;
  });

  y += 6;

  // ══════════════════════════════════════════
  // 6. ADDITIONAL DESCRIPTIONS
  // ══════════════════════════════════════════
  if (inv.uwagi.length > 0) {
    checkPage(10 + inv.uwagi.length * 10);
    bold(9); BLACK();
    italic(9);
    pdf.text("Dodatkowe informacje", mg, y);
    y += 6;

    bold(9);
    italic(9);
    pdf.text("Dodatkowy opis", mg, y);
    y += 5;

    inv.uwagi.forEach((u) => {
      checkPage(10);
      // Header row
      fillRect(mg, y, cw / 3, 6);
      fillRect(mg + cw / 3, y, cw / 3, 6);
      fillRect(mg + 2 * cw / 3, y, cw / 3, 6);

      bold(6.5); BLACK();
      pdf.text("Numer wiersza", mg + 2, y + 4);
      pdf.text(t("Rodzaj informacji"), mg + cw / 3 + 2, y + 4);
      pdf.text(t("Tresc informacji"), mg + 2 * cw / 3 + 2, y + 4);
      y += 6;

      // Data row
      norm(7);
      drawRect(mg, y, cw / 3, 6);
      drawRect(mg + cw / 3, y, cw / 3, 6);
      drawRect(mg + 2 * cw / 3, y, cw / 3, 6);

      pdf.text(t(u.klucz), mg + cw / 3 + 2, y + 4);
      pdf.text(t(u.wartosc), mg + 2 * cw / 3 + 2, y + 4);
      y += 8;
    });

    y += 4;
  }

  // ══════════════════════════════════════════
  // 7. ROZLICZENIE
  // ══════════════════════════════════════════
  checkPage(15);
  hline(mg, y, pw - mg);
  y += 5;
  bold(9); BLACK();
  italic(9);
  pdf.text("Rozliczenie", mg, y);
  bold(9);
  pdf.text(t(`Do zaplaty: ${fmtNum(inv.doZaplaty)} ${inv.kodWaluty}`), pw - mg, y, { align: "right" });
  y += 8;

  // ══════════════════════════════════════════
  // 8. PLATNOSC
  // ══════════════════════════════════════════
  checkPage(20);
  hline(mg, y, pw - mg);
  y += 5;
  bold(9); BLACK();
  italic(9);
  pdf.text(t("Platnosc"), mg, y);
  y += 5;

  const formaLabel = FORMA_PLATNOSCI[inv.formaPlatnosci] || inv.formaPlatnosci || "-";
  norm(7); DGRAY();
  pdf.text(t(`Forma platnosci: ${formaLabel}`), mg + 2, y);
  y += 5;

  // Payment details table - always show both columns like the original
  {
    const payColW = cw / 2;
    // Header row
    fillRect(mg, y, payColW, 6);
    fillRect(mg + payColW, y, payColW, 6);
    bold(6.5); BLACK();
    pdf.text(t("Termin platnosci"), mg + 2, y + 4);
    pdf.text(t("Opis platnosci"), mg + payColW + 2, y + 4);
    y += 6;

    // Values row - wrap opis platnosci text
    const opisLines = inv.opisPlatnosci ? wrapText(inv.opisPlatnosci, payColW - 4, 7) : ["-"];
    const valRowH = Math.max(6, opisLines.length * 3.5 + 2);

    drawRect(mg, y, payColW, valRowH);
    drawRect(mg + payColW, y, payColW, valRowH);
    norm(7); BLACK();
    pdf.text(inv.terminPlatnosci || "-", mg + 2, y + 4);
    opisLines.forEach((line: string, li: number) => {
      pdf.text(line, mg + payColW + 2, y + 4 + li * 3.5);
    });
    y += valRowH + 2;
  }

  // ══════════════════════════════════════════
  // 9. BANK ACCOUNT
  // ══════════════════════════════════════════
  if (inv.nrRachunku) {
    checkPage(18);
    y += 2;
    bold(9); BLACK();
    italic(9);
    pdf.text("Numer rachunku bankowego", mg, y);
    y += 5;

    fillRect(mg, y, cw, 6);
    bold(6.5); BLACK();
    pdf.text(t("Pelny numer rachunku"), mg + 2, y + 4);
    y += 6;

    drawRect(mg, y, cw, 6);
    norm(7); BLACK();
    pdf.text(inv.nrRachunku, mg + 2, y + 4);
    y += 8;
  }

  // ══════════════════════════════════════════
  // 10. WZ DOCUMENTS
  // ══════════════════════════════════════════
  if (inv.nrWZ) {
    checkPage(18);
    y += 2;
    bold(9); BLACK();
    italic(9);
    pdf.text(t("Numery dokumentow magazynowych WZ"), mg, y);
    y += 5;

    fillRect(mg, y, cw, 6);
    bold(6.5); BLACK();
    pdf.text("Numer WZ", mg + 2, y + 4);
    y += 6;

    drawRect(mg, y, cw, 6);
    norm(7); BLACK();
    pdf.text(t(inv.nrWZ), mg + 2, y + 4);
    y += 8;
  }

  // ══════════════════════════════════════════
  // 11. REJESTRY (KRS, REGON, BDO)
  // ══════════════════════════════════════════
  if (inv.krs || inv.regon || inv.bdo) {
    checkPage(22);
    y += 2;
    bold(9); BLACK();
    italic(9);
    pdf.text("Rejestry", mg, y);
    y += 5;

    // Build columns: Pełna nazwa gets more space, others fixed width
    const smallColW = 30;
    const smallCols: { label: string; value: string }[] = [];
    if (inv.krs) smallCols.push({ label: "KRS", value: inv.krs });
    if (inv.regon) smallCols.push({ label: "REGON", value: inv.regon });
    if (inv.bdo) smallCols.push({ label: "BDO", value: inv.bdo });
    const nameColW = cw - smallCols.length * smallColW;

    // Wrap the full name
    const nameLines = wrapText(inv.sprzedawca.nazwa, nameColW - 4, 7);
    const regRowH = Math.max(6, nameLines.length * 3.5 + 2);

    // Header row
    fillRect(mg, y, nameColW, 6);
    bold(6.5); BLACK();
    pdf.text(t("Pelna nazwa"), mg + 2, y + 4);
    smallCols.forEach((col, i) => {
      fillRect(mg + nameColW + i * smallColW, y, smallColW, 6);
      pdf.text(col.label, mg + nameColW + i * smallColW + 2, y + 4);
    });
    y += 6;

    // Values row
    drawRect(mg, y, nameColW, regRowH);
    norm(7); BLACK();
    nameLines.forEach((line: string, li: number) => {
      pdf.text(line, mg + 2, y + 4 + li * 3.5);
    });
    smallCols.forEach((col, i) => {
      drawRect(mg + nameColW + i * smallColW, y, smallColW, regRowH);
      pdf.text(col.value, mg + nameColW + i * smallColW + 2, y + 4);
    });
    y += regRowH + 2;
  }

  // ══════════════════════════════════════════
  // 12. STOPKA FAKTURY
  // ══════════════════════════════════════════
  if (inv.stopka) {
    checkPage(20);
    y += 2;
    bold(9); BLACK();
    italic(9);
    pdf.text("Stopka faktury", mg, y);
    y += 5;

    norm(7); DGRAY();
    const stopkaLines = wrapText(inv.stopka, cw - 4, 7);
    stopkaLines.forEach((line: string) => {
      checkPage(4);
      pdf.text(line, mg + 2, y);
      y += 3.5;
    });
    y += 4;
  }

  // ══════════════════════════════════════════
  // 13. QR CODE
  // ══════════════════════════════════════════
  try {
    const qrDataUrl = await QRCode.toDataURL(inv.ksefNumber, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    checkPage(30);
    const qrSize = 22;
    pdf.addImage(qrDataUrl, "PNG", mg, y, qrSize, qrSize);
    norm(5); GRAY();
    pdf.text("Numer KSeF", mg + qrSize / 2, y + qrSize + 2.5, { align: "center" });
  } catch (e) {
    console.error("QR generation failed:", e);
  }

  // ══════════════════════════════════════════
  // 14. FOOTER WATERMARK
  // ══════════════════════════════════════════
  norm(6); GRAY();
  pdf.text("Krajowy System e-Faktur", pw / 2, 290, { align: "center" });

  pdf.save(`${inv.ksefNumber}.pdf`);
}
