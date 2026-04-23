import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addDays, format, parseISO, differenceInDays, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
import {
  type Assignment,
  type Employee,
  type Vehicle,
  TASK_TYPE_META,
} from "@/hooks/useSchedule";

type ExportParams = {
  companyName: string;
  employees: Employee[];
  vehicles: Vehicle[];
  assignments: Assignment[];
  startDate: Date;
  daysCount: number;
};

// Map our tailwind bg-* classes to RGB triplets (matches TASK_TYPE_META colors)
const TASK_RGB: Record<string, [number, number, number]> = {
  wyjazd: [16, 185, 129], // emerald-500
  rozbiorka: [244, 63, 94], // rose-500
  serwis: [14, 165, 233], // sky-500
  montaz: [249, 115, 22], // orange-500
};

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function exportSchedulePdf({
  companyName,
  employees,
  vehicles,
  assignments,
  startDate,
  daysCount,
}: ExportParams) {
  const orientation = daysCount > 10 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Harmonogram pracy", 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(companyName, 14, 21);
  const rangeText = `${format(startDate, "d MMM yyyy", { locale: pl })} — ${format(
    addDays(startDate, daysCount - 1),
    "d MMM yyyy",
    { locale: pl }
  )}`;
  doc.text(rangeText, 14, 26);
  doc.setTextColor(140);
  doc.setFontSize(8);
  doc.text(`Wygenerowano: ${format(today, "d MMM yyyy HH:mm", { locale: pl })}`, pageW - 14, 15, {
    align: "right",
  });
  doc.setTextColor(0);

  // Build days array
  const days = Array.from({ length: daysCount }, (_, i) => addDays(startDate, i));
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(addDays(startDate, daysCount - 1), "yyyy-MM-dd");

  const vehicleMap = new Map<string, Vehicle>();
  vehicles.forEach((v) => vehicleMap.set(v.id, v));

  // Header row: "Pracownik" + day labels
  const head = [
    [
      "Pracownik",
      ...days.map((d) => `${format(d, "EEEEEE", { locale: pl }).toUpperCase()}\n${format(d, "d.MM")}`),
    ],
  ];

  // For each employee, compute per-day cell content (label of assignment) and color
  type Cell = { text: string; rgb?: [number, number, number]; isWeekend: boolean; isToday: boolean };

  const body: Cell[][] = employees.map((emp) => {
    const empAssigns = assignments.filter(
      (a) => a.employee_id === emp.id && a.start_date <= endStr && a.end_date >= startStr
    );
    const cells: Cell[] = [
      { text: emp.name + (emp.phone ? `\n${emp.phone}` : ""), isWeekend: false, isToday: false },
    ];
    days.forEach((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const a = empAssigns.find((x) => x.start_date <= ds && x.end_date >= ds);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday = isSameDay(d, today);
      if (!a) {
        cells.push({ text: "", isWeekend, isToday });
      } else {
        const meta = TASK_TYPE_META[a.task_type];
        const rgb = TASK_RGB[a.task_type] ?? [100, 100, 100];
        const veh = a.vehicle_id ? vehicleMap.get(a.vehicle_id) : null;
        const lines = [a.location || meta.label];
        if (a.description && a.description !== a.location) lines.push(a.description);
        if (veh) lines.push(veh.name);
        cells.push({ text: lines.join("\n"), rgb, isWeekend, isToday });
      }
    });
    return cells;
  });

  autoTable(doc, {
    startY: 32,
    head,
    body: body.map((row) => row.map((c) => c.text)),
    theme: "grid",
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: "middle",
      halign: "center",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 32, fontStyle: "bold", fontSize: 8 },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const cell = body[data.row.index]?.[data.column.index];
      if (!cell) return;
      if (cell.rgb) {
        data.cell.styles.fillColor = cell.rgb;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      } else if (cell.isToday) {
        data.cell.styles.fillColor = [219, 234, 254];
      } else if (cell.isWeekend) {
        data.cell.styles.fillColor = [248, 250, 252];
      }
    },
    margin: { left: 8, right: 8 },
  });

  // Legend
  let yAfter = (doc as any).lastAutoTable?.finalY ?? 200;
  yAfter += 6;
  if (yAfter > doc.internal.pageSize.getHeight() - 14) {
    doc.addPage(orientation, "a4");
    yAfter = 14;
  }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60);
  doc.text("Legenda:", 14, yAfter);
  let lx = 32;
  (Object.keys(TASK_TYPE_META) as Array<keyof typeof TASK_TYPE_META>).forEach((k) => {
    const rgb = TASK_RGB[k];
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.roundedRect(lx, yAfter - 3.2, 3.5, 3.5, 0.6, 0.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.text(TASK_TYPE_META[k].label, lx + 5, yAfter);
    lx += 32;
  });

  // Footer page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Strona ${i} / ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 6,
      { align: "right" }
    );
  }

  const fname = `harmonogram_${format(startDate, "yyyy-MM-dd")}_${daysCount}d.pdf`;
  doc.save(fname);
}
