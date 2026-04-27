import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Estimate, EstimateStage, EstimateItem } from "@/hooks/useEstimates";
import type { Company } from "@/types/company";

// ============================================================
// PDF KOSZTORYSU w stylu Norma PRO / KNR
// Strona tytułowa + ogólna charakterystyka + kosztorys
// szczegółowy z numerami KNR + zestawienia RMS (R, M, S)
// ============================================================

const ascii = (s: string | null | undefined): string => {
  if (!s) return "";
  const map: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
    Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  };
  return String(s).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] || ch);
};

const fmt = (n: number) =>
  Number(n || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number, d = 3) =>
  Number(n || 0).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });

interface Args {
  estimate: Estimate;
  stages: EstimateStage[];
  items: EstimateItem[];
  company: Company | null;
}

const COLOR = {
  ink: [15, 23, 42] as [number, number, number],
  inkSoft: [51, 65, 85] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  mutedLight: [148, 163, 184] as [number, number, number],
  border: [180, 188, 200] as [number, number, number],
  borderSoft: [220, 226, 234] as [number, number, number],
  bgSoft: [245, 247, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  primary: [30, 58, 138] as [number, number, number], // Norma PRO granat
  primarySoft: [232, 238, 250] as [number, number, number],
};

const PAGE = { w: 210, h: 297, ml: 14, mr: 14, mt: 16, mb: 18 };

function calcRMS(it: EstimateItem) {
  const r = Number(it.ilosc) * Number(it.naklad_robocizny || 0) * Number(it.stawka_rg || 0);
  const m = Number(it.ilosc) * Number(it.naklad_materialu || 0) * Number(it.cena_mat || 0);
  const s = Number(it.ilosc) * Number(it.naklad_sprzetu || 0) * Number(it.cena_sprz || 0);
  return { r, m, s, total: r + m + s };
}

export function generateEstimatePdf({ estimate, stages, items, company }: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");

  const docNumber = `${new Date(estimate.created_at).getFullYear()}/${estimate.id.slice(0, 6).toUpperCase()}`;
  const dataKosztorysu = estimate.data_kosztorysu
    ? new Date(estimate.data_kosztorysu).toLocaleDateString("pl-PL")
    : new Date(estimate.created_at).toLocaleDateString("pl-PL");

  // Sumy globalne
  let sumR = 0, sumM = 0, sumS = 0;
  for (const it of items) {
    const v = calcRMS(it);
    sumR += v.r; sumM += v.m; sumS += v.s;
  }
  const kp = (sumR + sumS) * (Number(estimate.narzut_kp_proc || 0) / 100);
  const subtotal = sumR + sumM + sumS + kp;
  const zysk = subtotal * (Number(estimate.narzut_zysk_proc || 0) / 100);
  const netto = subtotal + zysk;
  const vat = netto * (Number(estimate.vat_proc || 23) / 100);
  const brutto = netto + vat;

  // ====================================================
  // STRONA 1: TYTUŁOWA
  // ====================================================
  // Górna ramka granatowa
  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, PAGE.w, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLOR.white);
  doc.text("KOSZTORYS", PAGE.w / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(ascii(estimate.podstawa_opracowania || "KNR - Katalog Nakladow Rzeczowych"), PAGE.w / 2, 22, { align: "center" });
  doc.setFontSize(8);
  doc.text(`Nr: ${docNumber}`, PAGE.w / 2, 27, { align: "center" });

  let y = 48;

  // Nazwa obiektu / kosztorysu
  doc.setFillColor(...COLOR.bgSoft);
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.rect(PAGE.ml, y, PAGE.w - PAGE.ml - PAGE.mr, 22, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text("NAZWA INWESTYCJI", PAGE.ml + 3, y + 5);
  doc.setFontSize(14);
  doc.setTextColor(...COLOR.ink);
  doc.text(ascii(estimate.nazwa_kosztorysu), PAGE.ml + 3, y + 12, { maxWidth: PAGE.w - PAGE.ml - PAGE.mr - 6 });
  if (estimate.lokalizacja_obiektu) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR.inkSoft);
    doc.text(`Lokalizacja: ${ascii(estimate.lokalizacja_obiektu)}`, PAGE.ml + 3, y + 18);
  }
  y += 28;

  // Inwestor / Wykonawca - dwie kolumny
  const colW = (PAGE.w - PAGE.ml - PAGE.mr - 4) / 2;
  drawPartyBox(doc, PAGE.ml, y, colW, "INWESTOR", estimate.inwestor_nazwa, estimate.inwestor_adres);
  drawPartyBox(doc, PAGE.ml + colW + 4, y, colW, "WYKONAWCA",
    estimate.wykonawca_nazwa ?? company?.name ?? null,
    estimate.wykonawca_adres ?? [company?.street, `${company?.postal_code ?? ""} ${company?.city ?? ""}`.trim(), company?.nip ? `NIP: ${company.nip}` : null].filter(Boolean).join("\n"));
  y += 38;

  // Wartości kosztorysu — duże pole
  doc.setFillColor(...COLOR.primarySoft);
  doc.setDrawColor(...COLOR.primary);
  doc.setLineWidth(0.4);
  doc.rect(PAGE.ml, y, PAGE.w - PAGE.ml - PAGE.mr, 56, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.primary);
  doc.text("WARTOSC KOSZTORYSOWA ROBOT", PAGE.ml + 4, y + 6);

  // Tabelka wartości
  const rowsTitle: [string, number][] = [
    ["Robocizna (R)", sumR],
    ["Materialy (M)", sumM],
    ["Sprzet (S)", sumS],
    [`Koszty posrednie Kp ${estimate.narzut_kp_proc}% (od R+S)`, kp],
    [`Zysk Z ${estimate.narzut_zysk_proc}%`, zysk],
  ];
  let ty = y + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const [label, val] of rowsTitle) {
    doc.setTextColor(...COLOR.inkSoft);
    doc.text(ascii(label), PAGE.ml + 6, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR.ink);
    doc.text(`${fmt(val)} PLN`, PAGE.w - PAGE.mr - 6, ty, { align: "right" });
    doc.setFont("helvetica", "normal");
    ty += 5;
  }
  // Linia
  doc.setDrawColor(...COLOR.primary);
  doc.setLineWidth(0.3);
  doc.line(PAGE.ml + 4, ty - 2, PAGE.w - PAGE.mr - 4, ty - 2);
  // RAZEM NETTO
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.primary);
  doc.text("RAZEM NETTO", PAGE.ml + 6, ty + 4);
  doc.setFontSize(13);
  doc.text(`${fmt(netto)} PLN`, PAGE.w - PAGE.mr - 6, ty + 4, { align: "right" });
  // VAT + brutto
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR.inkSoft);
  doc.text(`VAT ${estimate.vat_proc}%`, PAGE.ml + 6, ty + 10);
  doc.text(`${fmt(vat)} PLN`, PAGE.w - PAGE.mr - 6, ty + 10, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.ink);
  doc.text("BRUTTO", PAGE.ml + 6, ty + 15);
  doc.text(`${fmt(brutto)} PLN`, PAGE.w - PAGE.mr - 6, ty + 15, { align: "right" });

  y += 64;

  // Podstawa opracowania + data
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text("PODSTAWA OPRACOWANIA", PAGE.ml, y);
  doc.text("DATA OPRACOWANIA", PAGE.w - PAGE.mr, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.ink);
  doc.text(ascii(estimate.podstawa_opracowania || "KNR - Katalog Nakladow Rzeczowych"), PAGE.ml, y + 5);
  doc.text(dataKosztorysu, PAGE.w - PAGE.mr, y + 5, { align: "right" });

  y += 18;

  // Podpisy — dwa pola
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.ml, y + 18, PAGE.ml + 70, y + 18);
  doc.line(PAGE.w - PAGE.mr - 70, y + 18, PAGE.w - PAGE.mr, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.muted);
  doc.text("Sporzadzil (Wykonawca)", PAGE.ml + 35, y + 22, { align: "center" });
  doc.text("Sprawdzil / Zatwierdzil (Inwestor)", PAGE.w - PAGE.mr - 35, y + 22, { align: "center" });

  drawFooter(doc, docNumber, estimate);

  // ====================================================
  // STRONA 2+: KOSZTORYS SZCZEGÓŁOWY
  // ====================================================
  doc.addPage();
  y = PAGE.mt;
  drawSectionHeader(doc, y, "KOSZTORYS SZCZEGOLOWY");
  y += 12;

  const stagesToRender = stages.length > 0
    ? stages
    : [{ id: "_none", estimate_id: estimate.id, ordinal: 1, name: "Pozycje", description: null } as EstimateStage];

  let posCounter = 0;
  for (let si = 0; si < stagesToRender.length; si++) {
    const stage = stagesToRender[si];
    const stageItems = items.filter((i) => (stages.length > 0 ? i.stage_id === stage.id : true));
    if (stageItems.length === 0) continue;

    if (y > 250) { doc.addPage(); y = PAGE.mt; }

    // Nagłówek elementu scalonego
    doc.setFillColor(...COLOR.primary);
    doc.rect(PAGE.ml, y, PAGE.w - PAGE.ml - PAGE.mr, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR.white);
    doc.text(ascii(`${si + 1}. ${stage.name}`), PAGE.ml + 3, y + 5);
    let stageTotal = 0;
    for (const it of stageItems) stageTotal += calcRMS(it).total;
    doc.text(`${fmt(stageTotal)} PLN`, PAGE.w - PAGE.mr - 3, y + 5, { align: "right" });
    y += 10;

    // Tabela pozycji
    const body: any[] = [];
    for (const it of stageItems) {
      posCounter++;
      const v = calcRMS(it);
      // Wiersz główny: numer | KNR | nazwa | jm | ilość | wart. R | wart. M | wart. S | razem
      body.push([
        String(posCounter),
        ascii(it.knr_number || "—"),
        ascii(it.opis_pelny || it.nazwa),
        ascii(it.jednostka),
        fmtN(Number(it.ilosc), 2),
        fmt(v.r),
        fmt(v.m),
        fmt(v.s),
        fmt(v.total),
      ]);
      // Wiersz pod-info: nakłady jednostkowe (analogia "Robocizna razem", "Materialy razem", "Sprzet razem" w Norma PRO)
      const detail = [
        Number(it.naklad_robocizny) > 0 ? `R: ${fmtN(Number(it.naklad_robocizny))} r-g/jm × ${fmt(Number(it.stawka_rg))} zl/r-g` : null,
        Number(it.naklad_materialu) > 0 && Number(it.cena_mat) > 0 ? `M: ${fmtN(Number(it.naklad_materialu))} ${ascii(it.jednostka)} × ${fmt(Number(it.cena_mat))} zl` : null,
        Number(it.naklad_sprzetu) > 0 ? `S: ${fmtN(Number(it.naklad_sprzetu))} m-g/jm × ${fmt(Number(it.cena_sprz))} zl/m-g` : null,
      ].filter(Boolean).join("   ·   ");
      if (detail) {
        body.push([{ content: ascii(`        nakłady jedn.: ${detail}`), colSpan: 9, styles: { fontSize: 6.8, textColor: COLOR.muted, fillColor: COLOR.bgSoft, cellPadding: { top: 1, right: 2, bottom: 1.4, left: 2 } } }]);
      }
    }

    autoTable(doc, {
      head: [["Lp.", "Nr KNR", "Opis pozycji", "J.m.", "Ilosc", "R [zl]", "M [zl]", "S [zl]", "Razem [zl]"]],
      body,
      startY: y,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.6, right: 2, bottom: 1.6, left: 2 },
        textColor: COLOR.inkSoft,
        lineColor: COLOR.borderSoft,
        lineWidth: 0.1,
        valign: "middle",
      },
      headStyles: {
        fillColor: COLOR.primarySoft,
        textColor: COLOR.primary,
        fontStyle: "bold",
        fontSize: 7,
        lineColor: COLOR.border,
        lineWidth: 0.15,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center", textColor: COLOR.muted },
        1: { cellWidth: 28, fontStyle: "bold", textColor: COLOR.primary, font: "helvetica" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 11, halign: "center", textColor: COLOR.muted },
        4: { cellWidth: 14, halign: "right" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 16, halign: "right" },
        8: { cellWidth: 22, halign: "right", fontStyle: "bold", textColor: COLOR.ink },
      },
      margin: { left: PAGE.ml, right: PAGE.mr },
      didDrawPage: () => drawFooter(doc, docNumber, estimate),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Podsumowanie kosztorysu szczegółowego
  if (y > 250) { doc.addPage(); y = PAGE.mt; }
  y += 4;
  doc.setFillColor(...COLOR.ink);
  doc.rect(PAGE.ml, y, PAGE.w - PAGE.ml - PAGE.mr, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR.mutedLight);
  doc.text("PODSUMOWANIE KOSZTORYSU", PAGE.ml + 4, y + 6);

  const sumRows: [string, number][] = [
    ["R + M + S", sumR + sumM + sumS],
    [`Kp ${estimate.narzut_kp_proc}%`, kp],
    [`Zysk ${estimate.narzut_zysk_proc}%`, zysk],
  ];
  let sumX = PAGE.ml + 70;
  let sumYx = y + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const [l, v] of sumRows) {
    doc.setTextColor(...COLOR.mutedLight);
    doc.text(ascii(l), sumX, sumYx);
    doc.setTextColor(...COLOR.white);
    doc.text(`${fmt(v)} PLN`, PAGE.w - PAGE.mr - 4, sumYx, { align: "right" });
    sumYx += 4.5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.white);
  doc.text("NETTO", sumX, y + 24);
  doc.setFontSize(13);
  doc.text(`${fmt(netto)} PLN`, PAGE.w - PAGE.mr - 4, y + 24, { align: "right" });

  // ====================================================
  // STRONA RMS: Zestawienia robocizny, materiałów, sprzętu
  // ====================================================
  doc.addPage();
  y = PAGE.mt;
  drawSectionHeader(doc, y, "ZESTAWIENIE ROBOCIZNY (R)");
  y += 12;

  // Agregacja R per pozycja KNR (po stawce r-g)
  const rAgg = new Map<string, { godziny: number; stawka: number; wartosc: number; opis: string }>();
  for (const it of items) {
    const godziny = Number(it.ilosc) * Number(it.naklad_robocizny || 0);
    if (godziny <= 0) continue;
    const key = `rg_${it.stawka_rg}`;
    const cur = rAgg.get(key) ?? { godziny: 0, stawka: Number(it.stawka_rg), wartosc: 0, opis: `Roboczogodzina (stawka ${fmt(Number(it.stawka_rg))} zl/r-g)` };
    cur.godziny += godziny;
    cur.wartosc += godziny * Number(it.stawka_rg);
    rAgg.set(key, cur);
  }
  const rRows = Array.from(rAgg.values()).map((r, i) => [
    String(i + 1), ascii(r.opis), "r-g", fmtN(r.godziny, 3), fmt(r.stawka), fmt(r.wartosc),
  ]);
  rRows.push([{ content: "RAZEM ROBOCIZNA", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.primarySoft, textColor: COLOR.primary } } as any, { content: `${fmt(sumR)} PLN`, styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.primarySoft, textColor: COLOR.primary } } as any]);

  autoTable(doc, {
    head: [["Lp.", "Opis", "J.m.", "Ilosc", "Cena jedn. [zl]", "Wartosc [zl]"]],
    body: rRows,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: COLOR.inkSoft, lineColor: COLOR.borderSoft, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.primarySoft, textColor: COLOR.primary, fontStyle: "bold", fontSize: 7.5, lineColor: COLOR.border, lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: COLOR.muted },
      1: { cellWidth: "auto", fontStyle: "bold", textColor: COLOR.ink },
      2: { cellWidth: 14, halign: "center", textColor: COLOR.muted },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 32, halign: "right", fontStyle: "bold", textColor: COLOR.ink },
    },
    margin: { left: PAGE.ml, right: PAGE.mr },
    didDrawPage: () => drawFooter(doc, docNumber, estimate),
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ZESTAWIENIE MATERIAŁÓW
  if (y > 240) { doc.addPage(); y = PAGE.mt; }
  drawSectionHeader(doc, y, "ZESTAWIENIE MATERIALOW (M)");
  y += 12;

  const mAgg = new Map<string, { ilosc: number; jm: string; cena: number; wartosc: number; nazwa: string }>();
  for (const it of items) {
    const il = Number(it.ilosc) * Number(it.naklad_materialu || 0);
    if (il <= 0 || Number(it.cena_mat) <= 0) continue;
    const key = `${it.nazwa}|${it.jednostka}|${it.cena_mat}`;
    const cur = mAgg.get(key) ?? { ilosc: 0, jm: it.jednostka, cena: Number(it.cena_mat), wartosc: 0, nazwa: it.nazwa };
    cur.ilosc += il;
    cur.wartosc += il * Number(it.cena_mat);
    mAgg.set(key, cur);
  }
  const mRows = Array.from(mAgg.values()).map((m, i) => [
    String(i + 1), ascii(m.nazwa), ascii(m.jm), fmtN(m.ilosc, 3), fmt(m.cena), fmt(m.wartosc),
  ]);
  if (mRows.length === 0) mRows.push([{ content: "Brak materialow w kosztorysie", colSpan: 6, styles: { halign: "center", textColor: COLOR.muted } } as any]);
  else mRows.push([{ content: "RAZEM MATERIALY", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.primarySoft, textColor: COLOR.primary } } as any, { content: `${fmt(sumM)} PLN`, styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.primarySoft, textColor: COLOR.primary } } as any]);

  autoTable(doc, {
    head: [["Lp.", "Nazwa materialu", "J.m.", "Ilosc", "Cena jedn. [zl]", "Wartosc [zl]"]],
    body: mRows,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: COLOR.inkSoft, lineColor: COLOR.borderSoft, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.primarySoft, textColor: COLOR.primary, fontStyle: "bold", fontSize: 7.5, lineColor: COLOR.border, lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: COLOR.muted },
      1: { cellWidth: "auto", fontStyle: "bold", textColor: COLOR.ink },
      2: { cellWidth: 14, halign: "center", textColor: COLOR.muted },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 32, halign: "right", fontStyle: "bold", textColor: COLOR.ink },
    },
    margin: { left: PAGE.ml, right: PAGE.mr },
    didDrawPage: () => drawFooter(doc, docNumber, estimate),
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ZESTAWIENIE SPRZĘTU
  if (y > 240) { doc.addPage(); y = PAGE.mt; }
  drawSectionHeader(doc, y, "ZESTAWIENIE SPRZETU (S)");
  y += 12;

  const sAgg = new Map<string, { godziny: number; cena: number; wartosc: number; nazwa: string }>();
  for (const it of items) {
    const godz = Number(it.ilosc) * Number(it.naklad_sprzetu || 0);
    if (godz <= 0 || Number(it.cena_sprz) <= 0) continue;
    const key = `${it.nazwa}|${it.cena_sprz}`;
    const cur = sAgg.get(key) ?? { godziny: 0, cena: Number(it.cena_sprz), wartosc: 0, nazwa: `Sprzet do: ${it.nazwa}` };
    cur.godziny += godz;
    cur.wartosc += godz * Number(it.cena_sprz);
    sAgg.set(key, cur);
  }
  const sRows = Array.from(sAgg.values()).map((s, i) => [
    String(i + 1), ascii(s.nazwa), "m-g", fmtN(s.godziny, 3), fmt(s.cena), fmt(s.wartosc),
  ]);
  if (sRows.length === 0) sRows.push([{ content: "Brak sprzetu w kosztorysie", colSpan: 6, styles: { halign: "center", textColor: COLOR.muted } } as any]);
  else sRows.push([{ content: "RAZEM SPRZET", colSpan: 5, styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.primarySoft, textColor: COLOR.primary } } as any, { content: `${fmt(sumS)} PLN`, styles: { fontStyle: "bold", halign: "right", fillColor: COLOR.primarySoft, textColor: COLOR.primary } } as any]);

  autoTable(doc, {
    head: [["Lp.", "Opis sprzetu", "J.m.", "Ilosc", "Cena jedn. [zl]", "Wartosc [zl]"]],
    body: sRows,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, textColor: COLOR.inkSoft, lineColor: COLOR.borderSoft, lineWidth: 0.1 },
    headStyles: { fillColor: COLOR.primarySoft, textColor: COLOR.primary, fontStyle: "bold", fontSize: 7.5, lineColor: COLOR.border, lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: COLOR.muted },
      1: { cellWidth: "auto", fontStyle: "bold", textColor: COLOR.ink },
      2: { cellWidth: 14, halign: "center", textColor: COLOR.muted },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 32, halign: "right", fontStyle: "bold", textColor: COLOR.ink },
    },
    margin: { left: PAGE.ml, right: PAGE.mr },
    didDrawPage: () => drawFooter(doc, docNumber, estimate),
  });

  // Notatki
  if (estimate.notes) {
    let ny = (doc as any).lastAutoTable.finalY + 10;
    if (ny > 260) { doc.addPage(); ny = PAGE.mt; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text("UWAGI / NOTATKI", PAGE.ml, ny);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.inkSoft);
    const lines = doc.splitTextToSize(ascii(estimate.notes), PAGE.w - PAGE.ml - PAGE.mr);
    doc.text(lines, PAGE.ml, ny + 5);
  }

  drawFooter(doc, docNumber, estimate);

  const safeName = estimate.nazwa_kosztorysu.replace(/[^a-z0-9]+/gi, "_");
  doc.save(`Kosztorys_KNR_${safeName}.pdf`);
}

