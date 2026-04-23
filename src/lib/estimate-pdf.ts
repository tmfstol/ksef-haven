import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Estimate, EstimateStage, EstimateItem } from "@/hooks/useEstimates";
import type { Company } from "@/types/company";

// Polish -> ASCII transliteration (helvetica nie wspiera UTF-8)
const ascii = (s: string | null | undefined): string => {
  if (!s) return "";
  const map: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
    Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  };
  return String(s).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] || ch);
};

const fmt = (n: number) =>
  n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPLN = (n: number) => `${fmt(n)} PLN`;

interface Args {
  estimate: Estimate;
  stages: EstimateStage[];
  items: EstimateItem[];
  company: Company | null;
  variant: "client" | "internal";
}

// Paleta (RGB) - inspirowana Stripe/Linear
const COLOR = {
  ink: [15, 23, 42] as [number, number, number],
  inkSoft: [51, 65, 85] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  mutedLight: [148, 163, 184] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  borderSoft: [241, 245, 249] as [number, number, number],
  bgSoft: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  primary: [37, 99, 235] as [number, number, number],
  primarySoft: [239, 246, 255] as [number, number, number],
  emerald: [16, 185, 129] as [number, number, number],
  emeraldSoft: [236, 253, 245] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  rose: [225, 29, 72] as [number, number, number],
};

const PAGE = { w: 210, h: 297, ml: 16, mr: 16, mt: 18, mb: 22 };

