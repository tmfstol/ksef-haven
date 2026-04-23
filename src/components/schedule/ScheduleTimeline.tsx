import { useMemo, useState, useRef, useEffect } from "react";
import { addDays, format, isSameDay, parseISO, differenceInDays, startOfWeek } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, Trash2, Phone } from "lucide-react";
import {
  type Assignment,
  type Employee,
  type Vehicle,
  TASK_TYPE_META,
} from "@/hooks/useSchedule";

type Props = {
  employees: Employee[];
  vehicles: Vehicle[];
  assignments: Assignment[];
  startDate: Date;
  daysCount: number;
  onShiftDays: (delta: number) => void;
  onCellClick: (employee: Employee, date: Date) => void;
  onAssignmentClick: (a: Assignment) => void;
  onAssignmentResize: (a: Assignment, newStart: string, newEnd: string) => void;
  onAddEmployee: () => void;
  onDeleteEmployee: (e: Employee) => void;
  onCopyAssignment: (a: Assignment) => void;
  pasteMode: boolean;
};

const COL_WIDTH = 56; // px per day
const ROW_HEIGHT = 64;
const SIDEBAR_WIDTH = 220;

function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function ScheduleTimeline({
  employees,
  vehicles,
  assignments,
  startDate,
  daysCount,
  onShiftDays,
  onCellClick,
  onAssignmentClick,
  onAssignmentResize,
  onAddEmployee,
  onDeleteEmployee,
  onCopyAssignment,
  pasteMode,
}: Props) {
  const days = useMemo(
    () => Array.from({ length: daysCount }, (_, i) => addDays(startDate, i)),
    [startDate, daysCount]
  );

  const vehicleMap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const startDateStr = fmtDate(startDate);
  const endDateStr = fmtDate(addDays(startDate, daysCount - 1));

  const visibleAssignments = useMemo(
    () =>
      assignments.filter(
        (a) => a.start_date <= endDateStr && a.end_date >= startDateStr
      ),
    [assignments, startDateStr, endDateStr]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState<{
    a: Assignment;
    side: "left" | "right";
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);
  const [previewRange, setPreviewRange] = useState<{ id: string; start: string; end: string } | null>(null);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - resizing.startX;
      const deltaDays = Math.round(dx / COL_WIDTH);
      let newStart = resizing.origStart;
      let newEnd = resizing.origEnd;
      if (resizing.side === "left") {
        const ns = addDays(parseISO(resizing.origStart), deltaDays);
        if (ns > parseISO(resizing.origEnd)) return;
        newStart = fmtDate(ns);
      } else {
        const ne = addDays(parseISO(resizing.origEnd), deltaDays);
        if (ne < parseISO(resizing.origStart)) return;
        newEnd = fmtDate(ne);
      }
      setPreviewRange({ id: resizing.a.id, start: newStart, end: newEnd });
    };
    const handleUp = () => {
      if (resizing && previewRange) {
        if (
          previewRange.start !== resizing.origStart ||
          previewRange.end !== resizing.origEnd
        ) {
          onAssignmentResize(resizing.a, previewRange.start, previewRange.end);
        }
      }
      setResizing(null);
      setPreviewRange(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing, previewRange, onAssignmentResize]);

  const today = new Date();

  return (
    <div className={cn("rounded-2xl border bg-card overflow-hidden shadow-sm", pasteMode && "ring-2 ring-primary")}>
      {pasteMode && (
        <div className="px-4 py-2 text-xs bg-primary text-primary-foreground text-center font-medium">
          🖌️ Tryb wklejania: kliknij komórkę pracownika aby wkleić zadanie. Esc lub kliknij „Zakończ" aby wyjść.
        </div>
      )}
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onShiftDays(-7)}>
            <ChevronLeft className="h-4 w-4" /> Tydzień
          </Button>
          <Button variant="outline" size="sm" onClick={() => onShiftDays(7)}>
            Tydzień <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-3 text-sm text-muted-foreground">
            {format(startDate, "d MMM yyyy", { locale: pl })} —{" "}
            {format(addDays(startDate, daysCount - 1), "d MMM yyyy", { locale: pl })}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onAddEmployee}>
          <Plus className="h-4 w-4" /> Pracownik
        </Button>
      </div>

      {/* Scrollable timeline */}
      <div ref={containerRef} className="overflow-x-auto">
        <div style={{ minWidth: SIDEBAR_WIDTH + days.length * COL_WIDTH }}>
          {/* Header row with dates */}
          <div className="flex sticky top-0 z-20 bg-card border-b">
            <div
              className="flex-shrink-0 px-4 py-2 text-xs font-semibold text-muted-foreground border-r flex items-center"
              style={{ width: SIDEBAR_WIDTH }}
            >
              Pracownik
            </div>
            <div className="flex">
              {days.map((d) => {
                const isToday = isSameDay(d, today);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "flex-shrink-0 border-r text-center py-1.5",
                      isWeekend && "bg-muted/40",
                      isToday && "bg-primary/10"
                    )}
                    style={{ width: COL_WIDTH }}
                  >
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                      {format(d, "EEE", { locale: pl })}
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isToday && "text-primary"
                      )}
                    >
                      {format(d, "d")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {employees.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Brak pracowników. Kliknij „Pracownik" aby dodać pierwszego.
            </div>
          )}
          {employees.map((emp) => {
            const empAssignments = visibleAssignments.filter(
              (a) => a.employee_id === emp.id
            );
            return (
              <div
                key={emp.id}
                className="flex border-b group hover:bg-muted/20"
                style={{ height: ROW_HEIGHT }}
              >
                {/* Employee cell */}
                <div
                  className="flex-shrink-0 px-3 py-2 border-r flex items-center gap-2 bg-card"
                  style={{ width: SIDEBAR_WIDTH }}
                >
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.order_number ?? emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{emp.name}</div>
                    {emp.phone && (
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                        <Phone className="h-2.5 w-2.5" /> {emp.phone}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => onDeleteEmployee(emp)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Day cells (background) + assignment bars (overlay) */}
                <div className="relative flex">
                  {days.map((d) => {
                    const isToday = isSameDay(d, today);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        onClick={() => onCellClick(emp, d)}
                        className={cn(
                          "flex-shrink-0 border-r hover:bg-primary/5 transition-colors",
                          isWeekend && "bg-muted/30",
                          isToday && "bg-primary/5"
                        )}
                        style={{ width: COL_WIDTH, height: ROW_HEIGHT }}
                      />
                    );
                  })}

                  {/* Assignment bars */}
                  {empAssignments.map((a) => {
                    const preview = previewRange?.id === a.id ? previewRange : null;
                    const aStart = parseISO(preview?.start ?? a.start_date);
                    const aEnd = parseISO(preview?.end ?? a.end_date);
                    const clampStart = aStart < startDate ? startDate : aStart;
                    const clampEnd =
                      aEnd > addDays(startDate, daysCount - 1)
                        ? addDays(startDate, daysCount - 1)
                        : aEnd;
                    const offsetDays = differenceInDays(clampStart, startDate);
                    const spanDays = differenceInDays(clampEnd, clampStart) + 1;
                    const meta = TASK_TYPE_META[a.task_type];
                    const vehicle = a.vehicle_id ? vehicleMap.get(a.vehicle_id) : null;
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "absolute top-1.5 h-[52px] rounded-lg shadow-sm flex flex-col px-2 py-1 cursor-pointer ring-1 ring-black/5 hover:ring-2 hover:ring-offset-1",
                          meta.bg,
                          meta.text
                        )}
                        style={{
                          left: offsetDays * COL_WIDTH + 2,
                          width: spanDays * COL_WIDTH - 4,
                        }}
                        onClick={(e) => {
                          if (resizing) return;
                          e.stopPropagation();
                          onAssignmentClick(a);
                        }}
                      >
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/20 rounded-l-lg"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizing({
                              a,
                              side: "left",
                              startX: e.clientX,
                              origStart: a.start_date,
                              origEnd: a.end_date,
                            });
                          }}
                        />
                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-black/20 rounded-r-lg"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizing({
                              a,
                              side: "right",
                              startX: e.clientX,
                              origStart: a.start_date,
                              origEnd: a.end_date,
                            });
                          }}
                        />
                        <div className="text-[11px] font-bold leading-tight truncate pointer-events-none">
                          {a.location || meta.label}
                        </div>
                        <div className="text-[10px] opacity-90 leading-tight truncate pointer-events-none">
                          {a.description || meta.label}
                        </div>
                        {vehicle && (
                          <div className="text-[9px] opacity-80 leading-tight truncate pointer-events-none">
                            🚐 {vehicle.name}
                            {vehicle.registration ? ` · ${vehicle.registration}` : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t flex items-center gap-4 flex-wrap text-xs bg-muted/20">
        {(Object.keys(TASK_TYPE_META) as Array<keyof typeof TASK_TYPE_META>).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded", TASK_TYPE_META[k].bg)} />
            <span className="text-muted-foreground">{TASK_TYPE_META[k].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { startOfWeek };
