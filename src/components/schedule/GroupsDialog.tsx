import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Lock, Globe } from "lucide-react";
import type { Employee, EmployeeGroup } from "@/hooks/useSchedule";
import { cn } from "@/lib/utils";

const COLORS = ["#8b5cf6", "#10b981", "#ef4444", "#f59e0b", "#0ea5e9", "#ec4899", "#14b8a6", "#6366f1"];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: Employee[];
  groups: EmployeeGroup[];
  currentUserId: string | null;
  isAdmin: boolean;
  onSave: (g: { id?: string; name: string; color: string; private: boolean; member_ids: string[] }) => void;
  onDelete: (id: string) => void;
};

export function GroupsDialog({
  open, onOpenChange, employees, groups, currentUserId, isAdmin, onSave, onDelete,
}: Props) {
  const [editing, setEditing] = useState<EmployeeGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setCreating(false);
    }
  }, [open]);

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setName("");
    setColor(COLORS[0]);
    setIsPrivate(!isAdmin); // non-admins can only create private
    setMemberIds(new Set());
  };

  const startEdit = (g: EmployeeGroup) => {
    setEditing(g);
    setCreating(true);
    setName(g.name);
    setColor(g.color);
    setIsPrivate(!!g.owner_user_id);
    setMemberIds(new Set(g.member_ids));
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: editing?.id,
      name: name.trim(),
      color,
      private: isPrivate,
      member_ids: Array.from(memberIds),
    });
    cancel();
  };

  const toggleMember = (id: string) => {
    setMemberIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grupy pracowników</DialogTitle>
        </DialogHeader>

        {!creating ? (
          <>
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {groups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Brak grup. Dodaj pierwszą poniżej.
                </p>
              )}
              {groups.map((g) => {
                const canEdit = g.owner_user_id ? g.owner_user_id === currentUserId : isAdmin;
                return (
                  <div key={g.id} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        {g.name}
                        {g.owner_user_id ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.member_ids.length} osób · {g.owner_user_id ? "prywatna" : "firmowa"}
                      </div>
                    </div>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(g)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            if (confirm(`Usunąć grupę "${g.name}"?`)) onDelete(g.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Zamknij</Button>
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" /> Nowa grupa
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nazwa</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ekipa Montażowa 1" />
              </div>
              <div className="space-y-1.5">
                <Label>Kolor</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-6 w-6 rounded-full border-2 transition-all",
                        color === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium flex items-center gap-1.5">
                    {isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                    {isPrivate ? "Prywatna (tylko Ty)" : "Firmowa (cała firma)"}
                  </div>
                </div>
                <Switch
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  disabled={!isAdmin}
                />
              </div>
              {!isAdmin && !isPrivate && (
                <p className="text-xs text-muted-foreground">
                  Tylko admini firmy mogą tworzyć grupy firmowe.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Członkowie <Badge variant="secondary" className="ml-1">{memberIds.size}</Badge></Label>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-1.5 space-y-0.5">
                    {employees.map((e) => {
                      const checked = memberIds.has(e.id);
                      return (
                        <button
                          type="button"
                          key={e.id}
                          onClick={() => toggleMember(e.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 text-left",
                            checked && "bg-primary/10"
                          )}
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <span
                            className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: e.color }}
                          >
                            {e.order_number ?? e.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-sm">{e.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={cancel}>Anuluj</Button>
              <Button onClick={save} disabled={!name.trim()}>Zapisz</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