export function generateEstimatePdf({ estimate, stages, items, company, variant }: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");

  const isClient = variant === "client";
  const docTitle = isClient ? "OFERTA HANDLOWA" : "KALKULACJA WEWNETRZNA";
  const docNumber = `${isClient ? "OF" : "KW"}/${new Date(estimate.created_at).getFullYear()}/${estimate.id.slice(0, 6).toUpperCase()}`;

  // ============ HEADER ============
  // Lewy akcent kolorowy
  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, 4, 38, "F");

  // Nazwa firmy (lewy gorny)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLOR.ink);
  doc.text(ascii(company?.name || "Twoja Firma"), PAGE.ml, 14);

  // Adres firmy
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  let cy = 19;
  if (company?.street) { doc.text(ascii(company.street), PAGE.ml, cy); cy += 3.5; }
  if (company?.postal_code || company?.city) {
    doc.text(ascii(`${company.postal_code ?? ""} ${company.city ?? ""}`.trim()), PAGE.ml, cy); cy += 3.5;
  }
  if (company?.nip) { doc.text(`NIP: ${company.nip}`, PAGE.ml, cy); cy += 3.5; }
  const contact: string[] = [];
  if (company?.email) contact.push(ascii(company.email));
  if (company?.phone) contact.push(ascii(company.phone));
  if (contact.length) doc.text(contact.join("  •  "), PAGE.ml, cy);

  // Tytul dokumentu (prawa strona)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLOR.ink);
  doc.text(docTitle, PAGE.w - PAGE.mr, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.muted);
  doc.text(`Nr: ${docNumber}`, PAGE.w - PAGE.mr, 19, { align: "right" });
  doc.text(`Data: ${new Date(estimate.created_at).toLocaleDateString("pl-PL")}`, PAGE.w - PAGE.mr, 23, { align: "right" });
  if (!isClient) {
    doc.setTextColor(...COLOR.amber);
    doc.text("DOKUMENT WEWNETRZNY", PAGE.w - PAGE.mr, 27, { align: "right" });
  }

  // Linia rozdzielajaca
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.2);
  doc.line(PAGE.ml, 42, PAGE.w - PAGE.mr, 42);

  // ============ INFO PROJEKTU + KLIENT ============
  let y = 50;
  const colW = (PAGE.w - PAGE.ml - PAGE.mr - 6) / 2;

  // Lewa karta: Projekt
  doc.setFillColor(...COLOR.bgSoft);
  doc.setDrawColor(...COLOR.borderSoft);
  doc.setLineWidth(0.2);
  doc.roundedRect(PAGE.ml, y, colW, 26, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.mutedLight);
  doc.text("PROJEKT", PAGE.ml + 4, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.ink);
  doc.text(ascii(estimate.nazwa_kosztorysu), PAGE.ml + 4, y + 11, { maxWidth: colW - 8 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.muted);
  doc.text(`Branza: ${ascii(estimate.branza)}`, PAGE.ml + 4, y + 18);
  doc.text(`Status: ${ascii(statusLabel(estimate.status))}`, PAGE.ml + 4, y + 22.5);

  // Prawa karta: Klient
  const rx = PAGE.ml + colW + 6;
  doc.setFillColor(...COLOR.bgSoft);
  doc.setDrawColor(...COLOR.borderSoft);
  doc.roundedRect(rx, y, colW, 26, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.mutedLight);
  doc.text("KLIENT", rx + 4, y + 5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.ink);
  doc.text(ascii(estimate.client_name || "—"), rx + 4, y + 11, { maxWidth: colW - 8 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.muted);
  doc.text(`Wazne do: ${addDays(new Date(estimate.created_at), 14).toLocaleDateString("pl-PL")}`, rx + 4, y + 18);
  doc.text(`Waluta: PLN`, rx + 4, y + 22.5);

  y += 34;

  // ============ POZYCJE - per etap ============
  const marzaMat = Number(estimate.marza_material || 0) / 100;
  const marzaRob = Number(estimate.marza_robocizna || 0) / 100;

  let totalMatClient = 0;
  let totalRobClient = 0;
  let totalMatBuy = 0;
  let totalRobBase = 0;

  const stagesToRender = stages.length > 0
    ? stages
    : [{ id: "_none", estimate_id: estimate.id, ordinal: 1, name: "Pozycje", description: null } as EstimateStage];

  for (let si = 0; si < stagesToRender.length; si++) {
    const stage = stagesToRender[si];
    const stageItems = items.filter((i) => (stages.length > 0 ? i.stage_id === stage.id : true));
    if (stageItems.length === 0) continue;

    if (y > 240) { doc.addPage(); y = PAGE.mt; }

    // Naglowek etapu (numer + nazwa)
    doc.setFillColor(...COLOR.primarySoft);
    doc.setDrawColor(...COLOR.primarySoft);
    doc.roundedRect(PAGE.ml, y, 7, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.primary);
    doc.text(String(si + 1), PAGE.ml + 3.5, y + 5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.ink);
    doc.text(ascii(stage.name), PAGE.ml + 11, y + 5);

    // Liczba pozycji + wartosc etapu
    let stageTotal = 0;
    for (const it of stageItems) {
      const matU = Number(it.cena_mat || 0) * (1 + marzaMat);
      const robU = Number(it.cena_rob || 0) * (1 + marzaRob);
      stageTotal += Number(it.ilosc) * (matU + robU);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.muted);
    doc.text(`${stageItems.length} poz.  •  ${fmtPLN(stageTotal)}`, PAGE.w - PAGE.mr, y + 5, { align: "right" });

    y += 10;

    // Tabela
    const head = isClient
      ? [["#", "Nazwa pozycji", "Ilosc", "J.m.", "C. mat.", "C. rob.", "Wartosc"]]
      : [["#", "Nazwa pozycji", "Ilosc", "J.m.", "Mat. zak.", "Mat. kl.", "Rob. baza", "Rob. kl.", "Wartosc"]];

    const body = stageItems.map((it, idx) => {
      const matClientUnit = Number(it.cena_mat || 0) * (1 + marzaMat);
      const robClientUnit = Number(it.cena_rob || 0) * (1 + marzaRob);
      const matSum = Number(it.ilosc) * matClientUnit;
      const robSum = Number(it.ilosc) * robClientUnit;
      const total = matSum + robSum;
      totalMatClient += matSum;
      totalRobClient += robSum;
      totalMatBuy += Number(it.ilosc) * Number(it.cena_mat || 0);
      totalRobBase += Number(it.ilosc) * Number(it.cena_rob || 0);

      const nameCell = ascii(it.nazwa) + (it.wymiary ? `\n${ascii(it.wymiary)}` : "");

      if (isClient) {
        return [
          String(idx + 1),
          nameCell,
          fmt(Number(it.ilosc)),
          ascii(it.jednostka),
          fmt(matClientUnit),
          fmt(robClientUnit),
          fmt(total),
        ];
      }
      return [
        String(idx + 1),
        nameCell,
        fmt(Number(it.ilosc)),
        ascii(it.jednostka),
        fmt(Number(it.cena_mat || 0)),
        fmt(matClientUnit),
        fmt(Number(it.cena_rob || 0)),
        fmt(robClientUnit),
        fmt(total),
      ];
    });

    autoTable(doc, {
      head,
      body,
      startY: y,
      theme: "plain",
      styles: {
        fontSize: 8.2,
        cellPadding: { top: 2.4, right: 2.5, bottom: 2.4, left: 2.5 },
        textColor: COLOR.inkSoft,
        lineColor: COLOR.borderSoft,
        lineWidth: 0.15,
        valign: "middle",
      },
      headStyles: {
        fillColor: COLOR.bgSoft,
        textColor: COLOR.muted,
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
        lineWidth: 0,
      },
      alternateRowStyles: { fillColor: [252, 253, 254] },
      columnStyles: isClient
        ? {
            0: { cellWidth: 8, halign: "center", textColor: COLOR.mutedLight },
            1: { cellWidth: "auto", fontStyle: "bold", textColor: COLOR.ink },
            2: { cellWidth: 16, halign: "right" },
            3: { cellWidth: 12, halign: "center", textColor: COLOR.muted },
            4: { cellWidth: 22, halign: "right" },
            5: { cellWidth: 22, halign: "right" },
            6: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: COLOR.ink },
          }
        : {
            0: { cellWidth: 7, halign: "center", textColor: COLOR.mutedLight },
            1: { cellWidth: "auto", fontStyle: "bold", textColor: COLOR.ink },
            2: { cellWidth: 13, halign: "right" },
            3: { cellWidth: 10, halign: "center", textColor: COLOR.muted },
            4: { cellWidth: 18, halign: "right", textColor: COLOR.muted },
            5: { cellWidth: 18, halign: "right" },
            6: { cellWidth: 18, halign: "right", textColor: COLOR.muted },
            7: { cellWidth: 18, halign: "right" },
            8: { cellWidth: 22, halign: "right", fontStyle: "bold", textColor: COLOR.ink },
          },
      margin: { left: PAGE.ml, right: PAGE.mr },
      didDrawPage: () => {
        drawPageChrome(doc, estimate, isClient, docNumber);
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ============ PODSUMOWANIE ============
  const summaryH = isClient ? 56 : 84;
  if (y > PAGE.h - PAGE.mb - summaryH) { doc.addPage(); y = PAGE.mt; }

  const sumW = 90;
  const sumX = PAGE.w - PAGE.mr - sumW;

  // Karta podsumowania
  doc.setFillColor(...COLOR.white);
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(sumX, y, sumW, summaryH, 2, 2, "FD");

  // Naglowek karty
  doc.setFillColor(...COLOR.bgSoft);
  doc.roundedRect(sumX, y, sumW, 8, 2, 2, "F");
  doc.rect(sumX, y + 4, sumW, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text("PODSUMOWANIE", sumX + 4, y + 5.5);

  let sy = y + 14;
  const rowH = 5.5;

  if (!isClient) {
    sumRow(doc, sumX, sy, sumW, "Materialy (zakup)", fmtPLN(totalMatBuy), false); sy += rowH;
    sumRow(doc, sumX, sy, sumW, "Robocizna (baza)", fmtPLN(totalRobBase), false); sy += rowH;

    // Marze
    doc.setDrawColor(...COLOR.borderSoft);
    doc.line(sumX + 4, sy, sumX + sumW - 4, sy);
    sy += 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR.mutedLight);
    doc.text(`Marza materialy: +${estimate.marza_material}%`, sumX + 4, sy + 2);
    doc.text(`Marza robocizna: +${estimate.marza_robocizna}%`, sumX + 4, sy + 6);
    sy += 10;
  }

  sumRow(doc, sumX, sy, sumW, "Materialy", fmtPLN(totalMatClient), false); sy += rowH;
  sumRow(doc, sumX, sy, sumW, "Robocizna", fmtPLN(totalRobClient), false); sy += rowH + 1;

  // RAZEM (wyrozniony)
  doc.setFillColor(...COLOR.ink);
  doc.roundedRect(sumX + 3, sy, sumW - 6, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.mutedLight);
  doc.text("RAZEM NETTO", sumX + 6, sy + 6.5);
  doc.setFontSize(12);
  doc.setTextColor(...COLOR.white);
  doc.text(fmtPLN(totalMatClient + totalRobClient), sumX + sumW - 6, sy + 7, { align: "right" });
  sy += 14;

  if (!isClient) {
    const zysk = (totalMatClient - totalMatBuy) + (totalRobClient - totalRobBase);
    const zyskPct = totalMatBuy + totalRobBase > 0 ? (zysk / (totalMatBuy + totalRobBase)) * 100 : 0;
    doc.setFillColor(...COLOR.emeraldSoft);
    doc.setDrawColor(...COLOR.emerald);
    doc.setLineWidth(0.2);
    doc.roundedRect(sumX + 3, sy, sumW - 6, 11, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.emerald);
    doc.text("ZYSK SZACOWANY", sumX + 6, sy + 4.5);
    doc.setFontSize(10);
    doc.text(fmtPLN(zysk), sumX + sumW - 6, sy + 4.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Marza ${zyskPct.toFixed(1)}%`, sumX + sumW - 6, sy + 9, { align: "right" });
  }

  // Lewa kolumna: notatka / warunki
  if (isClient) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text("WARUNKI OFERTY", PAGE.ml, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.inkSoft);
    const terms = [
      "•  Oferta wazna 14 dni od daty wystawienia",
      "•  Ceny netto, nalezy doliczyc VAT zgodnie z obowiazujacymi stawkami",
      "•  Termin realizacji do uzgodnienia po akceptacji oferty",
      "•  Platnosc zgodnie z umowa lub wystawiona faktura",
    ];
    let ty = y + 11;
    for (const t of terms) {
      doc.text(ascii(t), PAGE.ml, ty);
      ty += 4.5;
    }

    if (estimate.notes) {
      ty += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR.muted);
      doc.text("UWAGI", PAGE.ml, ty);
      ty += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR.inkSoft);
      const lines = doc.splitTextToSize(ascii(estimate.notes), sumX - PAGE.ml - 6);
      doc.text(lines, PAGE.ml, ty);
    }
  }

  // ============ STOPKA ============
  drawPageChrome(doc, estimate, isClient, docNumber);

  const safeName = estimate.nazwa_kosztorysu.replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${isClient ? "Oferta" : "Kalkulacja"}_${safeName}.pdf`);
}

// ===== Helpers =====
function sumRow(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  bold: boolean,
) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.muted);
  doc.text(label, x + 4, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLOR.ink);
  doc.text(value, x + w - 4, y, { align: "right" });
}

function drawPageChrome(doc: jsPDF, estimate: Estimate, isClient: boolean, docNumber: string) {
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  const totalPages = doc.getNumberOfPages();

  // Cienka linia stopki
  doc.setDrawColor(...COLOR.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(PAGE.ml, PAGE.h - 14, PAGE.w - PAGE.mr, PAGE.h - 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.mutedLight);
  doc.text(
    `${isClient ? "Oferta" : "Kalkulacja"}  •  ${docNumber}  •  ${ascii(estimate.nazwa_kosztorysu)}`,
    PAGE.ml,
    PAGE.h - 9,
  );
  doc.text(`Strona ${pageNum} / ${totalPages}`, PAGE.w - PAGE.mr, PAGE.h - 9, { align: "right" });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    draft: "Szkic",
    sent: "Wyslana",
    accepted: "Zaakceptowana",
    rejected: "Odrzucona",
    archived: "Archiwum",
  };
  return map[s] || s;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
