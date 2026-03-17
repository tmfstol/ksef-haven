import { jsPDF } from "jspdf";

interface ParsedInvoice {
  invoiceNumber: string;
  issueDate: string;
  sellerName: string;
  sellerNip: string;
  sellerAddress: string;
  buyerName: string;
  buyerNip: string;
  buyerAddress: string;
  lines: { desc: string; unit: string; qty: string; price: string; net: string; vatRate: string; vat: string; gross: string }[];
  totalNet: string;
  totalVat: string;
  totalGross: string;
  ksefNumber: string;
}

function getTagValue(xml: string, tag: string): string {
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

export function parseKsefXml(xml: string, ksefNumber: string): ParsedInvoice {
  const faBlock = getTagValue(xml, "Fa") || xml;
  const podmiot1 = getTagValue(xml, "Podmiot1");
  const podmiot2 = getTagValue(xml, "Podmiot2");

  const sellerIdent = getTagValue(podmiot1, "DaneIdentyfikacyjne");
  const buyerIdent = getTagValue(podmiot2, "DaneIdentyfikacyjne");
  const sellerAddr = getTagValue(podmiot1, "Adres");
  const buyerAddr = getTagValue(podmiot2, "Adres");

  const fmtAddr = (block: string) => {
    const street = getTagValue(block, "Ulica");
    const addrL1 = getTagValue(block, "AdresL1");
    const addrL2 = getTagValue(block, "AdresL2");
    if (addrL1 || addrL2) return [addrL1, addrL2].filter(Boolean).join(", ");
    const nr = getTagValue(block, "NrDomu");
    const nrLok = getTagValue(block, "NrLokalu");
    const code = getTagValue(block, "KodPocztowy");
    const city = getTagValue(block, "Miejscowosc");
    return [street, [nr, nrLok].filter(Boolean).join("/"), [code, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  };

  const wiersze = getAllBlocks(faBlock, "FaWiersz");
  const lines = wiersze.map((w) => {
    const net = getTagValue(w, "P_11") || "0";
    const vatRate = getTagValue(w, "P_12") || "0";
    const netNum = parseFloat(net) || 0;
    const vatNum = netNum * (parseFloat(vatRate) / 100);
    return {
      desc: getTagValue(w, "P_7") || "-",
      unit: getTagValue(w, "P_8A") || "szt.",
      qty: getTagValue(w, "P_8B") || "1",
      price: getTagValue(w, "P_9A") || getTagValue(w, "P_9B") || "0",
      net,
      vatRate,
      vat: vatNum.toFixed(2),
      gross: (netNum + vatNum).toFixed(2),
    };
  });

  const totalNet = getTagValue(faBlock, "P_13_1") || getTagValue(faBlock, "P_13_2") || "0";
  const totalVat = getTagValue(faBlock, "P_14_1") || getTagValue(faBlock, "P_14_2") || "0";
  const totalGross = getTagValue(faBlock, "P_15") || "0";

  return {
    invoiceNumber: getTagValue(faBlock, "P_2") || getTagValue(xml, "NrFaWewnetrzny") || ksefNumber,
    issueDate: getTagValue(faBlock, "P_1") || getTagValue(xml, "DataWytworzeniaFa") || "",
    sellerName: getTagValue(sellerIdent, "Nazwa") || getTagValue(sellerIdent, "PelnaNazwa") || "",
    sellerNip: getTagValue(sellerIdent, "NIP") || getTagValue(podmiot1, "NIP") || "",
    sellerAddress: fmtAddr(sellerAddr),
    buyerName: getTagValue(buyerIdent, "Nazwa") || getTagValue(buyerIdent, "PelnaNazwa") || "",
    buyerNip: getTagValue(buyerIdent, "NIP") || getTagValue(podmiot2, "NIP") || "",
    buyerAddress: fmtAddr(buyerAddr),
    lines,
    totalNet,
    totalVat,
    totalGross,
    ksefNumber,
  };
}

export function generateInvoicePdf(inv: ParsedInvoice): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = 210;
  const margin = 15;
  const cw = pw - 2 * margin;
  let y = 15;

  const bold = (size = 10) => { doc.setFont("helvetica", "bold"); doc.setFontSize(size); };
  const normal = (size = 9) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); };
  const gray = () => doc.setTextColor(100, 100, 100);
  const black = () => doc.setTextColor(0, 0, 0);

  // Header
  bold(16); black();
  doc.text("FAKTURA", margin, y);
  normal(9); gray();
  doc.text(`KSeF: ${inv.ksefNumber}`, pw - margin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Invoice info
  bold(11); black();
  doc.text(`Nr: ${inv.invoiceNumber}`, margin, y);
  normal(10);
  doc.text(`Data wystawienia: ${inv.issueDate}`, pw - margin, y, { align: "right" });
  y += 10;

  // Seller / Buyer
  const colW = cw / 2 - 5;

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y - 4, colW, 28, 2, 2, "F");
  bold(8); gray();
  doc.text("SPRZEDAWCA", margin + 4, y);
  y += 5;
  bold(10); black();
  doc.text(inv.sellerName.substring(0, 40), margin + 4, y);
  normal(9); gray();
  y += 5;
  doc.text(`NIP: ${inv.sellerNip}`, margin + 4, y);
  y += 4;
  doc.text(inv.sellerAddress.substring(0, 45), margin + 4, y);

  let yb = y - 14;
  const bx = margin + colW + 10;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(bx, yb - 4, colW, 28, 2, 2, "F");
  bold(8); gray();
  doc.text("NABYWCA", bx + 4, yb);
  yb += 5;
  bold(10); black();
  doc.text(inv.buyerName.substring(0, 40), bx + 4, yb);
  normal(9); gray();
  yb += 5;
  doc.text(`NIP: ${inv.buyerNip}`, bx + 4, yb);
  yb += 4;
  doc.text(inv.buyerAddress.substring(0, 45), bx + 4, yb);

  y += 14;

  // Table header
  const cols = [
    { label: "Lp.", w: 10 },
    { label: "Opis", w: 55 },
    { label: "J.m.", w: 12 },
    { label: "Ilosc", w: 15 },
    { label: "Cena netto", w: 22 },
    { label: "Netto", w: 22 },
    { label: "VAT%", w: 14 },
    { label: "VAT", w: 16 },
    { label: "Brutto", w: 22 },
  ];
  doc.setFillColor(59, 130, 246);
  doc.rect(margin, y - 4, cw, 7, "F");
  bold(7);
  doc.setTextColor(255, 255, 255);
  let cx = margin + 2;
  for (const col of cols) {
    doc.text(col.label, cx, y);
    cx += col.w;
  }
  y += 6;

  // Table rows
  normal(8); black();
  inv.lines.forEach((line, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(margin, y - 3.5, cw, 6, "F");
    }
    cx = margin + 2;
    const vals = [String(i + 1), line.desc.substring(0, 30), line.unit, line.qty, line.price, line.net, line.vatRate, line.vat, line.gross];
    vals.forEach((v, j) => {
      doc.text(v, cx, y);
      cx += cols[j].w;
    });
    y += 6;
  });

  // Totals
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin + cw - 70, y - 2, margin + cw, y - 2);
  y += 2;
  const totX = margin + cw - 70;
  normal(9); gray();
  doc.text("Razem netto:", totX, y); bold(9); black(); doc.text(`${inv.totalNet} PLN`, margin + cw, y, { align: "right" }); y += 5;
  normal(9); gray();
  doc.text("Razem VAT:", totX, y); bold(9); black(); doc.text(`${inv.totalVat} PLN`, margin + cw, y, { align: "right" }); y += 5;
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(totX, y - 1, margin + cw, y - 1);
  y += 2;
  bold(12); black();
  doc.text("Do zaplaty:", totX, y); doc.text(`${inv.totalGross} PLN`, margin + cw, y, { align: "right" });

  // Footer
  y = 285;
  normal(7); gray();
  doc.text(`Wygenerowano z KSeF | ${inv.ksefNumber}`, pw / 2, y, { align: "center" });

  doc.save(`${inv.ksefNumber}.pdf`);
}
