import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek, parseISO, differenceInDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Truck, Loader2, Building2, Users, X } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  useEmployees,
  useVehicles,
  useAssignments,
  useUpsertEmployee,
  useDeleteEmployee,
  useUpsertVehicle,
  useDeleteVehicle,
  useUpsertAssignment,
  useDeleteAssignment,
  useBulkAssign,
  useEmployeeGroups,
  useUpsertGroup,
  useDeleteGroup,
  type Assignment,
  type Employee,
} from "@/hooks/useSchedule";
import { ScheduleTimeline } from "@/components/schedule/ScheduleTimeline";
import { AssignmentDialog } from "@/components/schedule/AssignmentDialog";
import { EmployeeDialog } from "@/components/schedule/EmployeeDialog";
import { VehiclesDialog } from "@/components/schedule/VehiclesDialog";
import { GroupsDialog } from "@/components/schedule/GroupsDialog";
import { toast } from "sonner";

type Range = "week" | "twoweeks" | "month";

const Schedule = () => {
  const { user } = useAuth();
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (companies?.length && !companyId) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !companyId) { setIsAdmin(false); return; }
      // owner?
      const owned = companies?.find((c) => c.id === companyId)?.user_id === user.id;
      if (owned) { if (!cancelled) setIsAdmin(true); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", companyId)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [user, companyId, companies]);

  const [range, setRange] = useState<Range>("twoweeks");
  const [startDate, setStartDate] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const daysCount = range === "week" ? 7 : range === "twoweeks" ? 14 : 30;

  const fromStr = format(startDate, "yyyy-MM-dd");
  const toStr = format(addDays(startDate, daysCount - 1), "yyyy-MM-dd");

  const { data: employees = [] } = useEmployees(companyId);
  const { data: vehicles = [] } = useVehicles(companyId);
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(companyId, fromStr, toStr);
  const { data: groups = [] } = useEmployeeGroups(companyId);

  const upsertAssignment = useUpsertAssignment();
  const deleteAssignment = useDeleteAssignment(companyId);
  const upsertEmployee = useUpsertEmployee();
  const deleteEmployee = useDeleteEmployee(companyId);
  const upsertVehicle = useUpsertVehicle();
  const deleteVehicle = useDeleteVehicle(companyId);
  const bulkAssign = useBulkAssign();
  const upsertGroup = useUpsertGroup();
  const deleteGroup = useDeleteGroup(companyId);

  // Dialogs
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; initial: Partial<Assignment> | null }>({ open: false, initial: null });
  const [empDialog, setEmpDialog] = useState<{ open: boolean; initial: Partial<Employee> | null }>({ open: false, initial: null });
  const [vehiclesOpen, setVehiclesOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);

  // Copy/paste mode
  const [clipboard, setClipboard] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!clipboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClipboard(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboard]);

  const activeCompany = useMemo(
    () => companies?.find((c) => c.id === companyId) ?? null,
    [companies, companyId]
  );

  const handlePasteAt = (emp: Employee, date: Date) => {
    if (!clipboard || !companyId) return;
    const span = differenceInDays(parseISO(clipboard.end_date), parseISO(clipboard.start_date));
    const newStart = format(date, "yyyy-MM-dd");
    const newEnd = format(addDays(date, span), "yyyy-MM-dd");
    upsertAssignment.mutate({
      company_id: companyId,
      employee_id: emp.id,
      vehicle_id: clipboard.vehicle_id,
      task_type: clipboard.task_type,
      location: clipboard.location,
      description: clipboard.description,
      start_date: newStart,
      end_date: newEnd,
    });
  };

  if (companiesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Centrum Dowodzenia</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Harmonogram pracowników w terenie
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {companies && companies.length > 1 ? (
              <Select value={companyId ?? ""} onValueChange={setCompanyId}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : activeCompany ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{activeCompany.name}</span>
              </div>
            ) : null}
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(v) => v && setRange(v as Range)}
              size="sm"
            >
              <ToggleGroupItem value="week">Tydzień</ToggleGroupItem>
              <ToggleGroupItem value="twoweeks">2 tyg.</ToggleGroupItem>
              <ToggleGroupItem value="month">Miesiąc</ToggleGroupItem>
            </ToggleGroup>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStartDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              Dzisiaj
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGroupsOpen(true)}>
              <Users className="h-4 w-4" /> Grupy
            </Button>
            <Button size="sm" variant="outline" onClick={() => setVehiclesOpen(true)}>
              <Truck className="h-4 w-4" /> Pojazdy
            </Button>
            {clipboard && (
              <Button size="sm" variant="destructive" onClick={() => setClipboard(null)}>
                <X className="h-4 w-4" /> Zakończ wklejanie
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        {assignmentsLoading ? (
          <div className="flex items-center justify-center h-[40vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScheduleTimeline
            employees={employees}
            vehicles={vehicles}
            assignments={assignments}
            startDate={startDate}
            daysCount={daysCount}
            onShiftDays={(d) => setStartDate((prev) => addDays(prev, d))}
            onAddEmployee={() => setEmpDialog({ open: true, initial: null })}
            onDeleteEmployee={(e) => {
              if (confirm(`Usunąć pracownika ${e.name}? Wszystkie jego zadania zostaną usunięte.`)) {
                deleteEmployee.mutate(e.id);
              }
            }}
            onCellClick={(emp, date) => {
              if (clipboard) {
                handlePasteAt(emp, date);
                return;
              }
              const ds = format(date, "yyyy-MM-dd");
              setAssignDialog({
                open: true,
                initial: {
                  employee_id: emp.id,
                  start_date: ds,
                  end_date: ds,
                  task_type: "wyjazd",
                },
              });
            }}
            onAssignmentClick={(a) => {
              if (clipboard) return; // ignore clicks in paste mode
              setAssignDialog({ open: true, initial: a });
            }}
            onAssignmentResize={(a, newStart, newEnd) =>
              upsertAssignment.mutate({
                ...a,
                start_date: newStart,
                end_date: newEnd,
              })
            }
            onCopyAssignment={(a) => {
              setClipboard(a);
              toast.success("Skopiowano zadanie", {
                description: "Klikaj komórki pracowników, aby wkleić. Esc kończy.",
              });
            }}
            pasteMode={!!clipboard}
          />
        )}
      </div>

      {/* Dialogs */}
      <AssignmentDialog
        open={assignDialog.open}
        onOpenChange={(o) => setAssignDialog((s) => ({ ...s, open: o }))}
        employees={employees}
        vehicles={vehicles}
        groups={groups}
        initial={assignDialog.initial}
        onManageGroups={() => setGroupsOpen(true)}
        onSaveBulk={(data) => {
          if (!companyId) return;
          // Editing existing: update original, then bulk-create for newly added employees
          if (data.id && data.originalEmployeeId) {
            upsertAssignment.mutate({
              id: data.id,
              company_id: companyId,
              employee_id: data.originalEmployeeId,
              vehicle_id: data.vehicle_id,
              task_type: data.task_type,
              location: data.location,
              description: data.description,
              start_date: data.start_date,
              end_date: data.end_date,
            });
            const extras = data.employee_ids.filter((id) => id !== data.originalEmployeeId);
            if (extras.length) {
              bulkAssign.mutate({
                company_id: companyId,
                employee_ids: extras,
                vehicle_id: data.vehicle_id,
                task_type: data.task_type,
                location: data.location,
                description: data.description,
                start_date: data.start_date,
                end_date: data.end_date,
              });
            }
          } else {
            // Creating: bulk insert for all
            bulkAssign.mutate({
              company_id: companyId,
              employee_ids: data.employee_ids,
              vehicle_id: data.vehicle_id,
              task_type: data.task_type,
              location: data.location,
              description: data.description,
              start_date: data.start_date,
              end_date: data.end_date,
            });
          }
        }}
        onDelete={(id) => deleteAssignment.mutate(id)}
      />
      <EmployeeDialog
        open={empDialog.open}
        onOpenChange={(o) => setEmpDialog((s) => ({ ...s, open: o }))}
        initial={empDialog.initial}
        onSave={(e) => {
          if (!companyId) return;
          upsertEmployee.mutate({ ...(e as any), company_id: companyId });
        }}
      />
      <VehiclesDialog
        open={vehiclesOpen}
        onOpenChange={setVehiclesOpen}
        vehicles={vehicles}
        onAdd={(name, registration) => {
          if (!companyId) return;
          upsertVehicle.mutate({ company_id: companyId, name, registration });
        }}
        onDelete={(id) => deleteVehicle.mutate(id)}
      />
      <GroupsDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        employees={employees}
        groups={groups}
        currentUserId={user?.id ?? null}
        isAdmin={isAdmin}
        onSave={(g) => {
          if (!companyId) return;
          upsertGroup.mutate({ ...g, company_id: companyId });
        }}
        onDelete={(id) => deleteGroup.mutate(id)}
      />
    </AppLayout>
  );
};

export default Schedule;
