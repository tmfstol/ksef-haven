import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import type { Vehicle } from "@/hooks/useSchedule";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicles: Vehicle[];
  onAdd: (name: string, registration: string) => void;
  onDelete: (id: string) => void;
};

export function VehiclesDialog({ open, onOpenChange, vehicles, onAdd, onDelete }: Props) {
  const [name, setName] = useState("");
  const [registration, setRegistration] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pojazdy</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nazwa (Vivaro)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Tablica" value={registration} onChange={(e) => setRegistration(e.target.value)} />
            <Button
              size="icon"
              onClick={() => {
                if (!name.trim()) return;
                onAdd(name.trim(), registration.trim());
                setName(""); setRegistration("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 max-h-60 overflow-auto">
            {vehicles.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Brak pojazdów</p>
            )}
            {vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{v.name}</span>
                  {v.registration && <span className="text-muted-foreground ml-2">{v.registration}</span>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => onDelete(v.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zamknij</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