// ===== HELPERS =====

function drawPartyBox(doc: jsPDF, x: number, y: number, w: number, label: string, name: string | null, address: string | null) {
  doc.setFillColor(...COLOR.bgSoft);
  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, 32, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR.primary);
  doc.text(label, x + 3, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.ink);
  doc.text(ascii(name || "—"), x + 3, y + 11, { maxWidth: w - 6 });
  if (address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR.inkSoft);
    const lines = doc.splitTextToSize(ascii(address), w - 6);
    doc.text(lines.slice(0, 4), x + 3, y + 17);
  }
}

function drawSectionHeader(doc: jsPDF, y: number, title: string) {
  doc.setFillColor(...COLOR.primary);
  doc.rect(PAGE.ml, y, PAGE.w - PAGE.ml - PAGE.mr, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.white);
  doc.text(ascii(title), PAGE.ml + 3, y + 5.5);
}

function drawFooter(doc: jsPDF, docNumber: string, estimate: Estimate) {
  const pageNum = doc.getCurrentPageInfo().pageNumber;
  const totalPages = doc.getNumberOfPages();
  doc.setDrawColor(...COLOR.borderSoft);
  doc.setLineWidth(0.2);
  doc.line(PAGE.ml, PAGE.h - 12, PAGE.w - PAGE.mr, PAGE.h - 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.mutedLight);
  doc.text(`Kosztorys KNR  •  Nr ${docNumber}  •  ${ascii(estimate.nazwa_kosztorysu)}`, PAGE.ml, PAGE.h - 7);
  doc.text(`Strona ${pageNum} / ${totalPages}`, PAGE.w - PAGE.mr, PAGE.h - 7, { align: "right" });
}
