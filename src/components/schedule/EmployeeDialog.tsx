import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Employee } from "@/hooks/useSchedule";

const COLORS = ["#6366f1", "#10b981", "#ef4444", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Partial<Employee> | null;
  onSave: (e: Partial<Employee>) => void;
};

export function EmployeeDialog({ open, onOpenChange, initial, onSave }: Props) {
  const [name, setName] = useState("");
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setOrderNumber(initial?.order_number != null ? String(initial.order_number) : "");
      setPhone(initial?.phone ?? "");
      setColor(initial?.color ?? COLORS[0]);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edytuj pracownika" : "Nowy pracownik"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Imię / nazwisko</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jarek" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Numer porządkowy</Label>
              <Input
                type="number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="3"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+48..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Kolor</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onSave({
                id: initial?.id,
                name: name.trim(),
                order_number: orderNumber ? parseInt(orderNumber, 10) : null,
                phone: phone || null,
                color,
              });
              onOpenChange(false);
            }}
          >
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
