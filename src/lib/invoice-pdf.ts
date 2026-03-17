import { jsPDF } from "jspdf";

// ── XML Parsing ──

function getTag(xml: string, tag: string): string {
  const patterns = [
    new RegExp(`<[^:]*:?${tag}[^>]*>([\\s\\S]*?)<\\/[^:]*:?${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) return m[1].trim();
  }
  return "";
}

function getAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<[^:]*:?${tag}[^>]*>[\\s\\S]*?<\\/[^:]*:?${tag}>`, "gi");
  return [...xml.matchAll(re)].map((m) => m[0]);
}

// ── Data types ──

interface InvoiceParty {
  nip: string;
  nazwa: string;
  adres: string;
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
  doZaplaty: string;
  uwagi: { klucz: string; wartosc: string }[];
  stopka: string;
  krs: string;
  regon: string;
  bdo: string;
}

const FORMA_PLATNOSCI: Record<string, string> = {
  "1": "Gotówka",
  "2": "Karta",
  "3": "Bon",
  "4": "Czek",
  "5": "Kredyt",
  "6": "Przelew",
};

const RODZAJ_FAKTURY: Record<string, string> = {
  VAT: "Faktura VAT",
  KOR: "Faktura korygująca",
  ZAL: "Faktura zaliczkowa",
  ROZ: "Faktura rozliczeniowa",
  UPR: "Faktura uproszczona",
  KOR_ZAL: "Korekta faktury zaliczkowej",
  KOR_ROZ: "Korekta faktury rozliczeniowej",
};

function parseAddr(block: string): string {
  const addrL1 = getTag(block, "AdresL1");
  const addrL2 = getTag(block, "AdresL2");
  if (addrL1 || addrL2) return [addrL1, addrL2].filter(Boolean).join(", ");
  const street = getTag(block, "Ulica");
  const nr = getTag(block, "NrDomu");
  const nrLok = getTag(block, "NrLokalu");
  const code = getTag(block, "KodPocztowy");
  const city = getTag(block, "Miejscowosc");
  return [street, [nr, nrLok].filter(Boolean).join("/"), [code, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function parseParty(block: string): InvoiceParty {
  const ident = getTag(block, "DaneIdentyfikacyjne");
  const addr = getTag(block, "Adres");
  return {
    nip: getTag(ident, "NIP") || getTag(block, "NIP") || "",
    nazwa: getTag(ident, "Nazwa") || getTag(ident, "PelnaNazwa") || "",
    adres: parseAddr(addr),
  };
}

export function parseKsefXml(xml: string, ksefNumber: string): ParsedInvoice {
  const fa = getTag(xml, "Fa") || xml;
  const podmiot1 = getTag(xml, "Podmiot1");
  const podmiot2 = getTag(xml, "Podmiot2");
  const platnosc = getTag(fa, "Platnosc");
  const rozliczenie = getTag(fa, "Rozliczenie");
  const stopkaBlock = getTag(xml, "Stopka");
  const rejestry = getTag(stopkaBlock, "Rejestry");

  // Parse line items
  const wiersze = getAllBlocks(fa, "FaWiersz");
  const pozycje: InvoiceLine[] = wiersze.map((w) => {
    const net = getTag(w, "P_11") || "0";
    const vatRate = getTag(w, "P_12") || "0";
    const netNum = parseFloat(net) || 0;
    const vatNum = netNum * (parseFloat(vatRate) / 100);
    return {
      nr: getTag(w, "NrWierszaFa") || "",
      opis: getTag(w, "P_7") || "-",
      jm: getTag(w, "P_8A") || "",
      ilosc: getTag(w, "P_8B") || "1",
      cenaNetto: getTag(w, "P_9A") || getTag(w, "P_9B") || "0",
      wartoscNetto: net,
      stawkaVat: vatRate,
      kwotaVat: vatNum.toFixed(2),
      brutto: (netNum + vatNum).toFixed(2),
    };
  });

  // VAT summary by rate
  const vatMap = new Map<string, { netto: number; vat: number }>();
  pozycje.forEach((p) => {
    const key = p.stawkaVat;
    const prev = vatMap.get(key) || { netto: 0, vat: 0 };
    prev.netto += parseFloat(p.wartoscNetto) || 0;
    prev.vat += parseFloat(p.kwotaVat) || 0;
    vatMap.set(key, prev);
  });
  const sumaNettoWgStawek = [...vatMap.entries()].map(([stawka, v]) => ({
    stawka,
    netto: v.netto.toFixed(2),
    vat: v.vat.toFixed(2),
  }));

  // Additional descriptions
  const uwagi: { klucz: string; wartosc: string }[] = [];
  const opisBlocks = getAllBlocks(fa, "DodatkowyOpis");
  opisBlocks.forEach((b) => {
    const k = getTag(b, "Klucz");
    const v = getTag(b, "Wartosc");
    if (k || v) uwagi.push({ klucz: k, wartosc: v });
  });

  const sumaNetto = getTag(fa, "P_13_1") || getTag(fa, "P_13_2") || "0";
  const sumaVat = getTag(fa, "P_14_1") || getTag(fa, "P_14_2") || "0";
  const sumaBrutto = getTag(fa, "P_15") || "0";

  return {
    ksefNumber,
    rodzajFaktury: getTag(fa, "RodzajFaktury") || "VAT",
    kodWaluty: getTag(fa, "KodWaluty") || "PLN",
    nrFaktury: getTag(fa, "P_2") || getTag(xml, "NrFaWewnetrzny") || ksefNumber,
    dataWystawienia: getTag(fa, "P_1") || getTag(xml, "DataWytworzeniaFa") || "",
    dataSprzedazy: getTag(fa, "P_6") || "",
    okresOd: getTag(getTag(fa, "OkresFa"), "P_6_Od") || "",
    okresDo: getTag(getTag(fa, "OkresFa"), "P_6_Do") || "",
    sprzedawca: parseParty(podmiot1),
    nabywca: parseParty(podmiot2),
    pozycje,
    sumaNettoWgStawek,
    sumaNetto,
    sumaVat,
    sumaBrutto,
    terminPlatnosci: getTag(getTag(platnosc, "TerminPlatnosci"), "Termin") || "",
    formaPlatnosci: getTag(platnosc, "FormaPlatnosci") || "",
    nrRachunku: getTag(getTag(platnosc, "RachunekBankowy"), "NrRB") || "",
    doZaplaty: getTag(rozliczenie, "DoZaplaty") || sumaBrutto,
    uwagi,
    stopka: getTag(getTag(stopkaBlock, "Informacje"), "StopkaFaktury") || "",
    krs: getTag(rejestry, "KRS") || "",
    regon: getTag(rejestry, "REGON") || "",
    bdo: getTag(rejestry, "BDO") || "",
  };
}

// ── PDF Generation (KSeF-compliant layout) ──

function fmtNum(val: string | number, currency = ""): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  const formatted = n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

export function generateInvoicePdf(inv: ParsedInvoice): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const m = 12; // margin
  const cw = pw - 2 * m;
  let y = 12;

  // Style helpers
  const bold = (s = 9) => { doc.setFont("helvetica", "bold"); doc.setFontSize(s); };
  const norm = (s = 8) => { doc.setFont("helvetica", "normal"); doc.setFontSize(s); };
  const clr = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const BLACK = () => clr(0, 0, 0);
  const GRAY = () => clr(90, 90, 90);
  const BLUE = () => clr(25, 65, 148);
  const line = (x1: number, y1: number, x2: number, y2: number, c = [200, 200, 200]) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(0.3);
    doc.line(x1, y1, x2, y2);
  };
  const checkPage = (need: number) => { if (y + need > 282) { doc.addPage(); y = 12; } };

  // ── 1. HEADER ──
  const rodzaj = RODZAJ_FAKTURY[inv.rodzajFaktury] || `Faktura ${inv.rodzajFaktury}`;
  bold(14); BLUE();
  doc.text(rodzaj.toUpperCase(), m, y);
  y += 1;
  line(m, y, pw - m, y, [25, 65, 148]);
  y += 5;

  // KSeF number
  norm(7); GRAY();
  doc.text(`Numer KSeF: ${inv.ksefNumber}`, m, y);
  y += 7;

  // ── 2. INVOICE INFO ──
  const infoLeft = [
    { label: "Numer faktury", value: inv.nrFaktury },
    { label: "Data wystawienia", value: inv.dataWystawienia },
  ];
  if (inv.dataSprzedazy) infoLeft.push({ label: "Data sprzedazy", value: inv.dataSprzedazy });
  if (inv.okresOd && inv.okresDo) infoLeft.push({ label: "Okres", value: `${inv.okresOd} - ${inv.okresDo}` });
  infoLeft.push({ label: "Waluta", value: inv.kodWaluty });

  const infoRight = [
    { label: "Forma platnosci", value: FORMA_PLATNOSCI[inv.formaPlatnosci] || inv.formaPlatnosci || "-" },
  ];
  if (inv.terminPlatnosci) infoRight.push({ label: "Termin platnosci", value: inv.terminPlatnosci });
  if (inv.nrRachunku) infoRight.push({ label: "Nr rachunku", value: inv.nrRachunku });

  const infoStartY = y;
  // Left column
  infoLeft.forEach((item) => {
    norm(7); GRAY();
    doc.text(item.label + ":", m, y);
    bold(8); BLACK();
    doc.text(item.value, m + 35, y);
    y += 4.5;
  });

  // Right column
  let yr = infoStartY;
  const rx = pw / 2 + 10;
  infoRight.forEach((item) => {
    norm(7); GRAY();
    doc.text(item.label + ":", rx, yr);
    bold(8); BLACK();
    doc.text(item.value, rx + 35, yr);
    yr += 4.5;
  });

  y = Math.max(y, yr) + 4;

  // ── 3. PARTIES ──
  const colW = cw / 2 - 3;
  const partyH = 26;

  // Seller
  doc.setFillColor(240, 243, 248);
  doc.rect(m, y, colW, partyH, "F");
  line(m, y, m + colW, y, [25, 65, 148]);

  bold(7); BLUE();
  doc.text("SPRZEDAWCA", m + 3, y + 4.5);
  bold(9); BLACK();
  const sellerLines = doc.splitTextToSize(inv.sprzedawca.nazwa, colW - 6);
  doc.text(sellerLines.slice(0, 2), m + 3, y + 9);
  norm(8); GRAY();
  doc.text(`NIP: ${inv.sprzedawca.nip}`, m + 3, y + 16);
  const sellerAddr = doc.splitTextToSize(inv.sprzedawca.adres, colW - 6);
  doc.text(sellerAddr.slice(0, 2), m + 3, y + 20);

  // Buyer
  const bx = m + colW + 6;
  doc.setFillColor(240, 243, 248);
  doc.rect(bx, y, colW, partyH, "F");
  line(bx, y, bx + colW, y, [25, 65, 148]);

  bold(7); BLUE();
  doc.text("NABYWCA", bx + 3, y + 4.5);
  bold(9); BLACK();
  const buyerLines = doc.splitTextToSize(inv.nabywca.nazwa, colW - 6);
  doc.text(buyerLines.slice(0, 2), bx + 3, y + 9);
  norm(8); GRAY();
  doc.text(`NIP: ${inv.nabywca.nip}`, bx + 3, y + 16);
  const buyerAddr = doc.splitTextToSize(inv.nabywca.adres, colW - 6);
  doc.text(buyerAddr.slice(0, 2), bx + 3, y + 20);

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
  doc.setFillColor(25, 65, 148);
  doc.rect(m, y, cw, 6, "F");
  bold(6.5);
  doc.setTextColor(255, 255, 255);
  let cx = m + 1;
  cols.forEach((col) => {
    if (col.align === "right") {
      doc.text(col.label, cx + col.w - 2, y + 4, { align: "right" });
    } else {
      doc.text(col.label, cx + 1, y + 4);
    }
    cx += col.w;
  });
  y += 6;

  // Table rows
  inv.pozycje.forEach((p, i) => {
    checkPage(5.5);
    if (i % 2 === 0) {
      doc.setFillColor(248, 249, 252);
      doc.rect(m, y - 0.5, cw, 5, "F");
    }
    norm(7); BLACK();
    cx = m + 1;
    const vals = [
      { v: p.nr || String(i + 1), a: "left" },
      { v: p.opis, a: "left", maxW: 50 },
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
        doc.text(text, cx + cols[j].w - 2, y + 3, { align: "right" });
      } else {
        doc.text(text, cx + 1, y + 3);
      }
      cx += cols[j].w;
    });
    y += 5;
  });

  // Table bottom line
  line(m, y, m + cw, y);
  y += 3;

  // ── 5. VAT SUMMARY ──
  checkPage(20);
  const sumX = m + cw - 90;

  bold(7); BLUE();
  doc.text("PODSUMOWANIE VAT", sumX, y);
  y += 4;

  // VAT summary header
  doc.setFillColor(240, 243, 248);
  doc.rect(sumX, y - 1, 90, 5, "F");
  bold(6.5); GRAY();
  doc.text("Stawka VAT", sumX + 2, y + 2.5);
  doc.text("Netto", sumX + 30, y + 2.5, { align: "right" });
  doc.text("VAT", sumX + 55, y + 2.5, { align: "right" });
  doc.text("Brutto", sumX + 88, y + 2.5, { align: "right" });
  y += 5;

  inv.sumaNettoWgStawek.forEach((s) => {
    norm(7); BLACK();
    doc.text(`${s.stawka}%`, sumX + 2, y + 2.5);
    doc.text(fmtNum(s.netto), sumX + 30, y + 2.5, { align: "right" });
    doc.text(fmtNum(s.vat), sumX + 55, y + 2.5, { align: "right" });
    const brutto = (parseFloat(s.netto) + parseFloat(s.vat)).toFixed(2);
    doc.text(fmtNum(brutto), sumX + 88, y + 2.5, { align: "right" });
    y += 4.5;
  });

  // Totals line
  line(sumX, y, sumX + 90, y, [25, 65, 148]);
  y += 1;
  bold(8); BLACK();
  doc.text("RAZEM:", sumX + 2, y + 3);
  doc.text(fmtNum(inv.sumaNetto), sumX + 30, y + 3, { align: "right" });
  doc.text(fmtNum(inv.sumaVat), sumX + 55, y + 3, { align: "right" });
  bold(9);
  doc.text(fmtNum(inv.sumaBrutto, inv.kodWaluty), sumX + 88, y + 3, { align: "right" });
  y += 8;

  // ── 6. AMOUNT DUE ──
  checkPage(14);
  doc.setFillColor(25, 65, 148);
  doc.rect(sumX, y, 90, 9, "F");
  bold(8);
  doc.setTextColor(255, 255, 255);
  doc.text("DO ZAPLATY:", sumX + 4, y + 6);
  bold(11);
  doc.text(fmtNum(inv.doZaplaty, inv.kodWaluty), sumX + 86, y + 6, { align: "right" });
  y += 14;

  // ── 7. ADDITIONAL DESCRIPTIONS ──
  if (inv.uwagi.length > 0) {
    checkPage(8 + inv.uwagi.length * 5);
    bold(7); BLUE();
    doc.text("INFORMACJE DODATKOWE", m, y);
    y += 4;
    inv.uwagi.forEach((u) => {
      norm(7); GRAY();
      doc.text(`${u.klucz}:`, m, y);
      y += 3.5;
      norm(7); BLACK();
      const lines = doc.splitTextToSize(u.wartosc, cw - 4);
      doc.text(lines.slice(0, 3), m + 2, y);
      y += lines.slice(0, 3).length * 3.5 + 2;
    });
    y += 2;
  }

  // ── 8. FOOTER ──
  // Registry info
  const footerParts: string[] = [];
  if (inv.krs) footerParts.push(`KRS: ${inv.krs}`);
  if (inv.regon) footerParts.push(`REGON: ${inv.regon}`);
  if (inv.bdo) footerParts.push(`BDO: ${inv.bdo}`);
  if (inv.stopka) footerParts.push(inv.stopka);

  if (footerParts.length > 0) {
    const fy = 278;
    line(m, fy, pw - m, fy);
    norm(6); GRAY();
    doc.text(footerParts.join("  |  "), pw / 2, fy + 3, { align: "center" });
  }

  // KSeF watermark
  norm(6); GRAY();
  doc.text(
    `Wizualizacja faktury ustrukturyzowanej KSeF  |  ${inv.ksefNumber}`,
    pw / 2,
    285,
    { align: "center" }
  );

  doc.save(`${inv.ksefNumber}.pdf`);
}
