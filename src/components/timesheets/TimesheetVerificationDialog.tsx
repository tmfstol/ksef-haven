import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ImageOff, Wand2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getScanImageUrl,
  useSaveEmployeeHours,
  type EmployeeHourInput,
  type TimesheetScan,
} from "@/hooks/useTimesheets";
import { useEmployees } from "@/hooks/useSchedule";
import { useProjects } from "@/hooks/useProjects";
import { matchEmployee } from "@/lib/fuzzy-match";

interface RawRow {
  employee_name?: string | null;
  work_date?: string | null;
  hours?: number | null;
  description?: string | null;
}

interface DraftRow {
  uid: string;
  employee_name_raw: string;
  employee_id: string | null;
  work_date: string;
  hours: number;
  description: string;
  selected: boolean;
  match_score?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scan: TimesheetScan | null;
  initialRows?: RawRow[];
  companyId: string;
  onSaved?: () => void;
}

function genUid() {
  return Math.random().toString(36).slice(2, 10);
}

export function TimesheetVerificationDialog({
  open,
  onOpenChange,
  scan,
  initialRows,
  companyId,
  onSaved,
}: Props) {
  const { data: employees = [] } = useEmployees(companyId);
  const { data: projects = [] } = useProjects(companyId);
  const activeProjects = useMemo(() => {
    const all = projects.filter((p) => p.status === "active");
    const top = all.filter((p) => !p.parent_id);
    const ordered: typeof all = [];
    for (const t of top) {
      ordered.push(t);
      all.filter((s) => s.parent_id === t.id).forEach((s) => ordered.push(s));
    }
    all.forEach((p) => { if (!ordered.includes(p)) ordered.push(p); });
    return ordered;
  }, [projects]);
  const saveMutation = useSaveEmployeeHours();

  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [bulkProject, setBulkProject] = useState<string>("");

  // Załaduj signed URL podglądu
  useEffect(() => {
    if (!open || !scan) return;
    let cancelled = false;
    setImgLoading(true);
    getScanImageUrl(scan.image_path)
      .then((u) => !cancelled && setImgUrl(u))
      .catch(() => !cancelled && setImgUrl(null))
      .finally(() => !cancelled && setImgLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, scan]);

  // Inicjuj wiersze (z propsa lub z scan.ai_response)
  useEffect(() => {
    if (!open) return;
    const source: RawRow[] =
      initialRows && initialRows.length > 0
        ? initialRows
        : (scan?.ai_response as any)?.rows ?? [];
    const matchCandidates = employees.map((e) => ({ id: e.id, name: e.name }));
    const drafts: DraftRow[] = source.map((r) => {
      const m = matchEmployee(r.employee_name ?? "", matchCandidates);
      return {
        uid: genUid(),
        employee_name_raw: r.employee_name ?? "",
        employee_id: m.match?.id ?? null,
        work_date: r.work_date ?? new Date().toISOString().slice(0, 10),
        hours: Number(r.hours ?? 0) || 0,
        description: r.description ?? "",
        selected: false,
        match_score: m.score,
      };
    });
    setRows(drafts);
    // domyślny projekt = pierwszy aktywny
    if (activeProjects[0]) setBulkProject(activeProjects[0].id);
  }, [open, scan, initialRows, employees, activeProjects]);

  const allSelected = rows.length > 0 && rows.every((r) => r.selected);
  const anySelected = rows.some((r) => r.selected);

  const toggleAll = (v: boolean) => setRows((p) => p.map((r) => ({ ...r, selected: v })));
  const updateRow = (uid: string, patch: Partial<DraftRow>) =>
    setRows((p) => p.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const removeRow = (uid: string) => setRows((p) => p.filter((r) => r.uid !== uid));

  // Per-row project mapping przechowujemy w osobnym stanie
  const [perRowProject, setPerRowProject] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) setPerRowProject({});
  }, [open]);

  const assignBulkProject = (projectId: string) => {
    if (!anySelected) {
      toast.error("Zaznacz wiersze, które chcesz przypisać");
      return;
    }
    setPerRowProject((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (r.selected) next[r.uid] = projectId;
      });
      return next;
    });
    toast.success(`Przypisano ${rows.filter((r) => r.selected).length} wierszy`);
  };

  const handleSave = async () => {
    if (!scan) return;
    const toSave = rows.filter((r) => r.selected || perRowProject[r.uid]);
    if (toSave.length === 0) {
      toast.error("Zaznacz wiersze i przypisz projekty");
      return;
    }
    const missing = toSave.filter((r) => !perRowProject[r.uid]);
    if (missing.length > 0) {
      toast.error(`Brak projektu dla ${missing.length} wierszy`);
      return;
    }
    const invalid = toSave.filter((r) => !r.work_date || r.hours <= 0);
    if (invalid.length > 0) {
      toast.error(`Nieprawidłowe dane (data lub godziny) w ${invalid.length} wierszach`);
      return;
    }
    const payload: EmployeeHourInput[] = toSave.map((r) => ({
      company_id: companyId,
      scan_id: scan.id,
      employee_id: r.employee_id,
      employee_name_raw: r.employee_name_raw || null,
      project_id: perRowProject[r.uid],
      work_date: r.work_date,
      hours: Number(r.hours),
      description: r.description || null,
      status: "confirmed",
    }));
    await saveMutation.mutateAsync({ scan_id: scan.id, rows: payload });
    onOpenChange(false);
    onSaved?.();
  };

  const addEmptyRow = () => {
    setRows((p) => [
      ...p,
      {
        uid: genUid(),
        employee_name_raw: "",
        employee_id: null,
        work_date: new Date().toISOString().slice(0, 10),
        hours: 8,
        description: "",
        selected: false,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Weryfikacja karty pracy
            {scan && (
              <Badge variant="secondary" className="ml-2 font-mono text-xs">
                {rows.length} wierszy
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid md:grid-cols-[minmax(0,400px)_minmax(0,1fr)] overflow-hidden min-h-0">
          {/* Podgląd zdjęcia */}
          <div className="bg-muted/40 border-r flex items-center justify-center p-3 overflow-hidden min-h-[260px]">
            {imgLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : imgUrl ? (
              <a href={imgUrl} target="_blank" rel="noreferrer" className="block max-h-full">
                <img
                  src={imgUrl}
                  alt="Karta pracy"
                  className="max-h-[80vh] max-w-full object-contain rounded shadow"
                />
              </a>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center gap-2 text-sm">
                <ImageOff className="h-8 w-8" />
                Brak podglądu
              </div>
            )}
          </div>

          {/* Tabela edycji */}
          <div className="flex flex-col min-h-0">
            {/* Bulk toolbar */}
            <div className="p-3 border-b bg-muted/20 flex items-center gap-2 flex-wrap">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => toggleAll(!!v)}
                aria-label="Zaznacz wszystkie"
              />
              <span className="text-sm text-muted-foreground">
                {anySelected ? `${rows.filter((r) => r.selected).length} zaznaczonych` : "Zaznacz wiersze"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Select value={bulkProject} onValueChange={setBulkProject}>
                  <SelectTrigger className="h-9 w-[200px]">
                    <SelectValue placeholder="Projekt" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!anySelected || !bulkProject}
                  onClick={() => assignBulkProject(bulkProject)}
                >
                  Przypisz zaznaczone
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0 z-10">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-2 w-[40px]"></th>
                    <th className="p-2">Pracownik</th>
                    <th className="p-2 w-[140px]">Data</th>
                    <th className="p-2 w-[80px]">Godz.</th>
                    <th className="p-2">Opis</th>
                    <th className="p-2 w-[180px]">Projekt</th>
                    <th className="p-2 w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const matched = r.employee_id && employees.find((e) => e.id === r.employee_id);
                    return (
                      <tr key={r.uid} className="border-t hover:bg-muted/20 align-top">
                        <td className="p-2">
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={(v) => updateRow(r.uid, { selected: !!v })}
                          />
                        </td>
                        <td className="p-2 space-y-1">
                          <Input
                            value={r.employee_name_raw}
                            onChange={(e) => updateRow(r.uid, { employee_name_raw: e.target.value })}
                            placeholder="Imię z kartki"
                            className="h-8"
                          />
                          <Select
                            value={r.employee_id ?? "_none"}
                            onValueChange={(v) =>
                              updateRow(r.uid, { employee_id: v === "_none" ? null : v })
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Wybierz pracownika">
                                {matched ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: matched.color }}
                                    />
                                    {matched.name}
                                    {r.match_score && r.match_score < 1 && (
                                      <span className="text-muted-foreground ml-1">
                                        ({Math.round(r.match_score * 100)}%)
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  "— niedopasowany —"
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— niedopasowany —</SelectItem>
                              {employees.map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: e.color }}
                                    />
                                    {e.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="date"
                            value={r.work_date}
                            onChange={(e) => updateRow(r.uid, { work_date: e.target.value })}
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={r.hours}
                            onChange={(e) =>
                              updateRow(r.uid, { hours: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={r.description}
                            onChange={(e) => updateRow(r.uid, { description: e.target.value })}
                            placeholder="np. Hankook"
                            className="h-8"
                          />
                        </td>
                        <td className="p-2">
                          <Select
                            value={perRowProject[r.uid] ?? "_none"}
                            onValueChange={(v) =>
                              setPerRowProject((p) => ({
                                ...p,
                                [r.uid]: v === "_none" ? "" : v,
                              }))
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Wybierz projekt" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— brak —</SelectItem>
                              {activeProjects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ backgroundColor: p.color }}
                                    />
                                    {p.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(r.uid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                        Brak wierszy. Dodaj ręcznie lub prześlij zdjęcie.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>

            <div className="border-t p-3 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addEmptyRow}>
                + Dodaj wiersz
              </Button>
              <div className="ml-auto text-xs text-muted-foreground">
                Razem godzin:{" "}
                <span className="font-semibold text-foreground">
                  {rows.reduce((s, r) => s + (Number(r.hours) || 0), 0).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t bg-muted/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Zapisz godziny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
