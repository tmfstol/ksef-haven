import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Estimate, EstimateStage, EstimateItem } from "@/hooks/useEstimates";
import type { Company } from "@/types/company";

const fmt = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Args {
  estimate: Estimate;
  stages: EstimateStage[];
  items: EstimateItem[];
  company: Company | null;
  variant: "client" | "internal";
}

export function generateEstimatePdf({ estimate, stages, items, company, variant }: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "normal");

  // Header
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, 210, 32, "F");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(variant === "client" ? "Oferta" : "Kalkulacja wewnetrzna", 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(estimate.nazwa_kosztorysu, 14, 23);
  doc.text(`Branza: ${estimate.branza}`, 14, 28);

  // Logo placeholder (right)
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(160, 8, 36, 18, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("LOGO", 178, 19, { align: "center" });

  // Company / client info
  let y = 40;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  if (company) {
    doc.setFont("helvetica", "bold");
    doc.text("Wystawca:", 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(company.name, 14, y + 5);
    if (company.nip) doc.text(`NIP: ${company.nip}`, 14, y + 10);
    if (company.street) doc.text(`${company.street}`, 14, y + 15);
    if (company.postal_code || company.city) doc.text(`${company.postal_code ?? ""} ${company.city ?? ""}`, 14, y + 20);
  }
  if (estimate.client_name) {
    doc.setFont("helvetica", "bold");
    doc.text("Klient:", 110, y);
    doc.setFont("helvetica", "normal");
    doc.text(estimate.client_name, 110, y + 5);
  }
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${new Date(estimate.created_at).toLocaleDateString("pl-PL")}`, 110, y + 20);
  y += 32;

  const marzaMat = Number(estimate.marza_material || 0) / 100;
  const marzaRob = Number(estimate.marza_robocizna || 0) / 100;

  // For each stage, build a table
  let totalMatClient = 0;
  let totalRobClient = 0;
  let totalMatBuy = 0;
  let totalRobBase = 0;

  const stagesToRender = stages.length > 0 ? stages : [{ id: "_none", estimate_id: estimate.id, ordinal: 1, name: "Pozycje", description: null } as EstimateStage];

  for (const stage of stagesToRender) {
    const stageItems = items.filter((i) => (stages.length > 0 ? i.stage_id === stage.id : true));
    if (stageItems.length === 0) continue;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(stage.name, 14, y);
    y += 4;

    const head = variant === "client"
      ? [["Lp", "Nazwa", "Ilosc", "J.m.", "Cena mat. + mar.", "Cena rob. + mar.", "Wartosc"]]
      : [["Lp", "Nazwa", "Ilosc", "J.m.", "Mat. zakup", "Mat. klient", "Rob. baza", "Rob. klient", "Wartosc"]];

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

      if (variant === "client") {
        return [
          String(idx + 1),
          it.nazwa + (it.wymiary ? ` (${it.wymiary})` : ""),
          fmt(Number(it.ilosc)),
          it.jednostka,
          fmt(matClientUnit),
          fmt(robClientUnit),
          fmt(total),
        ];
      }
      return [
        String(idx + 1),
        it.nazwa + (it.wymiary ? ` (${it.wymiary})` : ""),
        fmt(Number(it.ilosc)),
        it.jednostka,
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
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  }

  // Summary
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(110, y, 86, variant === "client" ? 30 : 50, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  let sy = y + 6;
  doc.setFont("helvetica", "bold");
  doc.text("Podsumowanie", 114, sy); sy += 6;
  doc.setFont("helvetica", "normal");

  if (variant === "internal") {
    doc.text(`Materialy (zakup): ${fmt(totalMatBuy)} PLN`, 114, sy); sy += 5;
    doc.text(`Robocizna (baza): ${fmt(totalRobBase)} PLN`, 114, sy); sy += 5;
    doc.setTextColor(100, 116, 139);
    doc.text(`Marza materialy: ${estimate.marza_material}%`, 114, sy); sy += 4;
    doc.text(`Marza robocizna: ${estimate.marza_robocizna}%`, 114, sy); sy += 5;
    doc.setTextColor(15, 23, 42);
  }
  doc.text(`Materialy: ${fmt(totalMatClient)} PLN`, 114, sy); sy += 5;
  doc.text(`Robocizna: ${fmt(totalRobClient)} PLN`, 114, sy); sy += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`RAZEM: ${fmt(totalMatClient + totalRobClient)} PLN`, 114, sy + 1);

  if (variant === "internal") {
    const zysk = (totalMatClient - totalMatBuy) + (totalRobClient - totalRobBase);
    doc.setTextColor(16, 185, 129);
    doc.text(`Zysk szac.: ${fmt(zysk)} PLN`, 114, sy + 8);
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Strona ${p}/${pages} • ${variant === "client" ? "Oferta" : "Kalkulacja wewnetrzna"} • ${estimate.nazwa_kosztorysu}`, 14, 290);
  }

  const safeName = estimate.nazwa_kosztorysu.replace(/[^a-z0-9]+/gi, "_");
  doc.save(`${variant === "client" ? "Oferta" : "Kalkulacja"}_${safeName}.pdf`);
}
