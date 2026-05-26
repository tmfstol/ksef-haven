// "Portal Dokumentów" style invoice PDF generator.
// Mimics the Insert "Portal Dokumentów" layout (compact, cards, centered title, items table,
// VAT table, payment section, KSeF QR box at the bottom).
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import QRCode from "qrcode";
import type { ParsedInvoice } from "./invoice-pdf";

// Register Roboto fonts (supports Polish characters).
type PdfDocInst = {
  getBase64: () => Promise<string>;
  getBlob?: () => Promise<Blob>;
};
type PdfMakeAny = {
  vfs?: Record<string, string>;
  addVirtualFileSystem?: (v: Record<string, string>) => void;
  createPdf: (doc: unknown) => PdfDocInst;
};
const pm = pdfMake as unknown as PdfMakeAny;
const vfsObj: Record<string, string> = (pdfFonts as unknown as { vfs?: Record<string, string> })?.vfs
  ?? (pdfFonts as unknown as Record<string, string>);
if (typeof pm.addVirtualFileSystem === "function") {
  pm.addVirtualFileSystem(vfsObj);
} else {
  pm.vfs = vfsObj;
}
console.log("[invoice-pdf-portal] vfs files:", Object.keys(vfsObj || {}).length);

const GRAY_HEADER = "#e5e7ec";
const BORDER = "#cfd4dc";
const TEXT_MUTED = "#6b7280";

const PAYMENT_FORMS: Record<string, string> = {
  "1": "Gotówka",
  "2": "Karta",
  "3": "Bon",
  "4": "Czek",
  "5": "Kredyt",
  "6": "Przelew",
  "7": "Mobilna",
};

const INVOICE_TITLES: Record<string, string> = {
  VAT: "Faktura VAT sprzedaży",
  KOR: "Faktura korygująca",
  ZAL: "Faktura zaliczkowa",
  ROZ: "Faktura rozliczeniowa",
  UPR: "Faktura uproszczona",
};

