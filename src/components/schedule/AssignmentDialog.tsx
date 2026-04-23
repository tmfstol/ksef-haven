import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import {
  TASK_TYPE_META,
  type Assignment,
  type Employee,
  type TaskType,
  type Vehicle,
} from "@/hooks/useSchedule";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: Employee[];
  vehicles: Vehicle[];
  initial: Partial<Assignment> | null;
  onSave: (a: Partial<Assignment>) => void;
  onDelete?: (id: string) => void;
};

export function AssignmentDialog({
  open,
  onOpenChange,
  employees,
  vehicles,
  initial,
  onSave,
  onDelete,
}: Props) {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [taskType, setTaskType] = useState<TaskType>("wyjazd");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (open) {
      setEmployeeId(initial?.employee_id ?? "");
      setVehicleId(initial?.vehicle_id ?? "");
      setTaskType((initial?.task_type as TaskType) ?? "wyjazd");
      setLocation(initial?.location ?? "");
      setDescription(initial?.description ?? "");
      setStartDate(initial?.start_date ?? "");
      setEndDate(initial?.end_date ?? initial?.start_date ?? "");
    }
  }, [open, initial]);

  const isEdit = !!initial?.id;

  const handleSave = () => {
    if (!employeeId || !startDate || !endDate) return;
    onSave({
      id: initial?.id,
      employee_id: employeeId,
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edytuj zadanie" : "Nowe zadanie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Pracownik</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.order_number ? `${e.order_number} ` : ""}{e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        <DialogFooter className="gap-2">
          {isEdit && onDelete && initial?.id && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(initial.id!);
                onOpenChange(false);
              }}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4" /> Usuń
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleSave}>Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
