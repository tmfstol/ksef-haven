import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, Users } from "lucide-react";
import {
  TASK_TYPE_META,
  type Assignment,
  type Employee,
  type EmployeeGroup,
  type TaskType,
  type Vehicle,
} from "@/hooks/useSchedule";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: Employee[];
  vehicles: Vehicle[];
  groups: EmployeeGroup[];
  initial: Partial<Assignment> | null;
  /** When editing (initial.id), selectedIds = [initial.employee_id]. Saving with multi
   *  → for the original assignment, update; for additional ids → create new. */
  onSaveBulk: (data: {
    id?: string; // existing assignment id (for edit)
    originalEmployeeId?: string; // employee of the existing assignment
    employee_ids: string[]; // all selected
    vehicle_id: string | null;
    task_type: TaskType;
    location: string | null;
    description: string | null;
    start_date: string;
    end_date: string;
  }) => void;
  onDelete?: (id: string) => void;
  onManageGroups: () => void;
};

export function AssignmentDialog({
  open,
  onOpenChange,
  employees,
  vehicles,
  groups,
  initial,
  onSaveBulk,
  onDelete,
  onManageGroups,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [vehicleId, setVehicleId] = useState<string>("");
  const [taskType, setTaskType] = useState<TaskType>("wyjazd");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      const initIds = new Set<string>();
      if (initial?.employee_id) initIds.add(initial.employee_id);
      setSelected(initIds);
      setVehicleId(initial?.vehicle_id ?? "");
      setTaskType((initial?.task_type as TaskType) ?? "wyjazd");
      setLocation(initial?.location ?? "");
      setDescription(initial?.description ?? "");
      setStartDate(initial?.start_date ?? "");
      setEndDate(initial?.end_date ?? initial?.start_date ?? "");
      setSearch("");
    }
  }, [open, initial]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        String(e.order_number ?? "").includes(q)
    );
  }, [employees, search]);

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filtered.forEach((e) => next.delete(e.id));
      } else {
        filtered.forEach((e) => next.add(e.id));
      }
      return next;
    });
  };

  const applyGroup = (groupId: string) => {
    const g = groups.find((gr) => gr.id === groupId);
    if (!g) return;
    setSelected((prev) => {
      const next = new Set(prev);
      g.member_ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const isEdit = !!initial?.id;
  const canSave = selected.size > 0 && startDate && endDate;

  const handleSave = () => {
    if (!canSave) return;
    onSaveBulk({
      id: initial?.id,
      originalEmployeeId: initial?.employee_id,
      employee_ids: Array.from(selected),
      vehicle_id: vehicleId || null,
      task_type: taskType,
      location: location || null,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edytuj zadanie" : "Nowe zadanie"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-auto pr-1">
          {/* Left: employee multi-select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Pracownicy
                <Badge variant="secondary" className="ml-1">{selected.size}</Badge>
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={onManageGroups} className="h-7 text-xs">
                Grupy
              </Button>
            </div>

            {groups.length > 0 && (
              <div>
                <Select onValueChange={applyGroup}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="+ Dodaj grupę" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                          {g.name}
                          <span className="text-muted-foreground text-xs">({g.member_ids.length})</span>
                          {g.owner_user_id && <span className="text-[10px] text-muted-foreground">prywatna</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj..."
                className="pl-7 h-8 text-sm"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="w-full h-7 text-xs"
            >
              {allSelected ? "Odznacz wszystkich" : "Zaznacz wszystkich"}
            </Button>

            <ScrollArea className="h-[260px] rounded-md border">
              <div className="p-1.5 space-y-0.5">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Brak wyników</p>
                )}
                {filtered.map((e) => {
                  const checked = selected.has(e.id);
                  return (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => toggle(e.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 text-left",
                        checked && "bg-primary/10"
                      )}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: e.color }}
                      >
                        {e.order_number ?? e.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm truncate">{e.name}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right: assignment fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Od</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Do</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Typ zadania</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_TYPE_META) as TaskType[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded ${TASK_TYPE_META[k].bg}`} />
                        {TASK_TYPE_META[k].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Lokalizacja / Klient</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Hankook Berlin" />
            </div>

            <div className="space-y-1.5">
              <Label>Pojazd</Label>
              <Select value={vehicleId || "none"} onValueChange={(v) => setVehicleId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Brak" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}{v.registration ? ` · ${v.registration}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Opis</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rozbiórka, wyjazd..." />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          {isEdit && onDelete && initial?.id && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { onDelete(initial.id!); onOpenChange(false); }}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4" /> Usuń
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEdit ? "Zapisz" : `Utwórz (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