function fmtMoney(value: string | number | undefined | null): string {
  const n = typeof value === "number" ? value : parseFloat(String(value || "0").replace(",", "."));
  if (!Number.isFinite(n)) return "0,00";
  return n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function fmtQty(value: string | number | undefined | null): string {
  const n = typeof value === "number" ? value : parseFloat(String(value || "0").replace(",", "."));
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

function fmtVatRate(v: string): string {
  if (!v) return "";
  const trimmed = v.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}%`;
  // KSeF codes: zw, np, oo, 0, etc.
  if (trimmed.toLowerCase() === "zw") return "zw.";
  if (trimmed.toLowerCase() === "np") return "np.";
  if (trimmed.toLowerCase() === "oo") return "oo";
  return trimmed;
}

function fmtPaymentForm(code: string): string {
  return PAYMENT_FORMS[code] || code || "—";
}

async function buildKsefQrUrl(xml: string, nipSprzedawcy: string, dataWystawienia: string): Promise<string> {
  const data = new TextEncoder().encode(xml);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const hashB64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const cleanNip = (nipSprzedawcy || "").replace(/[^0-9]/g, "");
  let date = dataWystawienia || "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (iso) date = `${iso[3]}-${iso[2]}-${iso[1]}`;
  return `https://qr.ksef.mf.gov.pl/invoice/${cleanNip}/${date}/${hashB64}`;
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function titleForInvoice(inv: ParsedInvoice): string {
  const base = INVOICE_TITLES[inv.rodzajFaktury?.toUpperCase()] || "Faktura";
  return `${base} ${inv.nrFaktury || inv.ksefNumber || ""}`.trim();
}

interface PdfDoc extends PdfDocInst {}

export async function generatePortalInvoicePdfBase64(inv: ParsedInvoice, xml: string): Promise<string> {
  const qrUrl = await buildKsefQrUrl(xml, inv.sprzedawca?.nip || "", inv.dataWystawienia || "");
  const qrPng = await QRCode.toDataURL(qrUrl, { width: 320, margin: 1, errorCorrectionLevel: "M" });

  const currency = inv.kodWaluty || "PLN";
  const isEur = currency === "EUR";
  const withPrefix = (val: string | undefined, prefix: string) => {
    const v = (val || "").trim();
    if (!v) return "—";
    return /^[A-Z]{2}/i.test(v) ? v : `${prefix}${v}`;
  };
  const sellerNip = isEur ? withPrefix(inv.sprzedawca?.nip, "PL") : (inv.sprzedawca?.nip || "—");
  const buyerNip = isEur ? withPrefix(inv.nabywca?.nip, "DE") : (inv.nabywca?.nip || "—");
  const accountNr = isEur ? withPrefix(inv.nrRachunku, "PL") : (inv.nrRachunku || "");
  const itemsBody = [
    [
      { text: "LP", style: "thHead", alignment: "center" },
      { text: "Nazwa", style: "thHead", alignment: "center" },
      { text: "J.m.", style: "thHead", alignment: "center" },
      { text: "Ilość", style: "thHead", alignment: "center" },
      { text: "Cena netto", style: "thHead", alignment: "right" },
      { text: "Wartość netto", style: "thHead", alignment: "right" },
      { text: "Stawka VAT", style: "thHead", alignment: "center" },
      { text: "Wartość brutto", style: "thHead", alignment: "right" },
    ],
    ...inv.pozycje.map((p, i) => [
      { text: String(p.nr || i + 1), alignment: "center", style: "td" },
      { text: p.opis || "—", style: "td" },
      { text: p.jm || "", alignment: "center", style: "td" },
      { text: fmtQty(p.ilosc), alignment: "center", style: "td" },
      { text: fmtMoney(p.cenaNetto), alignment: "right", style: "td" },
      { text: fmtMoney(p.wartoscNetto), alignment: "right", style: "td" },
      { text: fmtVatRate(p.stawkaVat), alignment: "center", style: "td" },
      { text: fmtMoney(p.brutto), alignment: "right", style: "td" },
    ]),
  ];

  const vatBody = [
    [
      { text: "Nazwa stawki VAT", style: "thHead" },
      { text: "Wartość netto", style: "thHead", alignment: "right" },
      { text: "Kwota VAT", style: "thHead", alignment: "right" },
      { text: "Wartość brutto", style: "thHead", alignment: "right" },
    ],
    ...inv.sumaNettoWgStawek.map((s) => {
      const brutto = (parseFloat(s.netto || "0") + parseFloat(s.vat || "0")).toFixed(2);
      return [
        { text: fmtVatRate(s.stawka), style: "td" },
        { text: fmtMoney(s.netto), alignment: "right", style: "td" },
        { text: fmtMoney(s.vat), alignment: "right", style: "td" },
        { text: fmtMoney(brutto), alignment: "right", style: "td" },
      ];
    }),
    [
      { text: "Razem:", style: "tdBold" },
      { text: fmtMoney(inv.sumaNetto), alignment: "right", style: "tdBold" },
      { text: fmtMoney(inv.sumaVat), alignment: "right", style: "tdBold" },
      { text: fmtMoney(inv.sumaBrutto), alignment: "right", style: "tdBold" },
    ],
  ];

  const cardLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => BORDER,
    vLineColor: () => BORDER,
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
    fillColor: (i: number) => (i === 0 ? GRAY_HEADER : null),
  };

  const tableLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => BORDER,
    vLineColor: () => BORDER,
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 5,
    paddingBottom: () => 5,
    fillColor: (i: number) => (i === 0 ? GRAY_HEADER : null),
  };

  // Payment info string
  const paymentInfoLines: string[] = [];
  if (inv.opisPlatnosci) paymentInfoLines.push(inv.opisPlatnosci);
  if (inv.terminPlatnosci) paymentInfoLines.push(`Termin płatności: ${inv.terminPlatnosci}`);
  if (inv.nrRachunku) paymentInfoLines.push(`Nr rachunku: ${inv.nrRachunku}${inv.nazwaBanku ? ` (${inv.nazwaBanku})` : ""}`);
  const paymentInfo = paymentInfoLines.join("\n") || "—";

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [32, 28, 32, 36] as [number, number, number, number],
    defaultStyle: { font: "Roboto", fontSize: 9, color: "#111827", lineHeight: 1.15 },
    header: () => ({
      columns: [
        { text: nowStamp(), fontSize: 8, color: TEXT_MUTED, margin: [32, 12, 0, 0] },
        { text: "Portal Dokumentów", fontSize: 8, color: TEXT_MUTED, alignment: "right", margin: [0, 12, 32, 0] },
      ],
    }),
    content: [
      // Top: brand + date boxes
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Krajowy System", fontSize: 14, bold: true, color: "#111827" },
              {
                text: [
                  { text: "e", color: "#e11d48", bold: true },
                  { text: "-Faktur", bold: true, color: "#111827" },
                ],
                fontSize: 14,
                margin: [0, 1, 0, 0],
              },
            ],
            margin: [0, 4, 0, 0],
          },
          {
            width: "*",
            table: {
              widths: ["*", "*"],
              body: [
                [
                  { text: "Data wystawienia", style: "thHead", alignment: "center" },
                  { text: "Data zakończenia dostawy/usług", style: "thHead", alignment: "center" },
                ],
                [
                  { text: inv.dataWystawienia || "—", alignment: "center", style: "td" },
                  { text: inv.dataSprzedazy || inv.dataWystawienia || "—", alignment: "center", style: "td" },
                ],
              ],
            },
            layout: cardLayout,
          },
        ],
        columnGap: 12,
      },

      { text: "", margin: [0, 0, 0, 10] },

      // Sprzedawca / Nabywca cards
      {
        columns: [
          {
            width: "*",
            table: {
              widths: ["*"],
              body: [
                [{ text: "Sprzedawca", style: "thHead", alignment: "center" }],
                [
                  {
                    stack: [
                      { text: inv.sprzedawca?.nazwa || "—", bold: true, fontSize: 9 },
                      { text: `NIP: ${inv.sprzedawca?.nip || "—"}`, fontSize: 8, margin: [0, 2, 0, 0] },
                      { text: inv.sprzedawca?.adres || "", fontSize: 8, margin: [0, 2, 0, 0] },
                    ],
                  },
                ],
              ],
            },
            layout: cardLayout,
          },
          {
            width: "*",
            table: {
              widths: ["*"],
              body: [
                [{ text: "Nabywca", style: "thHead", alignment: "center" }],
                [
                  {
                    stack: [
                      { text: inv.nabywca?.nazwa || "—", bold: true, fontSize: 9 },
                      { text: `NIP: ${inv.nabywca?.nip || "—"}`, fontSize: 8, margin: [0, 2, 0, 0] },
                      { text: inv.nabywca?.adres || "", fontSize: 8, margin: [0, 2, 0, 0] },
                    ],
                  },
                ],
              ],
            },
            layout: cardLayout,
          },
        ],
        columnGap: 12,
      },

      { text: "", margin: [0, 0, 0, 14] },

      // Centered title
      { text: titleForInvoice(inv), alignment: "center", fontSize: 15, bold: true, margin: [0, 6, 0, 4] },
      {
        text: [
          { text: "Numer KSeF: ", bold: true },
          { text: inv.ksefNumber || "—" },
        ],
        alignment: "center",
        fontSize: 9,
      },
      {
        text: [
          { text: "Data nadania numeru KSeF: ", bold: true },
          { text: inv.dataWystawienia || "—" },
        ],
        alignment: "center",
        fontSize: 9,
        margin: [0, 2, 0, 12],
      },

      // Items table
      {
        table: {
          headerRows: 1,
          widths: [20, "*", 28, 32, 50, 55, 42, 60],
          body: itemsBody,
        },
        layout: tableLayout,
      },

      // Total
      {
        text: [
          { text: "Kwota należności ogółem: ", bold: true, fontSize: 11 },
          { text: `${fmtMoney(inv.doZaplaty || inv.sumaBrutto)} ${currency}`, bold: true, fontSize: 11 },
        ],
        alignment: "right",
        margin: [0, 10, 0, 14],
      },

      // VAT table
      { text: `Tabela VAT - ${currency}`, bold: true, fontSize: 11, margin: [0, 0, 0, 6] },
      {
        table: {
          headerRows: 1,
          widths: ["*", 100, 100, 100],
          body: vatBody,
        },
        layout: tableLayout,
      },

      { text: "", margin: [0, 0, 0, 12] },

      // Payment
      { text: "Płatność", bold: true, fontSize: 11, margin: [0, 0, 0, 4] },
      {
        text: [
          { text: "Informacja o płatności: ", bold: true },
          { text: paymentInfo },
        ],
        fontSize: 9,
      },
      {
        text: [
          { text: "Forma płatności: ", bold: true },
          { text: fmtPaymentForm(inv.formaPlatnosci) },
        ],
        fontSize: 9,
        margin: [0, 3, 0, 12],
      },

      // Divider
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 531, y2: 0, lineWidth: 0.5, lineColor: BORDER }],
        margin: [0, 0, 0, 10],
      },

      // KSeF QR box
      { text: "Faktura zarejestrowana w Krajowym Systemie e-Faktur", bold: true, fontSize: 10, margin: [0, 0, 0, 8] },
      {
        columns: [
          {
            width: 110,
            stack: [
              { image: qrPng, width: 100, height: 100 },
              { text: inv.ksefNumber || "", fontSize: 6, color: TEXT_MUTED, alignment: "center", margin: [0, 4, 0, 0] },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "Sprawdź dokument w systemie", fontSize: 9, color: "#111827", margin: [0, 6, 0, 4] },
              { text: qrUrl, link: qrUrl, color: "#2563eb", fontSize: 8, decoration: "underline" },
            ],
          },
        ],
        columnGap: 12,
      },
    ],
    styles: {
      thHead: { bold: true, fontSize: 8, color: "#1f2937" },
      td: { fontSize: 8.5, color: "#111827" },
      tdBold: { fontSize: 8.5, color: "#111827", bold: true },
    },
  };

  console.log("[invoice-pdf-portal] createPdf… items:", inv.pozycje?.length);
  const pdf = pm.createPdf(docDefinition as Parameters<typeof pdfMake.createPdf>[0]) as unknown as PdfDoc;
  console.log("[invoice-pdf-portal] pdf object ready, awaiting getBase64()");
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("PDF generation timeout (30s)")), 30_000)
  );
  const b64 = await Promise.race([pdf.getBase64(), timeoutPromise]);
  console.log("[invoice-pdf-portal] getBase64 OK length:", b64?.length);
  return b64;
}
